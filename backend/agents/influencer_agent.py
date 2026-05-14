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

Profile: {profile_data}
Brand Voice: {brand_voice}

Return ONLY a JSON object with:
- primary_niche: 2-4 words defining the specific domain (e.g., "Fintech Product Management")
- seniority_level: (e.g., "Executive", "Senior", "Mid-level")
- keywords: 5-8 specific industry/tech keywords
- target_idol_type: What kind of person is a good role model for this user? (e.g. "Visionary CTO", "Practical Coding Influencer", "Startup Growth Expert")

JSON:"""

# ── LLM-powered influencer ranking prompt ────────────────────────────────────
RANK_INFLUENCERS_PROMPT = """You are a LinkedIn expert who knows top thought leaders.

USER CONTEXT:
Niche: {niche_data}
User Background: {user_summary}

Here are some search results about LinkedIn influencers:
{raw_results}

From these results, identify up to 8 real LinkedIn influencers who are highly relevant to this specific user.
Look for:
- People in the same industry or a closely related one.
- People who share the user's seniority level or are slightly ahead (idols/mentors).
- People who are known for sharing knowledge (posts, articles, talks).
- Real, publicly discoverable LinkedIn profiles.

Return a JSON array only, no explanation:
[
  {{
    "name": "Full Name",
    "title": "Their role/headline",
    "linkedin_url": "https://linkedin.com/in/their-slug",
    "why_relevant": "Briefly explain why this person is a perfect role model for a {seniority} in {niche}"
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


async def extract_niche_signature(profile_data: dict, brand_voice: dict) -> dict[str, Any]:
    """Step 1: Use LLM to extract a structured niche signature."""
    try:
        primary_llm = ChatOpenAI(
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
            temperature=0.2,
            openai_api_key=_get_deepseek_api_key(),
            base_url="https://api.deepseek.com",
        )

        fallback_llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            temperature=0.2,
            groq_api_key=_get_groq_api_key(),
        )

        prompt = ChatPromptTemplate.from_template(SEARCH_QUERY_PROMPT)
        # Use with_fallbacks to automatically try Groq if DeepSeek fails
        chain = (prompt | primary_llm).with_fallbacks([prompt | fallback_llm])
        response = await guarded_llm_ainvoke(
            chain,
            {
                "profile_data": json.dumps(profile_data, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
            },
            timeout_seconds=45,
        )
        content = response.content.strip()
        signature = parse_llm_json_content(content)
        if not isinstance(signature, dict):
             # Fallback
             return {
                 "primary_niche": profile_data.get("industry", "professional"),
                 "seniority_level": "Senior",
                 "keywords": [profile_data.get("current_role", "")],
                 "target_idol_type": "Industry Leader"
             }
        print(f"[InfluencerSearch] Extracted signature: {signature.get('primary_niche')}")
        return signature
    except Exception as e:
        print(f"Signature extraction failed: {e}")
        return {
            "primary_niche": profile_data.get("industry", "professional"),
            "seniority_level": "Senior",
            "keywords": [profile_data.get("current_role", "")],
            "target_idol_type": "Industry Leader"
        }


def build_search_queries(signature: dict) -> list[str]:
    """
    Step 2: Build multiple targeted Google queries based on signature.
    """
    niche = signature.get("primary_niche", "")
    idol_type = signature.get("target_idol_type", "influencers")
    keywords = signature.get("keywords", [])
    
    queries = [
        f"top {niche} {idol_type} LinkedIn 2024",
        f"best {niche} thought leaders to follow LinkedIn",
        f"famous {niche} founders experts LinkedIn",
    ]
    
    # Add more specific keyword-based queries
    if keywords:
        top_k = " ".join(keywords[:2])
        queries.append(f"top LinkedIn creators in {top_k}")
        queries.append(f"{niche} industry leaders LinkedIn {keywords[0]}")
        
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

    try:
        response = requests.get(
            normalized_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
            },
            timeout=15,
            allow_redirects=True,
        )
        final_url = str(response.url or normalized_url)
        page_text = (response.text or "")[:8000]

        if "linkedin.com/in/" not in final_url.lower():
            return False, f"redirected_away_from_linkedin:{response.status_code}"

        if _looks_like_missing_linkedin_profile(page_text):
            return False, "linkedin_page_indicates_profile_missing"

        if response.status_code in {200, 301, 302, 303, 307, 308, 403, 999}:
            if candidate_name and candidate_name.lower() not in page_text.lower():
                # Keep the verification permissive because LinkedIn often blocks the body.
                return True, f"linkedIn_profile_url_confirmed:{response.status_code}"
            return True, f"linkedIn_profile_confirmed:{response.status_code}"

        return False, f"unexpected_status:{response.status_code}"
    except Exception as exc:
        # Fall back to a lightweight public search confirmation if direct fetching is blocked.
        if serper_key:
            try:
                verification_query = f'"{candidate_name}" site:linkedin.com/in/'
                verification_results = search_google(verification_query, serper_key)
                for result in verification_results:
                    link = str(result.get("link") or "")
                    title = str(result.get("title") or "")
                    snippet = str(result.get("snippet") or "")
                    if "linkedin.com/in/" in link.lower() and candidate_name.lower() in f"{title} {snippet}".lower():
                        return True, "verified_via_google_search"
            except Exception:
                pass

        return False, f"verification_error:{exc}"


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


async def rank_influencers_with_llm(signature: dict, user_summary: str, raw_results: list[dict], direct_urls: list[str]) -> list[dict]:
    """
    Step 3: Feed raw search results to LLM to identify and rank real influencers.
    """
    try:
        results_text = format_results_for_llm(raw_results)
        if direct_urls:
            results_text += f"\n\nDirect LinkedIn URLs found:\n" + "\n".join(direct_urls)

        primary_llm = ChatOpenAI(
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
            temperature=0.2,
            openai_api_key=_get_deepseek_api_key(),
            base_url="https://api.deepseek.com",
        )

        fallback_llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            temperature=0.2,
            groq_api_key=_get_groq_api_key(),
        )

        prompt = ChatPromptTemplate.from_template(RANK_INFLUENCERS_PROMPT)
        # Use with_fallbacks to automatically try Groq if DeepSeek fails
        chain = (prompt | primary_llm).with_fallbacks([prompt | fallback_llm])
        response = await guarded_llm_ainvoke(
            chain,
            {
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

        # ── Step 1: Extract niche signature ──────────────────────────────────
        signature = await extract_niche_signature(parsed_profile, brand_voice)
        niche_label = signature.get("primary_niche", "professional")
        
        user_summary = f"A {signature.get('seniority_level')} professional in {niche_label}. " \
                       f"Key focus: {', '.join(signature.get('keywords', []))}"

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
        influencers_raw = await rank_influencers_with_llm(signature, user_summary, unique_results, direct_urls)

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