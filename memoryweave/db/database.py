import uuid
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite

from memoryweave.core.config import settings

_MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def _db_path() -> str:
    return settings.eval_db_path


async def init_db() -> None:
    """Run all SQL migrations in filename order. Safe to call on every startup."""
    import os
    os.makedirs(Path(_db_path()).parent, exist_ok=True)
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        for migration in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            await db.executescript(migration.read_text())
        await db.commit()


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """FastAPI dependency — yields an open DB connection per request."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        yield db


def new_uuid() -> str:
    return str(uuid.uuid4())
