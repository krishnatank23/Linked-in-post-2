import os
import json
import traceback
import re
import requests
from typing import Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
from agents.groq_guard import guarded_groq_ainvoke

load_dotenv()

SEARCH_QUERY_PROMPT = """You are an expert LinkedIn strategist. 
Your goal is to find the "idols" or top influencers for a professional based on their profile and brand voice.

Analyze the following profile and brand data:
Profile: {profile_data}
Brand Voice: {brand_voice}

Create ONE highly optimized search query to find top LinkedIn influencers, thought leaders, or "idols" in this person's exact niche/domain.
The query should be designed for a Google/Serper search that targets LinkedIn profiles specifically.

Example queries:
- "Top cloud architecture thought leaders on LinkedIn"
- "Most followed AI product managers on LinkedIn San Francisco"
- "Top sustainable fashion marketing influencers LinkedIn"

Your query:
"""

def sanitize_search_query(raw_query: str) -> str:
    """Reduce verbose LLM output to a single search-friendly query string."""
    if not raw_query:
        return ""

    cleaned = raw_query.strip().replace('"', "").replace("'", "")
    lines = [line.strip(" -*\t") for line in cleaned.splitlines() if line.strip()]

    # Prefer lines that already look like concise query statements.
    candidates = []
    for line in lines:
        lower = line.lower()
        if any(skip in lower for skip in ["based on", "this query", "alternatively", "however", "i would", "here is", "designed to", "optimized"]):
            continue
        if len(line.split()) >= 4:
            candidates.append(line)

    if candidates:
        chosen = candidates[0]
    elif lines:
        chosen = lines[0]
    else:
        chosen = cleaned

    # Keep only safe query chars and cap length for better search relevance.
    chosen = re.sub(r"[^\w\s,&+./-]", " ", chosen)
    chosen = re.sub(r"\s+", " ", chosen).strip()
    return chosen[:120].strip()


async def generate_search_query(profile_data: dict, brand_voice: dict) -> str:
    """Generate a targeted search query using LLM."""
    try:
        llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            temperature=0.7,
            api_key=os.getenv("GROQ_API_KEY"),
        )
        
        prompt = ChatPromptTemplate.from_template(SEARCH_QUERY_PROMPT)
        chain = prompt | llm
        
        response = await guarded_groq_ainvoke(
            chain,
            {
                "profile_data": json.dumps(profile_data, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
            },
            timeout_seconds=45,
        )
        
        return sanitize_search_query(response.content)
    except Exception as e:
        print(f"Query generation failed: {e}")
        # Fallback query
        industry = profile_data.get("industry") or "industry"
        role = profile_data.get("current_role") or "professional"
        return f"Top {industry} {role} influencers on LinkedIn"

async def search_influencers(query: str) -> list[dict[str, Any]]:
    """Search for LinkedIn profiles and return up to 15 suggestions."""
    influencers = []

    serper_key = os.getenv("SERPER_API_KEY")
    if not serper_key:
        print("SERPER_API_KEY missing; skipping Serper and using DuckDuckGo fallback")
    else:
        try:
            url = "https://google.serper.dev/search"
            payload = json.dumps({
                "q": f"site:linkedin.com/in/ {query}",
                "num": 25
            })
            headers = {
                'X-API-KEY': serper_key,
                'Content-Type': 'application/json'
            }

            response = requests.request("POST", url, headers=headers, data=payload, timeout=20)
            if response.status_code != 200:
                print(f"Serper returned status {response.status_code}: {response.text[:200]}")
            else:
                results = response.json()
                for result in results.get("organic", []):
                    if "linkedin.com/in/" in result.get("link", ""):
                        influencers.append({
                            "title": result.get("title", ""),
                            "link": result.get("link", ""),
                            "snippet": result.get("snippet", ""),
                        })
        except Exception as e:
            print(f"Serper search failed: {e}")

    # Fallback: DuckDuckGo search if Serper yields nothing.
    if not influencers:
        try:
            from duckduckgo_search import DDGS

            with DDGS() as ddgs:
                for result in ddgs.text(f"site:linkedin.com/in/ {query}", max_results=25):
                    link = result.get("href", "")
                    if "linkedin.com/in/" in link:
                        influencers.append({
                            "title": result.get("title", ""),
                            "link": link,
                            "snippet": result.get("body", ""),
                        })
        except Exception as e:
            print(f"DuckDuckGo fallback search failed: {e}")

    # Deduplicate by URL while preserving order.
    deduped = []
    seen = set()
    for inf in influencers:
        link = inf.get("link", "")
        if not link or link in seen:
            continue
        seen.add(link)
        deduped.append(inf)

    return deduped[:15]

async def run_influencer_search(parsed_profile: dict, brand_voice: dict) -> dict[str, Any]:
    """
    Agent 3: Identify idols and influences for the user.
    """
    try:
        # Step 1: Generate optimal search query
        query = await generate_search_query(parsed_profile, brand_voice)
        
        # Step 2: Search for profiles
        influencers = await search_influencers(query)
        
        return {
            "status": "success",
            "output": {
                "search_query_used": query,
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
