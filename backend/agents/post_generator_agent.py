import os
import json
import traceback
from typing import Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.groq_guard import guarded_groq_ainvoke, _current_user_id

load_backend_env()

POST_GENERATION_PROMPT = """You are a world-class LinkedIn ghostwriter and content strategist with expertise in creating viral, authentic professional content.

Your task: Generate EXACTLY 2 completely unique LinkedIn posts tailored to this user's professional domain and gap analysis. You will AUTONOMOUSLY decide the best topics and angles based on the user's profile, brand voice, and industry trends.

USER PROFILE:
{user_profile}

BRAND VOICE:
{brand_voice}

GAP ANALYSIS & STRATEGY:
{gap_analysis}

PREVIOUSLY GENERATED POSTS (STRICT AVOIDANCE):
{previous_posts}

PREVIOUS POST TYPES USED:
{previous_types}

═══════════════════════════════════════════════════════════════════

CRITICAL DEDUPLICATION RULES (YOU MUST FOLLOW STRICTLY):

1. NEVER use any of these post types again: {previous_types}
   - If you've used "Educational" before, generate "Storytelling" or "Trend-based" instead
   - Complete variation is MANDATORY - not just different wording

2. AVOID all content from previous posts:
   - Different topics (not the same subject matter)
   - Different angles (approach from completely new perspective)
   - Different stories/examples (no similar case studies or anecdotes)
   - Different data points (don't reuse statistics or findings)
   - Different industries/domains (expand beyond what was covered before)

3. AUTONOMOUSLY decide topics:
   - Analyze the gap and identify 2 COMPLETELY DIFFERENT problem areas
   - Choose topics the user hasn't covered yet
   - Select topics that are relevant to closing the identified gaps
   - Ensure topics complement each other but are distinct

═══════════════════════════════════════════════════════════════════

POST TYPES (Choose 2 DIFFERENT ones):
1. Educational/Actionable (How-to, frameworks, technical tips, step-by-step guides)
2. Storytelling/Personal (Real experience, lessons learned, transformation narrative)
3. Industry Trends/Analysis (Market news, competitive insight, forward-looking analysis)
4. Interactive/Engagement (Questions, polls, debates, audience collaboration)
5. Thought Leadership/Vision (Philosophy, predictions, industry commentary)
6. Case Study/Results (Success story, metrics, before/after transformation)
7. Contrarian/Hot Take (Disagree with common wisdom, challenge assumptions)
8. Inspirational/Motivational (Overcoming challenges, resilience, mindset shifts)

INSTRUCTIONS FOR AUTONOMOUS TOPIC SELECTION:

1. Identify the primary gap from gap analysis (e.g., "User lacks AI adoption thought leadership")
2. Identify secondary gaps (e.g., "Limited community engagement", "No industry positioning")
3. Choose Post 1 type to address primary gap with fresh angle
4. Choose Post 2 type to address secondary gap or explore new domain angle
5. Ensure the two posts create a complete strategy narrative together

EXAMPLE SCENARIO:
- Previous posts: 2x Educational (tips, frameworks), 1x Storytelling
- Gap analysis: Needs thought leadership, needs community engagement
- YOUR CHOICE: Post 1 = Contrarian/Hot Take, Post 2 = Interactive/Engagement
- Result: Fresh content that addresses gaps and uses new post types

═══════════════════════════════════════════════════════════════════

HUMANIZATION & QUALITY RULES (CRITICAL):

- Write like a human having a smart conversation with peers
- Vary sentence structure: Mix short punchy sentences with longer detailed ones
- DO NOT use buzzwords: 'leverage', 'streamline', 'delve', 'tapestry', 'unleash', 'empower'
- DO NOT use em dashes (—), use commas or periods instead
- NO corporate jargon, NO press-release tone, NO marketing speak
- Be authentic, direct, and genuinely conversational
- NO EMOJIS in the post content
- Proper grammar and punctuation throughout

HOOK & ENGAGEMENT:
- Start with a compelling hook that makes readers stop scrolling
- Include thought-provoking lines that invite discussion
- End with a genuine question that encourages comments
- Make it about the reader, not about promoting yourself

═══════════════════════════════════════════════════════════════════

OUTPUT FORMAT (JSON ONLY):

{{
    "posting_frequency": "2 posts per week (biweekly strategy)",
    "posting_schedule_days": ["Monday", "Thursday"],
    "posting_time_utc": "11:00",
    "autonomous_topic_selection_rationale": {{
        "primary_gap_addressed": "Explanation of what gap post 1 addresses",
        "secondary_gap_addressed": "Explanation of what gap post 2 addresses",
        "why_these_types": "Why these 2 post types were chosen over others"
    }},
    "posts": [
        {{
            "type": "First post type chosen",
            "topic": "Specific topic title",
            "reasoning": "Why this topic was chosen based on gaps and domain",
            "content": "Full, complete post text (minimum 3-5 paragraphs)"
        }},
        {{
            "type": "Second post type chosen (MUST BE DIFFERENT FROM FIRST)",
            "topic": "Completely different specific topic",
            "reasoning": "Why this topic complements the first and addresses different aspect",
            "content": "Full, complete post text (minimum 3-5 paragraphs)"
        }}
    ]
}}

REQUIREMENTS:
1. EXACTLY 2 posts (not more, not less)
2. Each post type MUST be different from the first
3. Posts MUST be completely different from any previous posts
4. NO repeated post types from {previous_types}
5. Topics autonomously chosen based on gap analysis and domain knowledge
6. Full post content included (not summaries, not outlines)

Return ONLY valid JSON. No markdown, no explanations, no code fences.
"""





async def run_post_generation(user_profile: dict, brand_voice: dict, gap_analysis: dict) -> dict[str, Any]:
    """
    Agent 5: Generate EXACTLY 2 unique LinkedIn posts based on gap analysis and brand voice.
    Autonomously decides topics and ensures complete variation from previous posts.
    """
    try:
        # Fetch previous posts and their types for deduplication
        previous_posts_text = ""
        previous_types_text = "None (first generation)"
        user_id = _current_user_id.get()
        
        if user_id:
            try:
                from database import async_session
                from models import LinkedInPost
                from sqlalchemy import select
                
                async with async_session() as db:
                    result = await db.execute(
                        select(LinkedInPost).where(LinkedInPost.user_id == user_id).order_by(LinkedInPost.created_at.desc()).limit(10)
                    )
                    previous_posts = result.scalars().all()
                    
                    if previous_posts:
                        posts_list = []
                        types_list = []
                        for post in previous_posts:
                            posts_list.append(f"- Type: {post.post_type}\n  Goal: {post.goal}\n  Content Preview: {post.content[:150]}...")
                            if post.post_type not in types_list:
                                types_list.append(post.post_type)
                        
                        previous_posts_text = "\n".join(posts_list) if posts_list else "No previous posts found."
                        previous_types_text = ", ".join(types_list) if types_list else "None"
                        print(f"[POST GENERATOR] Found {len(previous_posts)} previous posts with types: {previous_types_text}")
                    else:
                        previous_posts_text = "No previous posts found."
                        previous_types_text = "None"
            except Exception as e:
                print(f"[POST GENERATOR] Warning: Could not fetch previous posts: {e}")
                previous_posts_text = "No previous posts available."
                previous_types_text = "Unknown"
        else:
            previous_posts_text = "No previous posts (first generation)."
            previous_types_text = "None"
        
        llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            temperature=0.8,  # Slightly higher for more creative autonomy
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
                "previous_posts": previous_posts_text,
                "previous_types": previous_types_text,
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
        
        # Validate that we got exactly 2 posts
        posts = post_results.get("posts", [])
        if len(posts) != 2:
            print(f"[POST GENERATOR] Warning: Expected 2 posts but got {len(posts)}. Adjusting...")
            if len(posts) > 2:
                post_results["posts"] = posts[:2]
            elif len(posts) == 1:
                # If only 1 post, duplicate with variation instruction not ideal, but keep as is
                pass
        
        print(f"[POST GENERATOR] Generated {len(post_results.get('posts', []))} posts with types: {[p.get('type') for p in post_results.get('posts', [])]}")
        
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
