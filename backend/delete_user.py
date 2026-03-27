import asyncio
import os
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

import sys
sys.path.append(os.getcwd())

from database import async_session
from models import User

async def delete_demo_user():
    async with async_session() as session:
        print("Deleting demo user: demo@gmail.com")
        await session.execute(delete(User).where(User.email == "demo@gmail.com"))
        await session.commit()
        print("Demo user deleted successfully!")

if __name__ == "__main__":
    asyncio.run(delete_demo_user())
