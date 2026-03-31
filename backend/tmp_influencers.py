import asyncio
from agents.influencer_agent import run_influencer_search


async def main() -> None:
    parsed_profile = {
        "industry": "Software Engineering",
        "current_role": "Backend Engineer",
        "expertise_areas": ["Python", "FastAPI", "AI"],
    }
    brand_voice = {
        "tone": "educational",
        "content_themes": ["backend", "ai", "career growth"],
    }

    result = await run_influencer_search(parsed_profile, brand_voice)
    output = result.get("output") or {}
    results = output.get("influencers", [])

    print(f"status={result.get('status')}")
    print(f"provider={output.get('search_provider')}")
    print(f"warning={output.get('warning')}")
    print(f"count={len(results)}")
    for i, item in enumerate(results[:8], start=1):
        print(f"{i}. {item.get('title', '')}")
        print(f"   {item.get('link', '')}")


if __name__ == "__main__":
    asyncio.run(main())
