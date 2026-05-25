import os
import pytest
import asyncpg

pytestmark = pytest.mark.asyncio


@pytest.fixture(scope="module")
def database_url():
    url = os.getenv("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL not set — skipping PostgreSQL integration tests")
    return url


@pytest.fixture
async def pool(database_url):
    p = await asyncpg.create_pool(dsn=database_url, min_size=1, max_size=2)
    yield p
    await p.close()


async def test_init_db_creates_users_table(pool):
    from memoryweave.db.postgres import _MIGRATIONS_DIR
    async with pool.acquire() as conn:
        for migration in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            await conn.execute(migration.read_text())
        row = await conn.fetchrow(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'users'"
        )
    assert row is not None


async def test_init_db_creates_knowledge_graphs_table(pool):
    from memoryweave.db.postgres import _MIGRATIONS_DIR
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'knowledge_graphs'"
        )
    assert row is not None
