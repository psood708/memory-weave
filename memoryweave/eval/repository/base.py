import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class JudgeResult:
    score: float
    reasoning: str
    metric_breakdown: dict = field(default_factory=dict)


@dataclass
class TurnMetrics:
    id: str
    session_id: str
    turn_number: int
    timestamp: datetime
    system_tokens: int
    naive_tokens: int
    token_efficiency: float
    kg_contributed: bool
    kg_cosine_distance: float
    retrieval_latency_ms: int
    total_latency_ms: int
    judge_score: float | None = None
    judge_reasoning: str | None = None
    judge_metric_breakdown: dict = field(default_factory=dict)


@dataclass
class SessionSummary:
    session_id: str
    turn_count: int
    avg_token_efficiency: float
    kg_contribution_rate: float
    avg_judge_score: float | None


class MetricsRepository(ABC):
    @abstractmethod
    async def write_turn(self, turn: TurnMetrics) -> None: ...

    @abstractmethod
    async def patch_judge_score(self, turn_id: str, result: JudgeResult) -> None: ...

    @abstractmethod
    async def get_session_summary(self, session_id: str) -> SessionSummary: ...

    @abstractmethod
    async def list_turns(self, session_id: str, limit: int = 50) -> list[TurnMetrics]: ...

    @abstractmethod
    async def list_sessions(self, user_id: str, limit: int = 20) -> list[SessionSummary]: ...
