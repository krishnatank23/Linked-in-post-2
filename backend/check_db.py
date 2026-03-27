import asyncio
from database import async_session
from models import User
from sqlalchemy import select

async def check():
    async with async_session() as s:
        r = await s.execute(select(User))
        users = r.scalars().all()
        if not users:
            print("No users in database.")
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}, Resume: {u.resume_path}")

if __name__ == "__main__":
    asyncio.run(check())
