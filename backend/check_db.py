import asyncio
import json
from datetime import datetime, timedelta
from sqlalchemy import select
from database import async_session
from models import AgentOutput

async def check_results():
    today = datetime.utcnow().date()
    async with async_session() as session:
        print(f"Checking for outputs from {today}...")
        result = await session.execute(
            select(AgentOutput).where(AgentOutput.created_at >= today).order_by(AgentOutput.created_at.desc())
        )
        outputs = result.scalars().all()
        if not outputs:
            print("No outputs found from today.")
            # Let's see the absolute latest 10
            result = await session.execute(select(AgentOutput).order_by(AgentOutput.created_at.desc()).limit(10))
            outputs = result.scalars().all()
            
        for o in outputs:
            print(f"Agent: {o.agent_name}")
            print(f"Status: {o.status}")
            print(f"Error: {o.error_message}")
            if o.output_data:
                output_str = json.dumps(o.output_data)
                print(f"Output (first 500 chars): {output_str[:500]}...")
            print(f"Created At: {o.created_at}")
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check_results())
