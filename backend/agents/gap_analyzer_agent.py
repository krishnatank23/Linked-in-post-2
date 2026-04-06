import os
import json
import traceback
from typing import Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.groq_guard import guarded_groq_ainvoke

load_backend_env()

GAP_ANALYSIS_PROMPT = """You are a senior personal branding strategist and LinkedIn content expert.
Your goal is to analyze the "gap" between a user and their industry "idol" (influencer) and provide a concrete content strategy to bridge that gap.

USER DATA:
Profile: {user_profile}
Brand Voice: {brand_voice}

INFLUENCER DATA:
{influencer_data}

Provide a structured analysis in JSON format:

{{
    "gap_analysis": {{
        "profile_completeness_gap": "Comparison of profile impact and authority (1-2 sentences)",
        "content_authority_gap": "Analysis of the gap in perceived expertise and thought leadership",
        "engagement_gap": "Differences in how the influencer engages vs the user's current potential",
        "key_missing_elements": ["List of 3-5 specific things the influencer has that the user is missing"]
    }},
    "content_strategy": {{
        "content_pillars": ["3 core themes the user should own to bridge the gap"],
        "proposed_schedule": [
            {{
                "day": "Day 1",
                "post_type": "e.g., Educational / Storytelling",
                "topic": "Specific topic idea",
                "goal": "Why this post helps bridge the gap"
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
        "tone_adjustment": "Specific advice on how to tweak their voice to match industry leaders"
    }},
    "action_plan": [
        "Immediate step 1 to improve visibility",
        "Immediate step 2 to build authority",
        "Immediate step 3 to increase network quality"
    ]
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
            api_key=os.getenv("GROQ_API_KEY"),
        )
        
        prompt = ChatPromptTemplate.from_template(GAP_ANALYSIS_PROMPT)
        chain = prompt | llm
        
        response = await guarded_groq_ainvoke(
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
