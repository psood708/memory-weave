import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from memoryweave.core.config import settings as _settings


@dataclass
class Episode:
    id: str
    content: str
    importance_score: float
    timestamp: datetime
    session_id: str
    turn_number: int
    entity_ids: list[str] = field(default_factory=list)
    valid_from: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    valid_until: str | None = None
    is_active: bool = True

    def to_metadata(self) -> dict:
        return {
            "importance_score": self.importance_score,
            "timestamp": self.timestamp.isoformat(),
            "session_id": self.session_id,
            "turn_number": self.turn_number,
            "entity_ids": ",".join(self.entity_ids),
            "valid_from": self.valid_from,
            "valid_until": self.valid_until or "",
            "is_active": 1 if self.is_active else 0,
        }

    @classmethod
    def from_metadata(cls, id: str, content: str, meta: dict) -> "Episode":
        return cls(
            id=id,
            content=content,
            importance_score=float(meta["importance_score"]),
            timestamp=datetime.fromisoformat(meta["timestamp"]),
            session_id=meta["session_id"],
            turn_number=int(meta["turn_number"]),
            entity_ids=[e for e in meta.get("entity_ids", "").split(",") if e],
            valid_from=meta.get("valid_from", datetime.now(timezone.utc).isoformat()),
            valid_until=meta.get("valid_until") or None,
            is_active=bool(int(meta.get("is_active", 1))),
        )


class EpisodicStore:
    def __init__(self, collection_name: str = "episodes", persist_dir: str = ".chroma", backend=None):
        self._collection_name = collection_name
        if backend is not None:
            self._backend = backend
        elif _settings.qdrant_url:
            from memoryweave.memory.episodic_backend import QdrantEpisodicBackend
            self._backend = QdrantEpisodicBackend(session_id=collection_name)
        else:
            from memoryweave.memory.episodic_backend import ChromaEpisodicBackend
            self._backend = ChromaEpisodicBackend(collection_name, persist_dir)
        self._turn_counter: int = self._bootstrap_turn_counter()

    def _bootstrap_turn_counter(self) -> int:
        items = self._backend.get_all()
        if not items:
            return 0
        return max(int(meta.get("turn_number", 0)) for _, _, meta in items)

    def write(self, episode: Episode) -> None:
        self._backend.upsert(
            ids=[episode.id],
            documents=[episode.content],
            metadatas=[episode.to_metadata()],
        )

    def mark_episode_inactive(self, episode_id: str) -> None:
        items = self._backend.get_by_ids([episode_id])
        if not items:
            return
        id_, doc, meta = items[0]
        meta["is_active"] = 0
        meta["valid_until"] = datetime.now(timezone.utc).isoformat()
        self._backend.upsert([id_], [doc], [meta])

    def retrieve(self, query: str, top_k: int = 5) -> list[Episode]:
        results = self._backend.query(query, top_k, where={"is_active": 1})
        return [Episode.from_metadata(id_, doc, meta) for id_, doc, meta in results]

    def list_all(self) -> list[Episode]:
        """Return all stored episodes without vector search — for display/inspection."""
        return [Episode.from_metadata(id_, doc, meta) for id_, doc, meta in self._backend.get_all()]

    def apply_decay(self, current_turn: int, decay_lambda: float) -> None:
        items = self._backend.get_all()
        if not items:
            return
        ids_to_delete, ids_to_update, docs_to_update, metas_to_update = [], [], [], []
        for id_, doc, meta in items:
            delta = current_turn - int(meta["turn_number"])
            decayed = float(meta["importance_score"]) * math.exp(-decay_lambda * delta)
            if decayed < _settings.episodic_min_importance:
                ids_to_delete.append(id_)
            else:
                meta["importance_score"] = decayed
                ids_to_update.append(id_)
                docs_to_update.append(doc)
                metas_to_update.append(meta)
        if ids_to_delete:
            self._backend.delete(ids_to_delete)
        if ids_to_update:
            self._backend.upsert(ids_to_update, docs_to_update, metas_to_update)

    def _maybe_decay(self, decay_lambda: float) -> None:
        if self._turn_counter % _settings.episodic_decay_interval == 0:
            self.apply_decay(self._turn_counter, decay_lambda)

    def update_entity_links(self, episode_id: str, entity_ids: list[str]) -> None:
        self._backend.update_entity_links(episode_id, entity_ids)

    def count(self) -> int:
        return self._backend.count()

    def clear(self) -> None:
        items = self._backend.get_all()
        if items:
            self._backend.delete([id_ for id_, _, _ in items])
        self._turn_counter = 0

    def increment_turn(self) -> int:
        self._turn_counter += 1
        return self._turn_counter

    @property
    def turn_count(self) -> int:
        return self._turn_counter

    @property
    def session_id(self) -> str:
        return self._collection_name

    @staticmethod
    def new_id() -> str:
        return str(uuid.uuid4())
