from pathlib import Path
from typing import AsyncGenerator

import asyncpg

from memoryweave.core.config import settings

_pool: asyncpg.Pool | None = None
_MIGRATIONS_DIR = Path(__file__).parent / "migrations"


async def init_pool() -> None:
    global _pool
    # min_size=0 avoids holding idle connections on Neon/serverless Postgres
    _pool = await asyncpg.create_pool(dsn=settings.database_url, min_size=0, max_size=10)


async def close_pool() -> None:
    if _pool:
        await _pool.close()


async def init_db() -> None:
    """Run all SQL migrations in filename order. Safe to call on every startup."""
    async with _pool.acquire() as conn:
        for migration in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            await conn.execute(migration.read_text())


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency — yields a pooled connection per request."""
    async with _pool.acquire() as conn:
        yield conn


def get_pool() -> asyncpg.Pool:
    return _pool
