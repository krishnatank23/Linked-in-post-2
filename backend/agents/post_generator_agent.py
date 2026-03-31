import os
import json
import traceback
import requests
from typing import Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
from agents.groq_guard import guarded_groq_ainvoke

load_dotenv()

POST_GENERATION_PROMPT = """You are a world-class LinkedIn ghostwriter and digital strategist.
Your goal is to generate a comprehensive LinkedIn content plan and ready-to-post content for a user based on their profile, brand voice, and the gap analysis between them and an industry leader.

USER PROFILE:
{user_profile}

BRAND VOICE:
{brand_voice}

GAP ANALYSIS & STRATEGY:
{gap_analysis}

MARKET TREND CONTEXT:
Identify the latest trends in the user's industry (especially AI-related moves, if applicable). Use your internal knowledge to factor in what's currently "hot" or "viral" in this professional niche.

HUMANIZATION RULES (CRITICAL):
- Write like a human. Keep it professional but conversational.
- Use varied sentence structures—some short, some long.
- DO NOT use em dashes (—).
- DO NOT use buzzwords like 'streamlined', 'delves', 'tapestry', 'leverage', or 'unleash'.
- Avoid sounding like a press release or a corporate brochure.
- Be clear, direct, and natural, like you're writing to a smart friend.
- Do NOT use emojis in the post content.

ENGLISH QUALITY RULES (CRITICAL):
- Use proper, grammatically correct English.
- Keep wording simple, clear, and polished.
- Avoid awkward phrasing, repetition, and robotic sentence patterns.
- Ensure punctuation, capitalization, and paragraph flow are correct.

INTERACTIVITY RULES (CRITICAL):
- Start each post with a strong hook in the first line.
- Include at least one engaging line that invites discussion.
- End each post with a clear call-to-action question to encourage comments.
- Make the post feel audience-focused, not self-focused.

TYPES OF POSTS TO CONSIDER:
1. Educational (How-to, tips, industry insights).
2. Storytelling (Personal experience, lessons learned).
3. Funny/Relatable (Professional humor, memes descriptions, light-hearted takes).
4. Trend-based (News, AI updates, what's new in the market).
5. Interactive (Poll questions, asking for opinions).

OUTPUT FORMAT (JSON ONLY):
{{
    "posting_frequency": "e.g., 3 times per week",
    "posting_schedule_days": ["Monday", "Wednesday"],
    "posting_time_utc": "14:00",
    "recommended_post_types": ["Type 1", "Type 2", "Type 3"],
    "content_strategy_summary": "1-2 sentences on the overall approach",
    "posts": [
        {{
            "type": "Educational / Trend-based / Funny / etc.",
            "content": "The full post text following humanization rules...",
            "goal": "Bridge the gap / Increase engagement / Show authority"
        }},
        {{
            "type": "...",
            "content": "...",
            "goal": "..."
        }},
        {{
            "type": "...",
            "content": "...",
            "goal": "..."
        }}
    ]
}}

Return ONLY the JSON object. No markdown, no extra text.
"""





async def run_post_generation(user_profile: dict, brand_voice: dict, gap_analysis: dict) -> dict[str, Any]:
    """
    Agent 5: Generate specific LinkedIn posts based on gap analysis, brand voice, and market trends.
    """
    try:
        llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            temperature=0.7,
            api_key=os.getenv("GROQ_API_KEY"),
        )
        
        prompt = ChatPromptTemplate.from_template(POST_GENERATION_PROMPT)
        chain = prompt | llm
        
        response = await guarded_groq_ainvoke(
            chain,
            {
                "user_profile": json.dumps(user_profile, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
                "gap_analysis": json.dumps(gap_analysis, indent=2),
            },
            timeout_seconds=90,
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
            
        post_results = json.loads(content)
        
        return {
            "status": "success",
            "output": post_results,
            "error": None,
        }
    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"Post generation failed: {str(e)}\n{traceback.format_exc()}",
        }
