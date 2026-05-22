import pytest
import aiosqlite
from memoryweave.models.config_repo import ModelConfigRepo, UserModelConfig
from memoryweave.db.database import init_db


@pytest.fixture
async def db(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr("memoryweave.db.database._db_path", lambda: db_path)
    await init_db()
    async with aiosqlite.connect(db_path) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute(
            "INSERT INTO users (id, google_sub, email) VALUES ('u1', 'g1', 'a@b.com')"
        )
        await conn.commit()
        yield conn


@pytest.mark.asyncio
async def test_save_and_load_config(db, monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", _test_key())
    repo = ModelConfigRepo(db)
    await repo.save("u1", provider="huggingface", chat_model="llama", hf_api_key="hf_abc")
    config = await repo.load("u1")
    assert config is not None
    assert config.provider == "huggingface"
    assert config.chat_model == "llama"
    assert config.hf_api_key == "hf_abc"


@pytest.mark.asyncio
async def test_load_returns_none_for_missing(db):
    repo = ModelConfigRepo(db)
    config = await repo.load("nonexistent")
    assert config is None


def _test_key():
    from cryptography.fernet import Fernet
    return Fernet.generate_key().decode()
