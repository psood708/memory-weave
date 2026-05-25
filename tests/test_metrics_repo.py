import os
import pytest
import asyncpg
from datetime import datetime, timezone

from memoryweave.eval.repository.postgres_repo import PostgresMetricsRepository
from memoryweave.eval.repository.base import TurnMetrics, JudgeResult

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
    from memoryweave.db.postgres import _MIGRATIONS_DIR
    async with p.acquire() as conn:
        for migration in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            await conn.execute(migration.read_text())
        await conn.execute(
            "INSERT INTO users (id, google_sub, email) VALUES ('u1','g1','a@b.com') ON CONFLICT DO NOTHING"
        )
        await conn.execute(
            "INSERT INTO sessions (id, user_id) VALUES ('sess1', 'u1') ON CONFLICT DO NOTHING"
        )
    yield p
    async with p.acquire() as conn:
        await conn.execute("DELETE FROM turn_metrics WHERE session_id = 'sess1'")
        await conn.execute("DELETE FROM sessions WHERE id = 'sess1'")
        await conn.execute("DELETE FROM users WHERE id = 'u1'")
    await p.close()


async def test_write_and_read_turn(pool):
    repo = PostgresMetricsRepository(pool)
    turn = TurnMetrics(
        id="t1", session_id="sess1", turn_number=1,
        timestamp=datetime.now(timezone.utc),
        system_tokens=100, naive_tokens=500, token_efficiency=0.8,
        kg_contributed=True, kg_cosine_distance=0.3,
        retrieval_latency_ms=20, total_latency_ms=150,
    )
    await repo.write_turn(turn)
    summary = await repo.get_session_summary("sess1")
    assert summary.turn_count == 1
    assert abs(summary.avg_token_efficiency - 0.8) < 0.001


async def test_patch_judge_score(pool):
    repo = PostgresMetricsRepository(pool)
    turn = TurnMetrics(
        id="t2", session_id="sess1", turn_number=2,
        timestamp=datetime.now(timezone.utc),
        system_tokens=80, naive_tokens=400, token_efficiency=0.8,
        kg_contributed=False, kg_cosine_distance=0.9,
        retrieval_latency_ms=15, total_latency_ms=100,
    )
    await repo.write_turn(turn)
    result = JudgeResult(score=0.85, reasoning="good", metric_breakdown={"faithfulness": 0.9})
    await repo.patch_judge_score("t2", result)
    summary = await repo.get_session_summary("sess1")
    assert summary.avg_judge_score is not None
