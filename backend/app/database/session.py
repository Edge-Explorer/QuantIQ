from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from backend.app.config.settings import settings

# Create async engine for Postgres using the resolved async URL
engine= create_async_engine(
    settings.database_url_async,
    echo= False,
    future= True,
    pool_pre_ping=True,
    pool_recycle=30,
    pool_size=5,
    max_overflow=10,
    connect_args={"timeout": 30.0}
)

# Create session factory
SessionLocal= async_sessionmaker(
    bind= engine,
    autocommit= False,
    autoflush= False,
    expire_on_commit= False,
    class_= AsyncSession
)

# Declarative base for SQLAlchemy models
class Base(DeclarativeBase):
    pass

# Dependency to retrieve a database session for requests
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()