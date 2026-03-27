import asyncio
import os
import sys

sys.path.append(os.getcwd())

from agents.workflow import run_pipeline
from database import async_session
from models import User
from sqlalchemy import select

async def test_pipeline():
    async with async_session() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No user found.")
            return
        
        print(f"Testing pipeline for user: {user.email}")
        print(f"Resume path: {user.resume_path}")
        
        try:
            results = await run_pipeline(user.resume_path)
            for r in results:
                print(f"Agent: {r['agent_name']}, Status: {r['status']}")
                if r['status'] == 'error':
                    print(f"Error: {r['error']}")
        except Exception as e:
            import traceback
            print(f"Pipeline crashed: {str(e)}")
            print(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(test_pipeline())
