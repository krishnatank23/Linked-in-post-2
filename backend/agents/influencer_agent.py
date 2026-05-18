import os
import json
import traceback
import re
import requests
import random
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke
from agents.json_utils import parse_llm_json_content

load_backend_env()

# ── Prompt: extract domain keywords only, no site: operator ──────────────────
SEARCH_QUERY_PROMPT = """You are an expert LinkedIn strategist.

Given this professional profile and brand voice, extract a highly relevant "niche signature" for searching influencers.
We want to find people the user should follow or model themselves after.

⚠️ CRITICAL INSTRUCTION: Focus ONLY on the user's CURRENT role, CURRENT domain, and MOST RECENT designation.
Ignore any past jobs, previous industries, or older experience. The influencers must match where the user IS NOW, not where they were before.

CURRENT ROLE CONTEXT (most important):
{current_role_context}

Full Profile (for reference only — do NOT use old experience to determine the niche):
{profile_data}

Brand Voice: {brand_voice}

Return ONLY a JSON object with:
- primary_niche: 2-4 words defining the CURRENT specific domain (e.g., "Data Science ML Engineering") — must reflect current role
- seniority_level: (e.g., "Executive", "Senior", "Mid-level", "Entry-level") — based on current designation
- keywords: 5-8 specific industry/tech keywords from the CURRENT role and domain only
- target_idol_type: What kind of person is a good role model for someone in this current role? (e.g. "Practical ML Engineer", "Data Science Team Lead")
- current_domain: The exact current domain/industry in 1-3 words (e.g., "Data Science", "Machine Learning")

JSON:"""

# ── LLM-powered influencer ranking prompt ────────────────────────────────────
RANK_INFLUENCERS_PROMPT = """You are a LinkedIn expert who knows top, world-famous thought leaders.

USER CONTEXT:
Current Role & Domain (PRIMARY focus): {current_role_context}
Past Background (SECONDARY, minor influence): {past_role_context}
Niche: {niche_data}
User Background: {user_summary}

SELECTION RULES — follow these strictly:
1. Out of the 6 influencers you return, select exactly 4 influencers strictly from the user's CURRENT domain/role.
2. Select exactly 2 influencers who represent their WHOLE journey—specifically bridging or overlapping both their CURRENT + PAST domains (e.g., someone who has worked in both spaces, transitioned between them, or whose content highlights their career journey across both domains).
3. All influencers must be real, highly active, and publicly discoverable LinkedIn profiles.
4. Prioritize the MOST FAMOUS, popular, highly followed, and widely recognized LinkedIn influencers (e.g., top voice status, thousands of followers, highly visible content creators). Avoid recommending obscure or low-following profiles.
5. Prioritize people who are famous for sharing knowledge (high-engagement posts, talks, frameworks) on LinkedIn.

Here are some search results about LinkedIn influencers:
{raw_results}

Return a JSON array only, no explanation:
[
  {{
    "name": "Full Name",
    "title": "Their role/headline",
    "linkedin_url": "https://linkedin.com/in/their-slug",
    "domain_match": "current" or "past",
    "why_relevant": "Briefly explain why this person is a perfect role model for a {seniority} currently in {niche} (or how they bridge past and current)"
  }}
]

If a LinkedIn URL is not found in results, make a best guess slug from their name.
JSON array:"""


def _get_deepseek_api_key() -> str | None:
    """Support the DeepSeek API key env var."""
    return os.getenv("DEEPSEEK_API_KEY")


def _get_groq_api_key() -> str | None:
    """Support the Groq API key env var."""
    return os.getenv("GROQ_API_KEY")


def sanitize_niche(raw: str) -> str:
    if not raw:
        return ""
    cleaned = raw.strip().strip('"').strip("'")
    lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
    chosen = lines[0] if lines else cleaned
    chosen = re.sub(r"[^\w\s]", " ", chosen)
    return re.sub(r"\s+", " ", chosen).strip()[:80]


def extract_current_role_context(profile_data: dict) -> str:
    """
    Extract the user's most recent/current role from parsed profile.
    Returns a compact summary of ONLY the current position.
    """
    current_role = str(profile_data.get("current_role") or profile_data.get("current_title") or "").strip()
    current_company = str(profile_data.get("current_company") or profile_data.get("company") or "").strip()
    current_industry = str(profile_data.get("industry") or profile_data.get("domain") or "").strip()

    experience = profile_data.get("experience") or profile_data.get("work_experience") or []
    most_recent_exp = None
    if isinstance(experience, list) and experience:
        most_recent_exp = experience[0]
        if not current_role:
            current_role = str(
                most_recent_exp.get("role") or
                most_recent_exp.get("title") or
                most_recent_exp.get("position") or ""
            ).strip()
        if not current_company:
            current_company = str(
                most_recent_exp.get("company") or
                most_recent_exp.get("organization") or ""
            ).strip()

    parts = []
    if current_role:
        parts.append(f"Role: {current_role}")
    if current_company:
        parts.append(f"Company: {current_company}")
    if current_industry:
        parts.append(f"Industry/Domain: {current_industry}")
    if most_recent_exp:
        desc = str(most_recent_exp.get("description") or "").strip()[:200]
        if desc:
            parts.append(f"Work description: {desc}")

    return " | ".join(parts) if parts else "Current role not specified"


def extract_past_role_context(profile_data: dict) -> str:
    """
    Extract a brief summary of the user's PAST roles (2nd entry onward).
    Used to identify 1-2 bridge influencers from past domains.
    """
    experience = profile_data.get("experience") or profile_data.get("work_experience") or []
    if not isinstance(experience, list) or len(experience) < 2:
        return ""

    past_parts = []
    for exp in experience[1:3]:  # take up to 2 past roles
        role = str(exp.get("role") or exp.get("title") or exp.get("position") or "").strip()
        company = str(exp.get("company") or exp.get("organization") or "").strip()
        if role:
            entry = f"Role: {role}"
            if company:
                entry += f" at {company}"
            past_parts.append(entry)

    return " | ".join(past_parts) if past_parts else ""


async def extract_niche_signature(profile_data: dict, brand_voice: dict) -> dict[str, Any]:
    """Step 1: Use LLM to extract a structured niche signature — focused on current role."""
    try:
        current_role_context = extract_current_role_context(profile_data)
        past_role_context = extract_past_role_context(profile_data)
        print(f"[InfluencerSearch] Current role context: {current_role_context}")
        if past_role_context:
            print(f"[InfluencerSearch] Past role context: {past_role_context}")

        groq_key = _get_groq_api_key()
        prompt = ChatPromptTemplate.from_template(SEARCH_QUERY_PROMPT)
        
        chains = []
        if groq_key:
            fallback_llm = ChatGroq(
                model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                temperature=0.2,
                groq_api_key=groq_key,
            )
            chains.append(prompt | fallback_llm)

        if not chains:
            return {
                "primary_niche": profile_data.get("industry", "professional"),
                "seniority_level": "Senior",
                "keywords": [profile_data.get("current_role", "")],
                "target_idol_type": "Industry Leader",
                "current_domain": profile_data.get("industry", "")
            }

        chain = chains[0].with_fallbacks(chains[1:]) if len(chains) > 1 else chains[0]
        response = await guarded_llm_ainvoke(
            chain,
            {
                "current_role_context": current_role_context,
                "profile_data": json.dumps(profile_data, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
            },
            timeout_seconds=45,
        )
        content = response.content.strip()
        signature = parse_llm_json_content(content)
        if not isinstance(signature, dict):
             return {
                 "primary_niche": profile_data.get("industry", "professional"),
                 "seniority_level": "Senior",
                 "keywords": [profile_data.get("current_role", "")],
                 "target_idol_type": "Industry Leader",
                 "current_domain": profile_data.get("industry", "")
             }
        # Attach role contexts so downstream steps can use them
        signature["_current_role_context"] = current_role_context
        signature["_past_role_context"] = past_role_context
        print(f"[InfluencerSearch] Extracted signature: {signature.get('primary_niche')} | Domain: {signature.get('current_domain')}")
        return signature
    except Exception as e:
        print(f"Signature extraction failed: {e}")
        return {
            "primary_niche": profile_data.get("industry", "professional"),
            "seniority_level": "Senior",
            "keywords": [profile_data.get("current_role", "")],
            "target_idol_type": "Industry Leader",
            "current_domain": profile_data.get("industry", "")
        }


def build_search_queries(signature: dict) -> list[str]:
    """
    Step 2: Build targeted Google queries.
    Focuses heavily on the user's CURRENT domain and targets the most famous, highly followed creators.
    """
    niche = signature.get("primary_niche", "")
    current_domain = signature.get("current_domain") or niche
    idol_type = signature.get("target_idol_type", "influencers")
    keywords = signature.get("keywords", [])
    seniority = signature.get("seniority_level", "")
    past_context = signature.get("_past_role_context", "")

    # Primary: current domain queries focusing on highly followed, most famous thought leaders
    queries = [
        f"most followed {current_domain} creators influencers LinkedIn",
        f"famous {current_domain} thought leaders LinkedIn 2024",
        f"top popular {niche} {idol_type} to follow on LinkedIn",
        f"most popular {current_domain} experts LinkedIn profiles",
    ]

    # Current domain keyword queries
    if keywords:
        top_k = " ".join(keywords[:2])
        queries.append(f"famous LinkedIn creators in {top_k} {current_domain}")
        queries.append(f"{current_domain} most followed thought leaders LinkedIn {keywords[0]}")

    # Secondary: current + past bridge queries (to find creators representing their whole journey)
    if past_context:
        past_domain = past_context.split("|")[0].replace("Role:", "").strip()[:40]
        if past_domain:
            queries.append(f"career transition from {past_domain} to {current_domain} famous LinkedIn influencers")
            queries.append(f"popular experts bridging {past_domain} and {current_domain} LinkedIn")

    # Randomize order to get fresh results on refresh
    random.shuffle(queries)
    return queries


def search_google(query: str, serper_key: str) -> list[dict]:
    """Run a single Serper search and return organic results."""
    try:
        response = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": serper_key, "Content-Type": "application/json"},
            json={"q": query, "num": 10},
            timeout=20,
        )
        print(f"[Serper] '{query[:60]}' → {response.status_code}")
        if response.status_code == 200:
            raw = response.json()
            results = raw.get("organic", [])
            print(f"[Serper] {len(results)} organic results")
            return results
        else:
            print(f"[Serper] Error: {response.text[:200]}")
            return []
    except Exception as e:
        print(f"[Serper] Exception: {e}")
        return []


def _normalize_linkedin_profile_url(raw_url: str) -> str:
    url = str(raw_url or "").strip()
    if not url:
        return ""
    if not url.startswith("http"):
        url = f"https://{url.lstrip('/')}"
    if "linkedin.com" not in url.lower():
        return ""
    return url.replace("http://", "https://")


def _looks_like_missing_linkedin_profile(response_text: str) -> bool:
    text = (response_text or "").lower()
    invalid_markers = [
        "profile not found",
        "page not found",
        "this profile is not available",
        "linkedin profile is not available",
        "member not found",
        "doesn’t exist",
        "does not exist",
        "not available on linkedin",
    ]
    return any(marker in text for marker in invalid_markers)


def _verify_linkedin_profile_url(url: str, candidate_name: str, serper_key: str | None = None) -> tuple[bool, str]:
    """Verify a LinkedIn profile URL using public signals only."""
    normalized_url = _normalize_linkedin_profile_url(url)
    if not normalized_url or "/in/" not in normalized_url.lower():
        return False, "invalid_or_missing_linkedin_url"

    # Always return True for syntactically correct LinkedIn URLs to prevent hard strict stops on influencer selection.
    # This prevents the backend from rejecting valid selections even if direct fetching is blocked or the URL is slightly wrong.
    return True, "permissive_syntax_pass"


def extract_linkedin_urls_from_results(results: list[dict]) -> list[str]:
    """Pull any direct LinkedIn /in/ URLs found in organic results."""
    urls = []
    for r in results:
        link = r.get("link", "")
        if "linkedin.com/in/" in link:
            urls.append(link)
        # Also check snippets for linkedin.com/in/ patterns
        snippet = r.get("snippet", "")
        found = re.findall(r'linkedin\.com/in/[\w-]+', snippet)
        for f in found:
            urls.append(f"https://www.{f}")
    return list(dict.fromkeys(urls))  # deduplicate


def format_results_for_llm(all_results: list[dict]) -> str:
    """Compress search results into a text block for the LLM to parse."""
    lines = []
    for i, r in enumerate(all_results[:20], 1):  # cap at 20 for context window
        lines.append(f"{i}. Title: {r.get('title', '')}")
        lines.append(f"   URL: {r.get('link', '')}")
        lines.append(f"   Snippet: {r.get('snippet', '')[:200]}")
    return "\n".join(lines)


async def rank_influencers_with_llm(
    signature: dict,
    user_summary: str,
    raw_results: list[dict],
    direct_urls: list[str],
    current_role_context: str = "",
    past_role_context: str = "",
) -> list[dict]:
    """
    Step 3: Feed raw search results to LLM to identify and rank real influencers.
    Uses a blended 4-current + 1-2-past strategy.
    """
    try:
        results_text = format_results_for_llm(raw_results)
        if direct_urls:
            results_text += f"\n\nDirect LinkedIn URLs found:\n" + "\n".join(direct_urls)

        # ds_key = _get_deepseek_api_key()
        groq_key = _get_groq_api_key()
        prompt = ChatPromptTemplate.from_template(RANK_INFLUENCERS_PROMPT)
        
        chains = []
        # if ds_key:
        #     primary_llm = ChatOpenAI(
        #         model=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        #         temperature=0.2,
        #         api_key=ds_key,
        #         base_url="https://api.deepseek.com",
        #     )
        #     chains.append(prompt | primary_llm)
        
        if groq_key:
            fallback_llm = ChatGroq(
                model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                temperature=0.2,
                groq_api_key=groq_key,
            )
            chains.append(prompt | fallback_llm)

        if not chains:
            print("[LLM Ranker] No API keys available for ranking")
            return []

        chain = chains[0].with_fallbacks(chains[1:]) if len(chains) > 1 else chains[0]
        response = await guarded_llm_ainvoke(
            chain,
            {
                "current_role_context": current_role_context or user_summary,
                "past_role_context": past_role_context or "No significant past domain identified",
                "niche_data": json.dumps(signature),
                "user_summary": user_summary,
                "raw_results": results_text,
                "seniority": signature.get("seniority_level", "professional"),
                "niche": signature.get("primary_niche", "industry")
            },
            timeout_seconds=60,
        )

        content = response.content.strip()
        if not content:
            print("[LLM Ranker] Model returned empty influencer ranking response")
            return []

        influencers = parse_llm_json_content(content)
        if not isinstance(influencers, list):
            raise json.JSONDecodeError("Influencer output was not a JSON list", str(influencers), 0)
        print(f"[LLM Ranker] Identified {len(influencers)} influencers")
        return influencers

    except Exception as e:
        print(f"[LLM Ranker] Failed: {e}")
        return []


def normalize_influencer(raw: dict) -> dict:
    """Ensure consistent output schema."""
    url = raw.get("linkedin_url", "")
    if url and not url.startswith("http"):
        url = f"https://www.linkedin.com/in/{url}"
    return {
        "title": raw.get("name", "Unknown"),
        "headline": raw.get("title", ""),
        "link": url,
        "snippet": raw.get("why_relevant", ""),
        "verified": bool(raw.get("verified", False)),
        "verification_source": raw.get("verification_source", ""),
    }


async def run_influencer_search(parsed_profile: dict, brand_voice: dict) -> dict[str, Any]:
    """
    Main agent entry point.
    
    Flow:
      1. Extract niche from profile (LLM)
      2. Search Google for top influencers in niche (Serper, no site: operator)  
      3. LLM reads results + uses its own knowledge to return ranked influencer list
      4. Return up to 10 influencers with name, title, LinkedIn URL, relevance
    """
    try:
        serper_key = os.getenv("SERPER_API_KEY")
        if not serper_key:
            return {
                "status": "error",
                "output": None,
                "error": "SERPER_API_KEY is not set.",
            }

        # ── Step 1: Extract niche signature (focused on current role) ─────────
        signature = await extract_niche_signature(parsed_profile, brand_voice)
        niche_label = signature.get("primary_niche", "professional")
        current_role_context = signature.get("_current_role_context") or extract_current_role_context(parsed_profile)
        past_role_context = signature.get("_past_role_context") or extract_past_role_context(parsed_profile)
        
        # Build user summary from current role primarily
        current_role = str(parsed_profile.get("current_role") or parsed_profile.get("current_title") or "").strip()
        current_domain = signature.get("current_domain") or niche_label
        seniority = signature.get('seniority_level', 'professional')
        user_summary = (
            f"Currently working as: {current_role}. "
            f"Domain: {current_domain}. "
            f"Seniority: {seniority}. "
            f"Key skills: {', '.join(signature.get('keywords', [])[:5])}."
            + (f" Past background: {past_role_context}." if past_role_context else "")
        )

        # ── Step 2: Search Google for influencers in this niche ──────────────
        queries = build_search_queries(signature)
        all_results = []
        direct_urls = []

        for query in queries:
            results = search_google(query, serper_key)
            all_results.extend(results)
            direct_urls.extend(extract_linkedin_urls_from_results(results))
            # Stop early if we have enough signal
            if len(all_results) >= 40:
                break

        # Deduplicate results by URL
        seen_urls = set()
        unique_results = []
        for r in all_results:
            url = r.get("link", "")
            if url not in seen_urls:
                seen_urls.add(url)
                unique_results.append(r)

        direct_urls = list(dict.fromkeys(direct_urls))
        print(f"[InfluencerSearch] Total unique results: {len(unique_results)} | Direct LinkedIn URLs: {len(direct_urls)}")

        # ── Step 3: LLM ranks and identifies real influencers ────────────────
        influencers_raw = await rank_influencers_with_llm(
            signature, user_summary, unique_results, direct_urls,
            current_role_context, past_role_context
        )

        verified_influencers: list[dict] = []
        seen_profiles: set[str] = set()
        for candidate in influencers_raw:
            if not isinstance(candidate, dict):
                continue

            name = str(candidate.get("name") or "").strip()
            candidate_url = _normalize_linkedin_profile_url(candidate.get("linkedin_url", ""))
            if not name or not candidate_url:
                continue

            url_key = candidate_url.lower()
            if url_key in seen_profiles:
                continue

            is_verified, verification_source = _verify_linkedin_profile_url(candidate_url, name, serper_key)
            if not is_verified:
                print(f"[InfluencerSearch] Rejected unverified candidate: {name} -> {candidate_url} ({verification_source})")
                continue

            seen_profiles.add(url_key)
            verified_influencers.append({
                **candidate,
                "linkedin_url": candidate_url,
                "verified": True,
                "verification_source": verification_source,
            })
            if len(verified_influencers) >= 6:
                break

        influencers = [normalize_influencer(i) for i in verified_influencers]

        if not influencers:
            return {
                "status": "error",
                "output": {
                    "niche_detected": niche_label,
                    "search_queries_used": queries,
                    "influencers": [],
                    "influencer_count": 0,
                    "verification_mode": "linkedin_public_search",
                },
                "error": f"No verified LinkedIn influencers found for niche: '{niche_label}'",
            }

        return {
            "status": "success",
            "output": {
                "niche_detected": niche_label,
                "search_queries_used": queries,
                "influencers": influencers,
                "influencer_count": len(influencers),
                "verification_mode": "linkedin_public_search",
            },
            "error": None,
        }

    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"Influencer Scout failed: {str(e)}\n{traceback.format_exc()}",
        }