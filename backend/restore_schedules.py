import asyncio


async def restore() -> None:
    from env_config import load_backend_env
    load_backend_env()

    from database import async_session
    from models import User
    from sqlalchemy import select

    async with async_session() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()

        for user in users:
            if user.email == "krishna.tank@wogom.com":
                user.posting_schedule = ["Monday", "Thursday"]
                user.last_automated_post_at = None
            elif user.email == "yash.suthar@wogom.com":
                user.posting_schedule = ["Monday", "Thursday"]
                user.last_automated_post_at = None

        await db.commit()
        print("Schedules restored.")


if __name__ == "__main__":
    asyncio.run(restore())
