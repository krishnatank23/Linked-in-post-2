import asyncio
import os
import sys

# Add the backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db
from scheduler import automated_posting_job

async def test_scheduler():
    print("Initializing Database...")
    await init_db()
    
    print("Manually triggering the automated posting job...")
    await automated_posting_job()
    print("Job completed.")

if __name__ == "__main__":
    asyncio.run(test_scheduler())
