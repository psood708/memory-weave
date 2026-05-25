import json
import os
from typing import Protocol, runtime_checkable

import asyncpg


@runtime_checkable
class KGBackend(Protocol):
    async def load(self, user_id: str) -> dict | None: ...
    async def save(self, user_id: str, data: dict) -> None: ...


class FileKGBackend:
    """File-based backend — for local dev and testing without PostgreSQL."""

    def __init__(self, base_dir: str):
        self._base_dir = base_dir

    def _path_for(self, user_id: str) -> str:
        if not user_id:
            return os.path.join(self._base_dir, "kg_store.json")
        user_dir = os.path.join(self._base_dir, "users", user_id)
        os.makedirs(user_dir, exist_ok=True)
        return os.path.join(user_dir, "kg_store.json")

    async def load(self, user_id: str) -> dict | None:
        path = self._path_for(user_id)
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return json.load(f)

    async def save(self, user_id: str, data: dict) -> None:
        path = self._path_for(user_id)
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, path)


class PostgresKGBackend:
    """PostgreSQL-backed KG store — safe for horizontal scale."""

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    async def load(self, user_id: str) -> dict | None:
        if not user_id:
            return None
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT graph_data FROM knowledge_graphs WHERE user_id = $1", user_id
            )
        if row is None:
            return None
        raw = row["graph_data"]
        return json.loads(raw) if isinstance(raw, str) else raw

    async def save(self, user_id: str, data: dict) -> None:
        if not user_id:
            return
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO knowledge_graphs (user_id, graph_data, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET graph_data = $2, updated_at = NOW()
                """,
                user_id, json.dumps(data),
            )
