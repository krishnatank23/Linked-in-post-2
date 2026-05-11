import os
import json
import traceback
from typing import Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke
from agents.json_utils import parse_llm_json_content

load_backend_env()


def _get_groq_api_key() -> str | None:
    """Support the Groq API key env var."""
    return os.getenv("GROQ_API_KEY")

GAP_ANALYSIS_PROMPT = """You are a senior LinkedIn branding strategist.
Compare the USER with the INFLUENCER and provide a measurable gap analysis and strategy.

USER: {user_profile}
BRAND VOICE: {brand_voice}
INFLUENCER: {influencer_data}

Rules:
- Identify specific content, authority, and engagement gaps.
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
        "overall_gap_score": 0-100
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

async def run_gap_analysis(user_profile: dict, brand_voice: dict, influencer_data: dict) -> dict[str, Any]:
    """
    Agent 4: Perform gap analysis between user and influencer, then generate content strategy.
    """
    try:
        llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            temperature=0.4,
            groq_api_key=_get_groq_api_key(),
        )
        
        prompt = ChatPromptTemplate.from_template(GAP_ANALYSIS_PROMPT)
        chain = prompt | llm
        
        print(f"[GapAnalyzer] Running analysis for influencer: {influencer_data.get('title') or influencer_data.get('name')}")
        response = await guarded_llm_ainvoke(
            chain,
            {
                "user_profile": json.dumps(user_profile, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
                "influencer_data": json.dumps(influencer_data, indent=2),
            },
            timeout_seconds=120,
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
