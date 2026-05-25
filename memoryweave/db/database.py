import uuid

from memoryweave.db.postgres import get_db, get_pool, init_db  # noqa: F401 — re-export


def new_uuid() -> str:
    return str(uuid.uuid4())
