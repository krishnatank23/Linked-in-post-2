import os
import json
import traceback
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke

load_backend_env()

GAP_ANALYSIS_PROMPT = """You are a senior personal branding strategist and LinkedIn content expert.
Your goal is to analyze the gap between the user and ONE selected influencer, then produce a concrete and measurable strategy.

USER DATA:
Profile: {user_profile}
Brand Voice: {brand_voice}

INFLUENCER DATA:
{influencer_data}

Rules:
- Be specific and evidence-oriented, avoid generic advice.
- Compare user profile + likely content posture against influencer strengths.
- Use domain-aware recommendations (user domain and niche must drive the strategy).
- Focus on professional, insightful, meaningful communication style.

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
            {{
                "day": "Day 1",
                "post_type": "Educational / Storytelling / Interactive / Thought Leadership",
                "topic": "Specific domain topic",
                "goal": "How this closes a specific gap"
            }},
            {{
                "day": "Day 3",
                "post_type": "...",
                "topic": "...",
                "goal": "..."
            }},
            {{
                "day": "Day 5",
                "post_type": "...",
                "topic": "...",
                "goal": "..."
            }}
        ],
        "recommended_days": ["Monday", "Wednesday", "Friday"],
        "recommended_time_utc": "11:00",
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
        "reminder_days": ["Monday", "Wednesday", "Friday"],
        "reminder_time_utc": "11:00",
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
        llm = ChatOpenAI(
            model=os.getenv("GAP_ANALYZER_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o")),
            temperature=0.4,
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        
        prompt = ChatPromptTemplate.from_template(GAP_ANALYSIS_PROMPT)
        chain = prompt | llm
        
        response = await guarded_llm_ainvoke(
            chain,
            {
                "user_profile": json.dumps(user_profile, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
                "influencer_data": json.dumps(influencer_data, indent=2),
            },
            timeout_seconds=60,
        )
        
        content = response.content.strip()
        # Clean up potential markdown fences
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        if content.startswith("json"):
            content = content[4:].strip()
            
        analysis_results = json.loads(content)
        
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
