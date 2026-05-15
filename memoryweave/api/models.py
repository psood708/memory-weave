from typing import Literal

from pydantic import BaseModel


# ── /api/chat/stream SSE payload models ──────────────────────────────────────

class AgentStepEvent(BaseModel):
    step: str
    status: Literal["active", "done"]


class TokenEvent(BaseModel):
    text: str


class EpisodeContext(BaseModel):
    id: str
    score: float
    text: str


class NodeContext(BaseModel):
    name: str
    score: float


class ContextMeta(BaseModel):
    episodes: list[EpisodeContext]
    nodes: list[NodeContext]
    merge: float


class DoneMeta(BaseModel):
    episodes: int
    hops: int
    tokens: int
    latency: float


class DoneEvent(BaseModel):
    meta: DoneMeta
    context: ContextMeta


# ── /api/memory response models ───────────────────────────────────────────────

class WorkingTurn(BaseModel):
    role: Literal["user", "bot"]
    text: str


class EpisodeMemory(BaseModel):
    id: str
    turn: int
    hoursAgo: float
    importance: float
    decay: float
    text: str
    entities: list[str]
    history: list[float]


class EntityMemory(BaseModel):
    id: str
    name: str
    type: Literal["person", "concept", "event"]
    degree: int
    weight: float
    description: str = ""


class EdgeMemory(BaseModel):
    s: str
    t: str
    rel: str
    w: float


class BudgetSegment(BaseModel):
    tier: Literal["working", "episodic", "kg"]
    tokens: int


class Budget(BaseModel):
    total: int
    used: int
    segments: list[BudgetSegment]


class MemoryResponse(BaseModel):
    working_turns: list[WorkingTurn]
    episodes: list[EpisodeMemory]
    entities: list[EntityMemory]
    edges: list[EdgeMemory]
    budget: Budget
