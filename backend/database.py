from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.engine import URL
import os
from env_config import load_backend_env

load_backend_env()

required_settings = ("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME")
missing_settings = [name for name in required_settings if not os.getenv(name)]
if missing_settings:
    raise RuntimeError(
        "Missing required Microsoft SQL Server settings: " + ", ".join(missing_settings)
    )

DATABASE_URL = URL.create(
    "mssql+aioodbc",
    username=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    host=os.environ["DB_HOST"],
    port=int(os.getenv("DB_PORT", "1433")),
    database=os.environ["DB_NAME"],
    query={
        "driver": os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server"),
        "TrustServerCertificate": os.getenv("DB_TRUST_SERVER_CERTIFICATE", "no"),
    },
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
)
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
