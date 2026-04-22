import os
import json
import traceback
import re
import requests
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke

load_backend_env()

# ── Prompt: extract domain keywords only, no site: operator ──────────────────
SEARCH_QUERY_PROMPT = """You are an expert LinkedIn strategist.

Given this professional profile and brand voice, extract the user's PRIMARY domain/niche.

Profile: {profile_data}
Brand Voice: {brand_voice}

Return ONLY a short 2-4 word niche label. Examples:
- machine learning engineering
- sustainable fashion marketing  
- cloud infrastructure devops
- product management fintech

Niche label:"""

# ── LLM-powered influencer ranking prompt ────────────────────────────────────
RANK_INFLUENCERS_PROMPT = """You are a LinkedIn expert who knows top thought leaders.

User's domain/niche: {niche}

Here are some search results about LinkedIn influencers in this space:
{raw_results}

From these results, identify up to 10 real LinkedIn influencers who are:
- Founders, CEOs, or senior experts in {niche}
- Known for sharing knowledge (posts, articles, talks)
- Have large followings or strong credibility

Return a JSON array only, no explanation:
[
  {{
    "name": "Full Name",
    "title": "Their role/headline",
    "linkedin_url": "https://linkedin.com/in/their-slug",
    "why_relevant": "One sentence why they are an idol in {niche}"
  }}
]

If a LinkedIn URL is not found in results, make a best guess slug from their name.
JSON array:"""


def sanitize_niche(raw: str) -> str:
    if not raw:
        return ""
    cleaned = raw.strip().strip('"').strip("'")
    lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
    chosen = lines[0] if lines else cleaned
    chosen = re.sub(r"[^\w\s]", " ", chosen)
    return re.sub(r"\s+", " ", chosen).strip()[:80]


async def extract_niche(profile_data: dict, brand_voice: dict) -> str:
    """Step 1: Use LLM to extract a clean niche/domain label."""
    try:
        llm = ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            temperature=0.3,  # Low temp — we want a precise label
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        prompt = ChatPromptTemplate.from_template(SEARCH_QUERY_PROMPT)
        chain = prompt | llm
        response = await guarded_llm_ainvoke(
            chain,
            {
                "profile_data": json.dumps(profile_data, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
            },
            timeout_seconds=45,
        )
        niche = sanitize_niche(response.content)
        print(f"[InfluencerSearch] Extracted niche: '{niche}'")
        return niche
    except Exception as e:
        print(f"Niche extraction failed: {e}")
        industry = profile_data.get("industry", "")
        role = profile_data.get("current_role", "")
        return f"{industry} {role}".strip() or "professional growth"


def build_search_queries(niche: str) -> list[str]:
    """
    Step 2: Build multiple Google queries WITHOUT site: operator.
    These target articles/lists that mention LinkedIn influencers.
    """
    return [
        f"top {niche} influencers LinkedIn 2024",
        f"best {niche} thought leaders to follow LinkedIn",
        f"famous {niche} founders experts LinkedIn",
        f"{niche} LinkedIn creators most followed",
        f"top {niche} LinkedIn profiles follow",
    ]


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


async def rank_influencers_with_llm(niche: str, raw_results: list[dict], direct_urls: list[str]) -> list[dict]:
    """
    Step 3: Feed raw search results to LLM to identify and rank real influencers.
    LLM knows famous people in most domains from training data.
    """
    try:
        results_text = format_results_for_llm(raw_results)
        if direct_urls:
            results_text += f"\n\nDirect LinkedIn URLs found:\n" + "\n".join(direct_urls)

        llm = ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            temperature=0.2,
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        prompt = ChatPromptTemplate.from_template(RANK_INFLUENCERS_PROMPT)
        chain = prompt | llm
        response = await guarded_llm_ainvoke(
            chain,
            {"niche": niche, "raw_results": results_text},
            timeout_seconds=60,
        )

        content = response.content.strip()
        # Strip markdown fences if present
        content = re.sub(r"^```json\s*|^```\s*|```$", "", content, flags=re.MULTILINE).strip()

        influencers = json.loads(content)
        print(f"[LLM Ranker] Identified {len(influencers)} influencers")
        return influencers if isinstance(influencers, list) else []

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

        # ── Step 1: Extract niche ────────────────────────────────────────────
        niche = await extract_niche(parsed_profile, brand_voice)

        # ── Step 2: Search Google for influencers in this niche ──────────────
        queries = build_search_queries(niche)
        all_results = []
        direct_urls = []

        for query in queries:
            results = search_google(query, serper_key)
            all_results.extend(results)
            direct_urls.extend(extract_linkedin_urls_from_results(results))
            # Stop early if we have enough signal
            if len(all_results) >= 30:
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
        influencers_raw = await rank_influencers_with_llm(niche, unique_results, direct_urls)
        influencers = [normalize_influencer(i) for i in influencers_raw][:10]

        if not influencers:
            return {
                "status": "error",
                "output": {
                    "niche_detected": niche,
                    "search_queries_used": queries,
                    "influencers": [],
                    "influencer_count": 0,
                },
                "error": f"No influencers found for niche: '{niche}'",
            }

        return {
            "status": "success",
            "output": {
                "niche_detected": niche,
                "search_queries_used": queries,
                "influencers": influencers,
                "influencer_count": len(influencers),
            },
            "error": None,
        }

    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"Influencer Scout failed: {str(e)}\n{traceback.format_exc()}",
        }