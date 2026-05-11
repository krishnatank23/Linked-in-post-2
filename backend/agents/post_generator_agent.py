import os
import json
import re
import traceback
from typing import Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke, _current_user_id
from agents.json_utils import parse_llm_json_content

load_backend_env()


def _get_groq_api_key() -> str | None:
    """Support the Groq API key env var."""
    return os.getenv("GROQ_API_KEY")

POST_GENERATION_PROMPT = """You are a world-class LinkedIn ghostwriter and content strategist with expertise in professional, high-impact domain content.

Your task: Generate EXACTLY 2 completely unique LinkedIn posts tailored to this user's domain and the specific gaps identified in gap analysis. You must decide topics and angles from the gap evidence.

USER PROFILE:
{user_profile}

BRAND VOICE:
{brand_voice}

GAP ANALYSIS & STRATEGY:
{gap_analysis}

USER PAST POSTS (FOR EMOTION AND VOICE MATCHING):
{user_past_posts}

EXTRACTED VOICE & EMOTION SIGNATURE (USE THIS AS A HARD STYLE CONSTRAINT):
{voice_emotion_signature}

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

DAY & REMINDER STRATEGY RULES (MANDATORY):

1. Choose posting days based on the gap analysis intensity:
- High consistency/engagement gap: 4-5 posts/week
- Medium gap: 3-4 posts/week
- Lower gap: 2-3 posts/week

2. Include explicit rationale for why selected days and time support improvement.
3. Keep schedule realistic and repeatable for long-term consistency.

═══════════════════════════════════════════════════════════════════

HUMANIZATION & QUALITY RULES (CRITICAL):

- Treat EXTRACTED VOICE & EMOTION SIGNATURE as the primary style guide.
- Analyze the USER PAST POSTS (if provided) and strictly match the emotion, cadence, sentence structure, and specific vocabulary/phrases the user uses. Maintain their exact authentic voice.
- SPECIFICITY OVER VAGUENESS: Do not use broad generalizations. Use highly specific scenarios, domain-specific terminology, and relatable pain points drawn from the user's profile and gap analysis.
- WRITE LIKE YOU TALK: Write like a human having a smart, casual conversation with peers over coffee.
- FORMATTING: Use generous white space. Keep paragraphs to 1-3 sentences maximum. Use line breaks to create a reading rhythm.
- NO AI SPEAK: Do NOT use phrases like "In today's fast-paced digital world," "It's more important than ever," or "Navigating the complexities of..."
- BANNED WORDS: 'leverage', 'streamline', 'delve', 'tapestry', 'unleash', 'empower', 'synergy', 'testament', 'pivotal'.
- DO NOT use em dashes (—), use commas or periods instead.
- NO EMOJIS in the post content under any circumstances.
- Speak directly to the USER's specific target audience and address their exact problems.

HOOK & ENGAGEMENT (THE FIRST 3 LINES):
- Line 1 (The Hook): A bold claim, a counter-intuitive thought, a stark metric, or a direct pattern-interrupt. MUST be under 12 words.
- Line 2 (The Re-Hook): Provide context or build tension immediately.
- Line 3: Transition smoothly into the core story or lesson.
- The Ending: End with a highly specific, single question that requires a thoughtful answer (not a simple "yes/no" or "What do you think?").
- Focus on providing immense, actionable value to the reader.

═══════════════════════════════════════════════════════════════════

OUTPUT FORMAT (JSON ONLY):

{{
    "posting_frequency": "3 posts per week",
    "posting_schedule_days": ["Monday", "Wednesday", "Friday"],
    "posting_time_utc": "11:00",
    "posting_schedule_rationale": "Why these days and time were chosen based on identified gaps",
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
            "interaction_goal": "What engagement behavior this post is trying to create",
            "content": "Full, complete post text (minimum 3-5 paragraphs)"
        }},
        {{
            "type": "Second post type chosen (MUST BE DIFFERENT FROM FIRST)",
            "topic": "Completely different specific topic",
            "reasoning": "Why this topic complements the first and addresses different aspect",
            "interaction_goal": "What engagement behavior this post is trying to create",
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


VOICE_EMOTION_EXTRACTION_PROMPT = """You are a precise writing-style analyst.

Analyze the user's recent LinkedIn posts and extract a reusable style signature.

USER POSTS:
{user_past_posts}

Return ONLY valid JSON in this exact structure:
{{
  "primary_tone": "...",
  "secondary_tone": "...",
  "dominant_emotions": ["...", "..."],
  "sentence_rhythm": "short|mixed|long",
  "hook_pattern": "how the user tends to open posts",
  "cta_pattern": "how the user tends to end posts",
  "vocabulary_markers": ["word/phrase", "word/phrase"],
  "authenticity_markers": ["style trait", "style trait"],
  "do_not_change": ["style element to preserve", "style element to preserve"]
}}
"""


def _prepare_recent_posts(user_past_posts: str | None) -> dict[str, Any]:
    """Normalize manual pasted posts and limit to last 10 items."""
    if not user_past_posts or not user_past_posts.strip():
        return {
            "count": 0,
            "posts": [],
            "formatted": "None provided.",
        }

    raw = user_past_posts.strip()
    chunks = [p.strip() for p in re.split(r"\n\s*\n+", raw) if p.strip()]

    # If user pasted line-separated short posts instead of paragraph blocks.
    if len(chunks) <= 1:
        line_posts = [ln.strip("-* \t") for ln in raw.splitlines() if ln.strip()]
        if len(line_posts) > 1:
            chunks = line_posts

    posts = chunks[:10]
    formatted = "\n\n".join([f"Post {idx + 1}:\n{text}" for idx, text in enumerate(posts)])

    return {
        "count": len(posts),
        "posts": posts,
        "formatted": formatted if formatted else "None provided.",
    }





async def run_post_generation(user_profile: dict, brand_voice: dict, gap_analysis: dict, user_past_posts: str | None = None) -> dict[str, Any]:
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
            model="llama3-8b-8192",
            temperature=0.8,  # Slightly higher for more creative autonomy
            groq_api_key=_get_groq_api_key(),
        )

        # First extract a deterministic voice/emotion signature from pasted posts.
        normalized_past_posts = _prepare_recent_posts(user_past_posts)
        voice_emotion_signature: dict[str, Any] = {
            "primary_tone": "Professional",
            "secondary_tone": "Conversational",
            "dominant_emotions": ["confident", "helpful"],
            "sentence_rhythm": "mixed",
            "hook_pattern": "Clear problem statement",
            "cta_pattern": "Open-ended professional question",
            "vocabulary_markers": [],
            "authenticity_markers": ["plain language"],
            "do_not_change": ["direct tone", "human readability"],
            "source": "default_fallback_no_posts",
        }

        if normalized_past_posts["count"] > 0:
            try:
                extractor_llm = ChatGroq(
                    model="llama3-8b-8192",
                    temperature=0.2,
                    groq_api_key=_get_groq_api_key(),
                )
                extractor_prompt = ChatPromptTemplate.from_template(VOICE_EMOTION_EXTRACTION_PROMPT)
                extractor_chain = extractor_prompt | extractor_llm
                extractor_response = await guarded_llm_ainvoke(
                    extractor_chain,
                    {"user_past_posts": normalized_past_posts["formatted"]},
                    timeout_seconds=45,
                )

                parsed_signature = parse_llm_json_content(extractor_response.content)
                if isinstance(parsed_signature, dict):
                    voice_emotion_signature = {**parsed_signature, "source": "user_past_posts"}
            except Exception as extraction_error:
                print(f"[POST GENERATOR] Voice/emotion extraction fallback used: {extraction_error}")
        
        prompt = ChatPromptTemplate.from_template(POST_GENERATION_PROMPT)
        chain = prompt | llm
        
        response = await guarded_llm_ainvoke(
            chain,
            {
                "user_profile": json.dumps(user_profile, indent=2),
                "brand_voice": json.dumps(brand_voice, indent=2),
                "gap_analysis": json.dumps(gap_analysis, indent=2),
                "user_past_posts": normalized_past_posts["formatted"],
                "voice_emotion_signature": json.dumps(voice_emotion_signature, indent=2),
                "previous_posts": previous_posts_text,
                "previous_types": previous_types_text,
            },
            timeout_seconds=90,
        )
        
        content = response.content.strip()
        if not content:
            return {
                "status": "error",
                "output": None,
                "error": "The AI model returned an empty response during post generation. Please try again.",
            }

        post_results = parse_llm_json_content(content)
        if not isinstance(post_results, dict):
            raise json.JSONDecodeError("Post generator output was not a JSON object", str(post_results), 0)
        if isinstance(post_results, dict):
            post_results["voice_emotion_analysis"] = voice_emotion_signature
            post_results["user_past_posts_used_count"] = normalized_past_posts["count"]
        
        # Validate that we got exactly 2 posts
        posts = post_results.get("posts", [])
        if len(posts) != 2:
            print(f"[POST GENERATOR] Warning: Expected 2 posts but got {len(posts)}. Adjusting...")
            if len(posts) > 2:
                post_results["posts"] = posts[:2]
            elif len(posts) == 1:
                # If only 1 post, duplicate with variation instruction not ideal, but keep as is
                pass
        
        print(
            f"[POST GENERATOR] Generated {len(post_results.get('posts', []))} posts with types: "
            f"{[p.get('type') for p in post_results.get('posts', [])]} | "
            f"voice posts used: {normalized_past_posts['count']}"
        )
        
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
