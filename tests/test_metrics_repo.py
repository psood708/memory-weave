import asyncio
import pytest
import aiosqlite
from datetime import datetime, timezone
from memoryweave.db.database import init_db
from memoryweave.eval.repository.sqlite_repo import SQLiteMetricsRepository
from memoryweave.eval.repository.base import TurnMetrics, JudgeResult, SessionSummary

@pytest.fixture
async def repo(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr("memoryweave.db.database._db_path", lambda: db_path)
    await init_db()
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("INSERT INTO users (id, google_sub, email) VALUES ('u1','g1','a@b.com')")
        await db.execute("INSERT INTO sessions (id, user_id) VALUES ('sess1', 'u1')")
        await db.commit()
        yield SQLiteMetricsRepository(db)

@pytest.mark.asyncio
async def test_write_and_read_turn(repo):
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

@pytest.mark.asyncio
async def test_patch_judge_score(repo):
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
