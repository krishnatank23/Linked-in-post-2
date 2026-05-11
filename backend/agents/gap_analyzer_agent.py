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

GAP_ANALYSIS_PROMPT = """You are a senior personal branding strategist and LinkedIn content expert.
Your goal is to analyze the gap between the user and ONE selected influencer, then produce a concrete and measurable strategy.

USER DATA:
Profile: {user_profile}
Brand Voice: {brand_voice}

INFLUENCER DATA:
{influencer_data}

Optional supporting context may also be embedded in the influencer data, such as:
- manual_profile_text: text extracted from an uploaded influencer profile PDF
- manual_post_samples / manual_posts_text: pasted posts from that influencer
- user_past_posts: the user's own recent posts for emotion, cadence, and voice matching

When this extra context is present, use it to refine authority, tone, cadence, and emotional style comparisons.

Rules:
- Be specific and evidence-oriented, avoid generic advice.
- Compare user profile + likely content posture against influencer strengths.
- Use domain-aware recommendations (user domain and niche must drive the strategy).
- Focus on professional, insightful, meaningful communication style.
- DYNAMIC FREQUENCY: Calculate posting frequency (2-5 days/week) based on the overall gap score. Higher gap = higher frequency.

Provide JSON in this exact structure:

{{
    "influencer_snapshot": {{
        "name": "Influencer name/title",
        "positioning_summary": "1-2 lines on why this influencer is strong"
    }},
    "gap_analysis": {{
        "profile_completeness_gap": "Specific comparison of profile impact and authority",
        "content_authority_gap": "Specific thought-leadership/content gap",
        "engagement_gap": "Specific audience interaction/engagement gap",
        "posting_consistency_gap": "Specific cadence and consistency gap",
        "domain_positioning_gap": "Specific niche/domain positioning gap",
        "key_missing_elements": ["5-8 concrete missing elements"]
    }},
    "gap_scores": {{
        "profile_gap_score": 0,
        "authority_gap_score": 0,
        "engagement_gap_score": 0,
        "consistency_gap_score": 0,
        "domain_positioning_gap_score": 0,
        "overall_gap_score": 0
    }},
    "comparison_matrix": {{
        "profile": {{
            "user_state": "Current user state",
            "influencer_state": "Influencer state",
            "delta": "What must change"
        }},
        "content": {{
            "user_state": "Current user state",
            "influencer_state": "Influencer state",
            "delta": "What must change"
        }},
        "engagement": {{
            "user_state": "Current user state",
            "influencer_state": "Influencer state",
            "delta": "What must change"
        }}
    }},
    "content_strategy": {{
        "content_pillars": ["4-6 core domain themes the user should own"],
        "interactive_content_formats": ["Poll", "Debate post", "Ask-me-anything", "Case breakdown"],
        "recommended_post_types": ["Educational", "Thought Leadership", "Interactive", "Case Study"],
        "proposed_schedule": [
            "// Array of 2 to 5 specific post objects tailored to the gap. DO NOT always return 3 items.",
            {{
                "day": "Specific Day (e.g. Monday)",
                "post_type": "The type of post",
                "topic": "Specific domain topic",
                "goal": "How this closes a specific gap"
            }}
        ],
        "recommended_days": ["List of recommended days, length matching frequency"],
        "recommended_time_utc": "Preferred time (e.g. 09:00)",
        "day_selection_rationale": "Why these days fit the user gap profile",
        "tone_adjustment": "How to keep professional tone while adding authority and interaction"
    }},
    "action_plan": [
        "Immediate step 1",
        "Immediate step 2",
        "Immediate step 3",
        "Immediate step 4",
        "Immediate step 5"
    ],
    "reminder_plan": {{
        "reminder_days": ["List of days matching the posting schedule"],
        "reminder_time_utc": "Preferred reminder time",
        "why_this_reminder_cadence": "Why these reminders are needed for consistency"
    }}
}}

Return ONLY the JSON object, no markdown fences, no extra text.
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
