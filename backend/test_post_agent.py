import asyncio
import json
import os
from agents.post_generator_agent import run_post_generation

async def test_agent():
    user_profile = {
        "personal_info": {"full_name": "Krishna Tank"},
        "current_role": "AI Engineer",
        "industry": "Artificial Intelligence",
        "skills": ["Python", "LangChain", "FastAPI"]
    }
    brand_voice = {
        "brand_voice": {
            "tone": "Visionary and Practical",
            "style": "Direct and insightful"
        }
    }
    gap_analysis = {
        "gap_analysis": {
            "profile_completeness_gap": "Missing deep thought leadership in AI agents.",
            "key_missing_elements": ["Agentic workflows", "Autonomous systems"]
        },
        "content_strategy": {
            "content_pillars": ["AI Agents", "Automated Coding", "Future of Work"]
        }
    }
    
    print("Running Post Generation Agent...")
    result = await run_post_generation(user_profile, brand_voice, gap_analysis)
    
    if result["status"] == "success":
        print("Success!")
        print(json.dumps(result["output"], indent=2))
    else:
        print("Error:")
        print(result["error"])

if __name__ == "__main__":
    asyncio.run(test_agent())
