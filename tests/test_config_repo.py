import os
import pytest
import asyncpg

from memoryweave.models.config_repo import ModelConfigRepo

pytestmark = pytest.mark.asyncio


@pytest.fixture(scope="module")
def database_url():
    url = os.getenv("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL not set — skipping PostgreSQL integration tests")
    return url


@pytest.fixture
async def conn(database_url):
    pool = await asyncpg.create_pool(dsn=database_url, min_size=1, max_size=2)
    from memoryweave.db.postgres import _MIGRATIONS_DIR
    async with pool.acquire() as c:
        for migration in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            await c.execute(migration.read_text())
        await c.execute(
            "INSERT INTO users (id, google_sub, email) VALUES ('u1', 'g1', 'a@b.com') ON CONFLICT DO NOTHING"
        )
    async with pool.acquire() as c:
        yield c
    async with pool.acquire() as c:
        await c.execute("DELETE FROM user_model_configs WHERE user_id = 'u1'")
        await c.execute("DELETE FROM users WHERE id = 'u1'")
    await pool.close()


async def test_save_and_load_config(conn, monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", _test_key())
    # Reload settings to pick up new env var
    from memoryweave.models import encryption
    repo = ModelConfigRepo(conn)
    await repo.save("u1", provider="huggingface", chat_model="llama", hf_api_key="hf_abc")
    config = await repo.load("u1")
    assert config is not None
    assert config.provider == "huggingface"
    assert config.chat_model == "llama"


async def test_load_returns_none_for_missing(conn):
    repo = ModelConfigRepo(conn)
    config = await repo.load("nonexistent")
    assert config is None


def _test_key():
    from cryptography.fernet import Fernet
    return Fernet.generate_key().decode()
