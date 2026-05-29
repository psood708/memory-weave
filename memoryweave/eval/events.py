from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class TurnEvent:
    session_id: str
    user_id: str
    turn_number: int
    question: str
    answer: str
    episode_texts: list[str]
    kg_texts: list[str]
    episode_embeddings: list[list[float]]
    kg_embedding: list[float]
    system_tokens: int
    naive_tokens: int
    retrieval_latency_ms: int
    total_latency_ms: int
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    turn_metric_id: str = ""
    is_question_mode: bool = False
