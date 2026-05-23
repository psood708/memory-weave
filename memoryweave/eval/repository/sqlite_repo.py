import json
from datetime import datetime, timezone

import aiosqlite

from memoryweave.db.database import new_uuid
from memoryweave.eval.repository.base import (
    JudgeResult, MetricsRepository, SessionSummary, TurnMetrics,
)


class SQLiteMetricsRepository(MetricsRepository):
    def __init__(self, db: aiosqlite.Connection):
        self._db = db

    async def write_turn(self, turn: TurnMetrics) -> None:
        await self._db.execute(
            "INSERT OR IGNORE INTO sessions (id, turn_count) VALUES (?, 0)",
            (turn.session_id,),
        )
        await self._db.execute(
            """
            INSERT INTO turn_metrics (
                id, session_id, turn_number, timestamp,
                system_tokens, naive_tokens, token_efficiency,
                kg_contributed, kg_cosine_distance,
                retrieval_latency_ms, total_latency_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                turn.id, turn.session_id, turn.turn_number,
                turn.timestamp.isoformat(),
                turn.system_tokens, turn.naive_tokens, turn.token_efficiency,
                int(turn.kg_contributed), turn.kg_cosine_distance,
                turn.retrieval_latency_ms, turn.total_latency_ms,
            ),
        )
        await self._db.execute(
            "UPDATE sessions SET turn_count = turn_count + 1 WHERE id = ?",
            (turn.session_id,),
        )
        await self._db.commit()

    async def patch_judge_score(self, turn_id: str, result: JudgeResult) -> None:
        await self._db.execute(
            """
            UPDATE turn_metrics
            SET judge_score=?, judge_reasoning=?, judge_metric_breakdown=?
            WHERE id=?
            """,
            (result.score, result.reasoning, json.dumps(result.metric_breakdown), turn_id),
        )
        await self._db.commit()

    async def get_session_summary(self, session_id: str) -> SessionSummary:
        cur = await self._db.execute(
            """
            SELECT
                COUNT(*) as turns,
                AVG(token_efficiency) as avg_eff,
                AVG(CAST(kg_contributed AS REAL)) as kg_rate,
                AVG(judge_score) as avg_judge
            FROM turn_metrics WHERE session_id = ?
            """,
            (session_id,),
        )
        row = await cur.fetchone()
        return SessionSummary(
            session_id=session_id,
            turn_count=row["turns"] or 0,
            avg_token_efficiency=row["avg_eff"] or 0.0,
            kg_contribution_rate=row["kg_rate"] or 0.0,
            avg_judge_score=row["avg_judge"],
        )

    async def list_turns(self, session_id: str, limit: int = 50) -> list[TurnMetrics]:
        cur = await self._db.execute(
            "SELECT * FROM turn_metrics WHERE session_id=? ORDER BY turn_number DESC LIMIT ?",
            (session_id, limit),
        )
        rows = await cur.fetchall()
        return [_row_to_turn(r) for r in rows]

    async def list_sessions(self, user_id: str, limit: int = 20) -> list[SessionSummary]:
        cur = await self._db.execute(
            """
            SELECT s.id,
                COUNT(t.id) as turns,
                AVG(t.token_efficiency) as avg_eff,
                AVG(CAST(t.kg_contributed AS REAL)) as kg_rate,
                AVG(t.judge_score) as avg_judge
            FROM sessions s LEFT JOIN turn_metrics t ON t.session_id = s.id
            WHERE s.user_id = ?
            GROUP BY s.id ORDER BY s.created_at DESC LIMIT ?
            """,
            (user_id, limit),
        )
        rows = await cur.fetchall()
        return [
            SessionSummary(
                session_id=r["id"],
                turn_count=r["turns"] or 0,
                avg_token_efficiency=r["avg_eff"] or 0.0,
                kg_contribution_rate=r["kg_rate"] or 0.0,
                avg_judge_score=r["avg_judge"],
            )
            for r in rows
        ]


def _row_to_turn(row: aiosqlite.Row) -> TurnMetrics:
    breakdown = json.loads(row["judge_metric_breakdown"]) if row["judge_metric_breakdown"] else {}
    return TurnMetrics(
        id=row["id"], session_id=row["session_id"],
        turn_number=row["turn_number"],
        timestamp=datetime.fromisoformat(row["timestamp"]),
        system_tokens=row["system_tokens"], naive_tokens=row["naive_tokens"],
        token_efficiency=row["token_efficiency"],
        kg_contributed=bool(row["kg_contributed"]),
        kg_cosine_distance=row["kg_cosine_distance"],
        retrieval_latency_ms=row["retrieval_latency_ms"],
        total_latency_ms=row["total_latency_ms"],
        judge_score=row["judge_score"], judge_reasoning=row["judge_reasoning"],
        judge_metric_breakdown=breakdown,
    )
