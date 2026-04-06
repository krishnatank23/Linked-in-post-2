import asyncio


async def cleanup() -> None:
    from env_config import load_backend_env
    load_backend_env()

    from database import async_session
    from models import User
    from sqlalchemy import select

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.email.like("pipeline_%@test.com"))
        )
        test_users = result.scalars().all()
        print(f"Found {len(test_users)} test users to delete")

        for user in test_users:
            await db.delete(user)

        await db.commit()
        print("Cleaned up.")


if __name__ == "__main__":
    asyncio.run(cleanup())
