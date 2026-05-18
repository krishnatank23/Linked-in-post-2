import os
import json
import re
import traceback
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from env_config import load_backend_env
from agents.llm_guard import guarded_llm_ainvoke, _current_user_id
from agents.json_utils import parse_llm_json_content

load_backend_env()


def _get_deepseek_api_key() -> str | None:
    """Support the DeepSeek API key env var."""
    return os.getenv("DEEPSEEK_API_KEY")


def _get_groq_api_key() -> str | None:
    """Support the Groq API key env var."""
    return os.getenv("GROQ_API_KEY")


PROMPT_GENERATION_PROMPT = """You are a world-class LinkedIn content strategist and master of authentic professional branding.

Your task: Generate a high-impact, strategic, and hyper-personalized prompt that the user can use to generate viral-potential, domain-authoritative LinkedIn posts.

This prompt must be a "Single Master Prompt" that acts as a complete identity and strategy guide. It should capture:
- The user's exact professional domain and authority positioning
- Their unique, non-generic voice and emotional resonance
- Current, trendy industry themes and pattern-interrupting opportunities
- Specific gaps identified in their content strategy
- Highly effective hook patterns and engagement triggers specific to their niche

INPUT CONTEXT:

USER PROFESSIONAL PROFILE:
{user_profile}

USER BRAND VOICE & PERSONA:
{brand_voice}

GAP ANALYSIS & CONTENT STRATEGY:
{gap_analysis}

USER'S AUTHENTIC PAST POSTS (FOR VOICE MATCHING):
{user_past_posts}

VOICE & EMOTION SIGNATURE:
{voice_emotion_signature}

PREVIOUSLY GENERATED PROMPTS (AVOID REPEATING):
{previous_posts}

═══════════════════════════════════════════════════════════════════

YOUR TASK:
{target_day_instruction}
Analyze all the above context and generate a detailed, structured output that culminates in a "Master Generation Prompt".

1. **Hyper-Specific Domain Authority**
   - Define their niche with surgical precision
   - Identify the "Trendy" topics and emerging debates in their field right now
   - Formulate a unique "Contrarian Angle" that sets them apart from the noise

2. **Authentic Voice & Emotional Signature**
   - Deeply analyze the provided voice signature and past posts
   - Capture their exact sentence cadence, vocabulary, and emotional "vibe"
   - Ensure the voice sounds human, not like an AI generated profile

3. **Master Generation Prompt**
   - Create a highly detailed, comprehensive "Master Bible" prompt.
   - It should act as a complete identity and strategy guide for the LLM to write the perfect post.
   - Include exact persona, target audience, brand voice rules, do's and don'ts, formatting rules, and the specific strategic topic/trend to cover.
OUTPUT FORMAT (JSON ONLY):

{{
    "user_domain": "The user's primary professional domain and authority niche",
    "user_positioning": "Their unique, trendy positioning within the domain (2-3 sentences)",
    "target_audience": "Who they should be speaking to (be specific and demographic-focused)",
    "authentic_voice_profile": "A master summary of their voice, tone, and emotional signature (3-4 sentences)",
    "current_domain_trends": [
        "Trendy industry topic 1",
        "Trendy industry topic 2"
    ],
    "posting_frequency": "Recommended frequency as a plain number string (e.g., '3' or '4')",
    "posting_schedule_days": ["Monday", "Tuesday", "Thursday", "Friday"],
    "posting_time_utc": "Optimal posting time (e.g., '13:00')",
    "content_strategy_pillars": [
        {{
            "pillar": "Authority Building / Thought Leadership",
            "focus": "Addressing [Specific Gap]",
            "why_important": "Why this closes their specific authority gap"
        }},
        {{
            "pillar": "...",
            "focus": "...",
        }}
    ],
    "post_generation_prompt": "A massive, 500+ word 'Master Bible' prompt that the user can paste into an AI. It MUST be structured with clear markdown headings (e.g., ### Context, ### Target Audience, ### Brand Voice & Tone, ### Do's and Don'ts, ### Formatting Rules, ### Today's Topic). **CRITICAL: You MUST use double line breaks (\\n\\n) before and after every heading so the text is properly spaced and readable.** It must comprehensively detail their exact persona, the specific strategic topic/trend to cover today, and exact engagement hooks to use. Make it extremely long, robust, and professional.",
    "dos_and_donts": {{
        "do_list": [
            "Specific trendy action for their domain",
            "Authentic voice guidance",
            "Specific hook strategy",
            "etc..."
        ],
        "dont_list": [
            "Banned AI cliché",
            "Off-brand tone marker",
            "Ineffective engagement tactic",
            "etc..."
        ]
    }},
    "suggested_post_topics": [
        "Actionable trendy topic 1",
        "Actionable trendy topic 2"
    ],
    "engagement_triggers": [
        "Niche-specific engagement question 1",
        "Niche-specific engagement question 2"
    ]
}}

Make the prompt incredibly detailed. It should feel like a 'Bible' for their LinkedIn brand. Use trendy, modern terminology and ensure the advice is pattern-interrupting and bold.

Return ONLY valid JSON. No markdown fences.
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


async def run_post_generation(user_profile: dict, brand_voice: dict, gap_analysis: dict, user_past_posts: str | None = None, target_day: str | None = None) -> dict[str, Any]:
    """
    Agent 5: Generate a comprehensive prompt for LinkedIn post generation based on all previous agents.
    """
    try:
        # Fetch previous prompts for context to avoid repetition
        previous_prompts_text = ""
        user_id = _current_user_id.get()
        
        if user_id:
            try:
                from database import async_session
                from models import AgentOutput
                from sqlalchemy import select
                
                async with async_session() as db:
                    result = await db.execute(
                        select(AgentOutput)
                        .where(
                            AgentOutput.user_id == user_id,
                            AgentOutput.agent_name == "LinkedIn Prompt Generator",
                            AgentOutput.status == "success"
                        )
                        .order_by(AgentOutput.created_at.desc())
                        .limit(5)
                    )
                    previous_outputs = result.scalars().all()
                    
                    if previous_outputs:
                        prompts_list = []
                        for out in previous_outputs:
                            out_data = out.output_data or {}
                            p_text = out_data.get("post_generation_prompt", "")
                            if p_text:
                                prompts_list.append(f"Previously Generated Prompt:\n{p_text[:200]}...")
                        
                        previous_prompts_text = "\n\n".join(prompts_list) if prompts_list else "No previous prompts found."
                        print(f"[PROMPT GENERATOR] Found {len(previous_outputs)} previous prompts for context.")
                    else:
                        previous_prompts_text = "No previous prompts found."
            except Exception as e:
                print(f"[PROMPT GENERATOR] Warning: Could not fetch previous prompts: {e}")
                previous_prompts_text = "No previous prompts available."
        else:
            previous_prompts_text = "No previous prompts (first generation)."
        
        # ds_key = _get_deepseek_api_key()
        groq_key = _get_groq_api_key()
        
        models = []
        # if ds_key:
        #     primary_llm = ChatOpenAI(
        #         model=os.getenv("POST_GENERATOR_MODEL", "deepseek-v4-flash"),
        #         temperature=0.9,
        #         api_key=ds_key,
        #         base_url="https://api.deepseek.com",
        #         model_kwargs={"response_format": {"type": "json_object"}},
        #     )
        if groq_key:
            fallback_llm = ChatGroq(
                model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                temperature=0.9,
                groq_api_key=groq_key,
                model_kwargs={"response_format": {"type": "json_object"}},
            )
            models.append(fallback_llm)

        if not models:
            return {
                "status": "error",
                "output": None,
                "error": "No AI API keys (DeepSeek or Groq) found for post generator.",
            }

        llm = models[0].with_fallbacks(models[1:]) if len(models) > 1 else models[0]

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
                extractor_prompt = ChatPromptTemplate.from_template(VOICE_EMOTION_EXTRACTION_PROMPT)
                extractor_models = []
                
                # if ds_key:
                #     primary_extractor_llm = ChatOpenAI(
                #         model=os.getenv("EXTRACTOR_MODEL", "deepseek-v4-flash"),
                #         temperature=0.2,
                #         api_key=ds_key,
                #         base_url="https://api.deepseek.com",
                #         model_kwargs={"response_format": {"type": "json_object"}},
                #     )
                #     extractor_models.append(extractor_prompt | primary_extractor_llm)

                if groq_key:
                    fallback_extractor_llm = ChatGroq(
                        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
                        temperature=0.2,
                        groq_api_key=groq_key,
                        model_kwargs={"response_format": {"type": "json_object"}},
                    )
                    extractor_models.append(extractor_prompt | fallback_extractor_llm)

                if not extractor_models:
                    raise RuntimeError("No AI API keys for voice extraction")

                extractor_chain = extractor_models[0].with_fallbacks(extractor_models[1:]) if len(extractor_models) > 1 else extractor_models[0]
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
        
        # Prepare inputs
        from .markdown_utils import format_profile_markdown_short
        short_profile = format_profile_markdown_short(user_profile)
        
        # Use PROMPT_GENERATION_PROMPT instead - this generates a meta-prompt for post generation
        llm_prompt = ChatPromptTemplate.from_template(PROMPT_GENERATION_PROMPT)
        chain = llm_prompt | llm
        
        target_day_instruction = ""
        if target_day:
            target_day_instruction = f"FOCUS: You are generating a prompt SPECIFICALLY for a post to be published on {target_day}. Ensure the topic and angle align with the content pillar and strategy for {target_day}."

        response = await guarded_llm_ainvoke(
            chain,
            {
                "user_profile": short_profile,
                "brand_voice": json.dumps(brand_voice, indent=2),
                "gap_analysis": json.dumps(gap_analysis, indent=2),
                "user_past_posts": normalized_past_posts["formatted"],
                "voice_emotion_signature": json.dumps(voice_emotion_signature, indent=2),
                "previous_posts": previous_prompts_text,
                "target_day_instruction": target_day_instruction,
            },
            timeout_seconds=90,
        )
        
        content = response.content.strip()
        if not content:
            return {
                "status": "error",
                "output": None,
                "error": "The AI model returned an empty response during prompt generation. Please try again.",
            }

        prompt_results = parse_llm_json_content(content)
        print(f"[PROMPT GENERATOR] Raw content length: {len(content)}")
        
        if not isinstance(prompt_results, dict):
            print(f"[PROMPT GENERATOR ERROR] Output is not a dict. Type: {type(prompt_results)}")
            # If it's a string, try to wrap it in a dict for the UI
            if isinstance(prompt_results, str):
                prompt_results = {
                    "post_generation_prompt": prompt_results,
                    "user_domain": "Extracted from text",
                    "status_note": "Unstructured output from LLM"
                }
            else:
                raise json.JSONDecodeError(f"Prompt generator output was not a valid JSON object. Raw output: {content[:200]}...", content, 0)
        
        # Enrich the output with metadata
        
        # Post-process the generated prompt to ensure proper spacing for markdown headings
        if "post_generation_prompt" in prompt_results and isinstance(prompt_results["post_generation_prompt"], str):
            prompt_results["post_generation_prompt"] = re.sub(
                r'(?<!\n)\s*(###\s+[A-Za-z]+)', 
                r'\n\n\1', 
                prompt_results["post_generation_prompt"]
            ).strip()

        prompt_results["voice_emotion_signature"] = voice_emotion_signature
        prompt_results["user_past_posts_used_count"] = normalized_past_posts["count"]
        prompt_results["generation_type"] = "meta_prompt"
        prompt_results["target_day"] = target_day
        
        # Force posting_schedule_days to match gap analysis recommended_days (single source of truth)
        gap_strategy = gap_analysis.get("overall_content_strategy") or gap_analysis.get("content_strategy") or {}
        canonical_days = gap_strategy.get("recommended_days")
        if canonical_days and isinstance(canonical_days, list) and len(canonical_days) > 0:
            prompt_results["posting_schedule_days"] = canonical_days
            
            # Force posting_frequency description count to match canonical_days count
            num_days = len(canonical_days)
            original_freq = str(prompt_results.get("posting_frequency") or "")
            if original_freq:
                import re as _re
                # Try replacing starting number or any standalone number with num_days
                updated_freq = _re.sub(r'^\d+', str(num_days), original_freq)
                if updated_freq == original_freq:
                    updated_freq = _re.sub(r'\b\d+\b', str(num_days), original_freq)
                prompt_results["posting_frequency"] = updated_freq
            else:
                prompt_results["posting_frequency"] = f"{num_days} high-impact posts per week, focusing on educational, thought leadership, and interactive content"
        
        print(f"[PROMPT GENERATOR] Success. Domain: {prompt_results.get('user_domain')}")
        
        return {
            "status": "success",
            "output": prompt_results,
            "error": None,
        }
    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"Post prompt generation failed: {str(e)}\n{traceback.format_exc()}",
        }