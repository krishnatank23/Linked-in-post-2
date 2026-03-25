import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

import sys
sys.path.append(os.getcwd())

from database import async_session, init_db
from models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_user():
    print("Initializing database...")
    await init_db()
    
    async with async_session() as session:
        # Check if demo user exists
        result = await session.execute(select(User).where(User.email == "demo@gmail.com"))
        user = result.scalar_one_or_none()
        
        if not user:
            print("Creating demo user: demo@gmail.com / 1234")
            new_user = User(
                email="demo@gmail.com",
                username="demouser",
                hashed_password=pwd_context.hash("1234"),
                resume_path="", # Empty for now
                resume_filename="demo_resume.pdf",
                unique_id="demo-unique-id"
            )
            session.add(new_user)
            await session.commit()
            print("Demo user created successfully!")
        else:
            print("Demo user already exists.")

if __name__ == "__main__":
    asyncio.run(seed_user())
