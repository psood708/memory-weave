import asyncpg
from fastapi import APIRouter, Depends, Query

from memoryweave.auth.models import UserSession
from memoryweave.auth.session import verify_session
from memoryweave.db.postgres import get_pool
from memoryweave.eval.repository.postgres_repo import PostgresMetricsRepository

router = APIRouter(prefix="/eval")


@router.get("/metrics")
async def get_metrics(
    session_id: str = Query(...),
    limit: int = Query(50, le=200),
    session: UserSession = Depends(verify_session),
    pool: asyncpg.Pool = Depends(get_pool),
):
    repo = PostgresMetricsRepository(pool)
    turns = await repo.list_turns(session_id, limit=limit)
    summary = await repo.get_session_summary(session_id)
    return {
        "summary": {
            "turn_count": summary.turn_count,
            "avg_token_efficiency": summary.avg_token_efficiency,
            "kg_contribution_rate": summary.kg_contribution_rate,
            "avg_judge_score": summary.avg_judge_score,
        },
        "turns": [
            {
                "turn_number": t.turn_number,
                "system_tokens": t.system_tokens,
                "naive_tokens": t.naive_tokens,
                "token_efficiency": t.token_efficiency,
                "kg_contributed": t.kg_contributed,
                "kg_cosine_distance": t.kg_cosine_distance,
                "retrieval_latency_ms": t.retrieval_latency_ms,
                "total_latency_ms": t.total_latency_ms,
                "judge_score": t.judge_score,
            }
            for t in turns
        ],
    }


@router.get("/sessions")
async def get_sessions(
    limit: int = Query(20, le=100),
    session: UserSession = Depends(verify_session),
    pool: asyncpg.Pool = Depends(get_pool),
):
    repo = PostgresMetricsRepository(pool)
    sessions = await repo.list_sessions(session.user_id, limit=limit)
    return [
        {
            "session_id": s.session_id,
            "turn_count": s.turn_count,
            "avg_token_efficiency": s.avg_token_efficiency,
            "kg_contribution_rate": s.kg_contribution_rate,
            "avg_judge_score": s.avg_judge_score,
        }
        for s in sessions
    ]


@router.get("/health")
async def eval_health():
    from memoryweave.api.app import eval_bus, judge_worker
    return {
        "judge_status": "circuit_open" if judge_worker.circuit_open else "active",
        "queue_depth": eval_bus.qsize(),
    }
