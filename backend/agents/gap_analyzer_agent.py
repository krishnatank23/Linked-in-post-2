import os
import json
import traceback
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke
from agents.json_utils import parse_llm_json_content
from agents.markdown_utils import format_profile_markdown_short, format_brand_voice_markdown, format_influencer_markdown

load_backend_env()


def _get_deepseek_api_key() -> str | None:
    """Support the DeepSeek API key env var."""
    return os.getenv("DEEPSEEK_API_KEY")


def _get_groq_api_key() -> str | None:
    """Support the Groq API key env var."""
    return os.getenv("GROQ_API_KEY")

GAP_ANALYSIS_PROMPT = """You are a senior LinkedIn branding strategist.
Compare the USER with the INFLUENCER and provide a measurable gap analysis and strategy.

USER: {user_profile}
BRAND VOICE: {brand_voice}
INFLUENCER: {influencer_data}

Rules:
- STRICT PHRASING: You must describe what the USER lacks compared to the INFLUENCER. Do not critique the influencer. Always phrase it as "Compared to [Influencer Name], your profile lacks..." or "While the influencer has X, you currently have Y."
- Identify specific content, authority, and engagement gaps of the USER.
- DYNAMIC FREQUENCY: Calculate frequency (2-5 days/week) based on gap severity.
- Be concrete and evidence-oriented.

JSON Structure:
{{
    "influencer_snapshot": {{ "name": "...", "positioning_summary": "..." }},
    "gap_analysis": {{
        "profile_completeness_gap": "...",
        "content_authority_gap": "...",
        "engagement_gap": "...",
        "posting_consistency_gap": "...",
        "key_missing_elements": ["List of 5 elements"]
    }},
    "gap_scores": {{
        "profile_gap_score": 0-100,
        "authority_gap_score": 0-100,
        "engagement_gap_score": 0-100,
        "overall_gap_score": 0-100,
        "score_explanation": "A short 1-2 sentence explanation of what these scores mean (e.g., 'A score of 100 means your profile perfectly matches the influencer. Lower scores indicate significant gaps you need to close.')"
    }},
    "content_strategy": {{
        "content_pillars": ["4 themes"],
        "recommended_post_types": ["Educational", "Thought Leadership", "Interactive"],
        "proposed_schedule": [
           {{ "day": "Monday", "post_type": "...", "topic": "...", "goal": "..." }}
        ],
        "recommended_days": ["Mon", "Wed", "Fri"],
        "recommended_time_utc": "11:00",
        "day_selection_rationale": "...",
        "tone_adjustment": "..."
    }},
    "action_plan": ["Step 1", "Step 2", "Step 3"],
    "reminder_plan": {{
        "reminder_days": ["Mon", "Wed", "Fri"],
        "reminder_time_utc": "11:00"
    }}
}}

Return ONLY the JSON object. No intro, no markdown fences.
"""

async def run_gap_analysis(user_profile: dict, brand_voice: dict, influencer_data: dict, user_past_posts: str | None = None) -> dict[str, Any]:
    """
    Agent 4: Perform gap analysis between user and influencer, then generate content strategy.
    """
    try:
        # Step 2: Build the LLM chain with optional fallback
        # ds_key = _get_deepseek_api_key()
        groq_key = _get_groq_api_key()
        prompt = ChatPromptTemplate.from_template(GAP_ANALYSIS_PROMPT)
        
        chains = []
        # if ds_key:
        #     primary_llm = ChatOpenAI(
        #         model=os.getenv("GAP_ANALYZER_MODEL", "deepseek-v4-flash"),
        #         temperature=0.7,
        #         api_key=ds_key,
        #         base_url="https://api.deepseek.com",
        #         model_kwargs={"response_format": {"type": "json_object"}},
        #     )
        #     chains.append(prompt | primary_llm)
        
        if groq_key:
            fallback_llm = ChatGroq(
                model=os.getenv("GROQ_MODEL_LITE", "llama-3.1-8b-instant"),
                temperature=0.7,
                groq_api_key=groq_key,
                model_kwargs={"response_format": {"type": "json_object"}},
            )
            chains.append(prompt | fallback_llm)

        if not chains:
            return {
                "status": "error",
                "output": None,
                "error": "No AI API keys (DeepSeek or Groq) found for gap analyzer.",
            }

        chain = chains[0].with_fallbacks(chains[1:]) if len(chains) > 1 else chains[0]
        
        print(f"[GapAnalyzer] Running LITE analysis for influencer: {influencer_data.get('title') or influencer_data.get('name')}")
        response = await guarded_llm_ainvoke(
            chain,
            {
                "user_profile": format_profile_markdown_short(user_profile),
                "brand_voice": format_brand_voice_markdown(brand_voice),
                "influencer_data": format_influencer_markdown(influencer_data),
                "user_past_posts": (user_past_posts or "None provided")[:1000],
            },
            timeout_seconds=90,
        )
        
        content = response.content.strip()
        if not content:
            return {
                "status": "error",
                "output": None,
                "error": "The AI model returned an empty response during gap analysis. Please try again.",
            }

        analysis_results = parse_llm_json_content(content)
        if not isinstance(analysis_results, dict):
            raise json.JSONDecodeError("Gap analysis output was not a JSON object", str(analysis_results), 0)
        
        return {
            "status": "success",
            "output": analysis_results,
            "error": None,
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "output": None,
            "error": f"Gap analysis failed: {str(e)}\n{traceback.format_exc()}",
        }
