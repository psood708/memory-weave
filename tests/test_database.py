import pytest
import aiosqlite
from memoryweave.db.database import init_db, get_db

@pytest.mark.asyncio
async def test_init_db_creates_users_table(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr("memoryweave.db.database._db_path", lambda: db_path)
    await init_db()
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        row = await cur.fetchone()
    assert row is not None
