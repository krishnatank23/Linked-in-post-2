"""Verify the configured SQL Server connection without changing database data."""

import asyncio

from sqlalchemy import text

from database import engine


async def check_connection() -> None:
    async with engine.connect() as connection:
        row = (
            await connection.execute(
                text("SELECT DB_NAME() AS database_name, SUSER_SNAME() AS login_name")
            )
        ).one()
        print(f"Connected to database: {row.database_name}")
        print(f"Authenticated login: {row.login_name}")
        for table_name in (
            "linkedin_users",
            "linkedin_agent_outputs",
            "linkedin_posts",
        ):
            count = await connection.scalar(text(f"SELECT COUNT(*) FROM {table_name}"))
            print(f"{table_name}: {count} row(s)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_connection())
