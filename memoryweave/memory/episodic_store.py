import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime

import chromadb
from chromadb.config import Settings as ChromaSettings


@dataclass
class Episode:
    id: str
    content: str
    importance_score: float
    timestamp: datetime
    session_id: str
    turn_number: int
    entity_ids: list[str] = field(default_factory=list)

    def to_metadata(self) -> dict:
        return {
            "importance_score": self.importance_score,
            "timestamp": self.timestamp.isoformat(),
            "session_id": self.session_id,
            "turn_number": self.turn_number,
            "entity_ids": ",".join(self.entity_ids),
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
        )


class EpisodicStore:
    """ChromaDB-backed episodic memory store with importance scoring and decay."""

    def __init__(self, collection_name: str = "episodes", persist_dir: str = ".chroma"):
        from memoryweave.core.config import settings as _settings
        self._settings = _settings
        if _settings.chroma_host:
            self._client = chromadb.HttpClient(
                host=_settings.chroma_host,
                port=_settings.chroma_port,
            )
        else:
            self._client = chromadb.PersistentClient(
                path=persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self._turn_counter: int = self._bootstrap_turn_counter()

    def _bootstrap_turn_counter(self) -> int:
        if self._collection.count() == 0:
            return 0
        items = self._collection.get(include=["metadatas"])
        if not items["metadatas"]:
            return 0
        return max(int(m.get("turn_number", 0)) for m in items["metadatas"])

    def write(self, episode: Episode) -> None:
        self._collection.upsert(
            ids=[episode.id],
            documents=[episode.content],
            metadatas=[episode.to_metadata()],
        )

    def retrieve(self, query: str, top_k: int = 5) -> list[Episode]:
        if self._collection.count() == 0:
            return []
        results = self._collection.query(
            query_texts=[query],
            n_results=min(top_k, self._collection.count()),
            include=["documents", "metadatas"],
        )
        episodes = []
        for id_, doc, meta in zip(
            results["ids"][0], results["documents"][0], results["metadatas"][0]
        ):
            episodes.append(Episode.from_metadata(id_, doc, meta))
        return episodes

    def apply_decay(self, current_turn: int, decay_lambda: float) -> None:
        """Exponential decay: score(t) = score(0) × e^(-λ × Δturns)."""
        if self._collection.count() == 0:
            return
        all_items = self._collection.get(include=["documents", "metadatas"])
        ids_to_update, docs_to_update, metas_to_update = [], [], []
        ids_to_delete = []

        for id_, doc, meta in zip(
            all_items["ids"], all_items["documents"], all_items["metadatas"]
        ):
            delta = current_turn - int(meta["turn_number"])
            decayed = float(meta["importance_score"]) * math.exp(-decay_lambda * delta)
            if decayed < self._settings.episodic_min_importance:
                ids_to_delete.append(id_)
            else:
                meta["importance_score"] = decayed
                ids_to_update.append(id_)
                docs_to_update.append(doc)
                metas_to_update.append(meta)

        if ids_to_delete:
            self._collection.delete(ids=ids_to_delete)
        if ids_to_update:
            self._collection.upsert(
                ids=ids_to_update, documents=docs_to_update, metadatas=metas_to_update
            )

    def _maybe_decay(self, decay_lambda: float) -> None:
        if self._turn_counter % self._settings.episodic_decay_interval == 0:
            self.apply_decay(self._turn_counter, decay_lambda)

    def update_entity_links(self, episode_id: str, entity_ids: list[str]) -> None:
        results = self._collection.get(ids=[episode_id], include=["documents", "metadatas"])
        if not results["ids"]:
            return
        meta = results["metadatas"][0]
        meta["entity_ids"] = ",".join(entity_ids)
        self._collection.upsert(
            ids=[episode_id],
            documents=results["documents"],
            metadatas=[meta],
        )

    def count(self) -> int:
        return self._collection.count()

    def clear(self) -> None:
        """Delete all episodes and reset the turn counter."""
        ids = self._collection.get()["ids"]
        if ids:
            self._collection.delete(ids=ids)
        self._turn_counter = 0

    def increment_turn(self) -> int:
        self._turn_counter += 1
        return self._turn_counter

    @property
    def turn_count(self) -> int:
        return self._turn_counter

    @staticmethod
    def new_id() -> str:
        return str(uuid.uuid4())
