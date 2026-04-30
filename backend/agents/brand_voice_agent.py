import os
import json
import traceback
import asyncio
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke

load_backend_env()


def _get_openai_api_key() -> str | None:
    """Support both the standard and legacy OpenAI env var names."""
    return os.getenv("OPENAI_API_KEY") or os.getenv("OPEN_AI_API_KEY")

BRAND_VOICE_PROMPT = """You are an expert personal branding strategist and career coach.

Based on the following structured profile data of a professional, create a comprehensive personal brand analysis.

Profile Data:
{profile_data}

Industry Context (from web search):
{industry_context}

Generate the following in a structured JSON format:

{{
    "user_persona": {{
        "professional_identity": "A 2-3 sentence description of who this person is professionally",
        "core_strengths": ["Top 5-7 specific strengths derived from their experience"],
        "expertise_areas": ["Their key areas of expertise with specificity"],
        "unique_value_proposition": "What makes this person stand out in their field (2-3 sentences)",
        "target_audience": "Who would benefit most from this person's content and expertise",
        "career_trajectory": "Summary of their career journey and growth pattern",
        "personality_traits": ["Professional personality traits inferred from their profile"],
        "signature_topics": ["Specific recurring topics this person should become known for"],
        "credibility_assets": ["Proof points: metrics, awards, projects, publications, leadership moments"],
        "audience_pain_points": ["Top audience problems this person can solve with content"]
    }},
    "brand_voice": {{
        "tone": "Primary communication tone (e.g., authoritative yet approachable)",
        "style": "Writing style recommendation (e.g., data-driven storytelling)",
        "vocabulary_level": "Recommended vocabulary level for their audience",
        "content_themes": ["5-7 content themes they should focus on"],
        "do_list": ["Things they SHOULD do in their personal branding"],
        "dont_list": ["Things they should AVOID in their personal branding"],
        "sample_taglines": ["3-4 potential LinkedIn headline/tagline options"],
        "communication_pillars": ["3-4 pillars their communication should revolve around"],
        "emotion_profile": {{
            "primary_emotions": ["Emotion tones this person should consistently express"],
            "intensity": "Low/Medium/High guidance",
            "when_to_use": "Situational guidance for emotion usage"
        }},
        "storytelling_patterns": ["Narrative structures they should repeatedly use"],
        "authority_signals": ["Signals that increase trust (data, frameworks, first-hand lessons)"]
    }},
    "professional_summary": {{
        "short_bio": "A compelling 2-3 sentence professional bio",
        "elevator_pitch": "A 30-second elevator pitch",
        "linkedin_about": "A recommended LinkedIn About section (3-4 paragraphs)",
        "key_hashtags": ["10-15 relevant hashtags for their niche"]
    }},
    "content_blueprint": {{
        "pillar_to_post_angles": [
            {{
                "pillar": "Content pillar",
                "angles": ["3-5 post angles under this pillar"]
            }}
        ],
        "proof_snippets": ["Specific one-line proof statements extracted from profile"],
        "cta_bank": ["10 practical CTA options aligned with their audience"],
        "hook_bank": ["10 opening hook templates in their voice"]
    }},
    "evidence_map": {{
        "claims_supported_by_profile": ["Important claims with source evidence from profile data"],
        "claims_to_avoid_without_proof": ["Statements that would feel generic or unsupported"]
    }}
}}

Be specific, actionable, and insightful. Avoid generic advice.
Ground recommendations in concrete evidence from the profile data.
Return ONLY the JSON object, no markdown fences, no extra text.
"""


async def search_industry_context(profile_data: dict) -> str:
    """Use DuckDuckGo to search for industry context with timeout protection."""
    try:
        from duckduckgo_search import DDGS

        # Build search query from profile data
        industry = profile_data.get("industry", "")
        current_role = profile_data.get("current_role", "")
        expertise = profile_data.get("expertise_areas", [])

        search_query = f"{current_role} {industry} LinkedIn personal branding trends 2024"
        if expertise:
            search_query += f" {' '.join(expertise[:2])}"

        # Run search with timeout to prevent blocking
        def _search_sync():
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(search_query, max_results=5):
                    results.append(f"- {r.get('title', '')}: {r.get('body', '')}")
            return results

        try:
            results = await asyncio.wait_for(
                asyncio.to_thread(_search_sync),
                timeout=10  # 10-second timeout for DuckDuckGo search
            )
            return "\n".join(results) if results else "No additional industry context found."
        except asyncio.TimeoutError:
            print("[WARN] Industry context search timed out after 10s, skipping")
            return "Industry context search timed out; proceeding without external research."

    except Exception as e:
        print(f"[WARN] Industry search failed: {str(e)}")
        return f"Industry search unavailable: {str(e)}"


async def run_brand_voice_agent(parsed_profile: dict) -> dict[str, Any]:
    """
    Agent 2: Generate brand voice and detailed persona from parsed resume data.
    Returns a dict with status, output, and optional error.
    """
    try:
        print(f"[DEBUG] Brand Voice Agent: Starting brand voice generation for profile")
        # Step 1: Search for industry context
        print(f"[DEBUG] Brand Voice Agent: Searching industry context...")
        industry_context = await search_industry_context(parsed_profile)
        print(f"[DEBUG] Brand Voice Agent: Industry context retrieved ({len(industry_context)} chars)")

        # Step 2: Use OpenAI LLM to generate brand voice and persona
        llm = ChatOpenAI(
            model=os.getenv("BRAND_VOICE_MODEL", os.getenv("OPEN_AI_MODEL", "gpt-4-turbo")),
            temperature=0.4,
            api_key=_get_openai_api_key(),
        )

        prompt = ChatPromptTemplate.from_template(BRAND_VOICE_PROMPT)
        chain = prompt | llm

        print(f"[DEBUG] Brand Voice Agent: Invoking LLM for brand voice generation (timeout: 60s)...")
        response = await guarded_llm_ainvoke(
            chain,
            {
                "profile_data": json.dumps(parsed_profile, indent=2),
                "industry_context": industry_context,
            },
            timeout_seconds=60,
        )
        print(f"[DEBUG] Brand Voice Agent: LLM response received ({len(response.content)} chars)")

        # Parse the JSON response
        content = response.content.strip()
        # Clean up potential markdown fences
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        if content.startswith("json"):
            content = content[4:].strip()
        print(f"[DEBUG] Brand Voice Agent: Successfully parsed brand voice JSON")

        brand_data = json.loads(content)

        return {
            "status": "success",
            "output": {
                "brand_analysis": brand_data,
                "industry_context_used": industry_context[:500],
            },
            "error": None,
        }

    except json.JSONDecodeError as e:
        return {
            "status": "error",
            "output": {"raw_response": content if 'content' in dir() else "N/A"},
            "error": f"Failed to parse brand voice response as JSON: {str(e)}",
        }
    except Exception as e:
        err = str(e)
        if "rate limit" in err.lower() or "tokens per day" in err.lower() or "429" in err:
            return {
                "status": "error",
                "output": None,
                "error": (
                    "Groq API token limit reached during Brand Voice Agent. "
                    "Please wait for Groq retry window, or reduce token usage / upgrade plan."
                ),
            }
        return {
            "status": "error",
            "output": None,
            "error": f"Brand voice agent failed: {str(e)}\n{traceback.format_exc()}",
        }
