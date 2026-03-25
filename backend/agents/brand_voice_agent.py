from typing import Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

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
        "personality_traits": ["Professional personality traits inferred from their profile"]
    }},
    "brand_voice": {{
        "tone": "Primary communication tone (e.g., authoritative yet approachable)",
        "style": "Writing style recommendation (e.g., data-driven storytelling)",
        "vocabulary_level": "Recommended vocabulary level for their audience",
        "content_themes": ["5-7 content themes they should focus on"],
        "do_list": ["Things they SHOULD do in their personal branding"],
        "dont_list": ["Things they should AVOID in their personal branding"],
        "sample_taglines": ["3-4 potential LinkedIn headline/tagline options"],
        "communication_pillars": ["3-4 pillars their communication should revolve around"]
    }},
    "professional_summary": {{
        "short_bio": "A compelling 2-3 sentence professional bio",
        "elevator_pitch": "A 30-second elevator pitch",
        "linkedin_about": "A recommended LinkedIn About section (3-4 paragraphs)",
        "key_hashtags": ["10-15 relevant hashtags for their niche"]
    }}
}}

Be specific, actionable, and insightful. Avoid generic advice.
Return ONLY the JSON object, no markdown fences, no extra text.
"""


async def search_industry_context(profile_data: dict) -> str:
    """Use DuckDuckGo to search for industry context."""
    try:
        from duckduckgo_search import DDGS

        # Build search query from profile data
        industry = profile_data.get("industry", "")
        current_role = profile_data.get("current_role", "")
        expertise = profile_data.get("expertise_areas", [])

        search_query = f"{current_role} {industry} LinkedIn personal branding trends 2024"
        if expertise:
            search_query += f" {' '.join(expertise[:2])}"

        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(search_query, max_results=5):
                results.append(f"- {r.get('title', '')}: {r.get('body', '')}")

        return "\n".join(results) if results else "No additional industry context found."

    except Exception as e:
        return f"Industry search unavailable: {str(e)}"


async def run_brand_voice_agent(parsed_profile: dict) -> dict[str, Any]:
    """
    Agent 2: Generate brand voice and detailed persona from parsed resume data.
    Returns a dict with status, output, and optional error.
    """
    try:
        # Step 1: Search for industry context
        industry_context = await search_industry_context(parsed_profile)

        # Step 2: Use Groq LLM to generate brand voice and persona
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            api_key=os.getenv("GROQ_API_KEY"),
        )

        prompt = ChatPromptTemplate.from_template(BRAND_VOICE_PROMPT)
        chain = prompt | llm

        response = await chain.ainvoke({
            "profile_data": json.dumps(parsed_profile, indent=2),
            "industry_context": industry_context,
        })

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
        return {
            "status": "error",
            "output": None,
            "error": f"Brand voice agent failed: {str(e)}\n{traceback.format_exc()}",
        }
