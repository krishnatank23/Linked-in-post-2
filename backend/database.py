from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
import os
from env_config import load_backend_env

load_backend_env()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./app.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        from models import Base as ModelBase  # noqa: F811
        await conn.run_sync(ModelBase.metadata.create_all)

        # Lightweight SQLite migration for newly added user cache columns.
        if DATABASE_URL.startswith("sqlite"):
            result = await conn.execute(text("PRAGMA table_info(users)"))
            columns = {row[1] for row in result.fetchall()}

            if "parsed_profile_cache" not in columns:
                await conn.execute(text("ALTER TABLE users ADD COLUMN parsed_profile_cache JSON"))
            if "brand_voice_cache" not in columns:
                await conn.execute(text("ALTER TABLE users ADD COLUMN brand_voice_cache JSON"))
            if "cache_updated_at" not in columns:
                await conn.execute(text("ALTER TABLE users ADD COLUMN cache_updated_at DATETIME"))
