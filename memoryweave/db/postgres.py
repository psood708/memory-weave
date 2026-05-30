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
    """Run pending SQL migrations. Already-applied files are skipped."""
    async with _pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename   TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        applied = {
            row["filename"]
            for row in await conn.fetch("SELECT filename FROM schema_migrations")
        }
        for migration in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            if migration.name in applied:
                continue
            async with conn.transaction():
                await conn.execute(migration.read_text())
                await conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES ($1)",
                    migration.name,
                )


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency — yields a pooled connection per request."""
    async with _pool.acquire() as conn:
        yield conn


def get_pool() -> asyncpg.Pool:
    return _pool
