import asyncio
import logging
from uuid import uuid4

import asyncpg
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from memoryweave.api.session import get_or_create_session
from memoryweave.auth.models import UserSession
from memoryweave.auth.session import verify_session
from memoryweave.db.database import get_db
from memoryweave.files.parser import ALLOWED_EXTENSIONS, chunk_text, parse_file
from memoryweave.models.config_repo import ModelConfigRepo

router = APIRouter(prefix="/api")
_logger = logging.getLogger(__name__)

_MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/files/upload")
async def upload_file(
    file: UploadFile,
    session_id: str = Form(...),
    provider: str = Form(default="ollama"),
    session: UserSession = Depends(verify_session),
    db: asyncpg.Connection = Depends(get_db),
):
    filename = file.filename or "unnamed"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail=f"Unsupported file type: .{ext}")

    data = await file.read()
    if len(data) > _MAX_FILE_BYTES:
        raise HTTPException(413, detail="File too large (max 5 MB)")

    try:
        text = await asyncio.to_thread(parse_file, data, ext)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(400, detail="File is empty after parsing")

    user_config = await ModelConfigRepo(db).load(session.user_id)
    sess = await get_or_create_session(session_id, provider, user_config=user_config)
    if sess.user_id and sess.user_id != session.user_id:
        raise HTTPException(403)

    doc_id = str(uuid4())
    await db.execute(
        """INSERT INTO user_documents (id, user_id, filename, file_type, size_bytes, chunk_count, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'processing')""",
        doc_id, session.user_id, filename, ext, len(data), len(chunks),
    )

    kg_node_count = 0
    try:
        for chunk in chunks:
            fused = await asyncio.to_thread(sess.kg.fused_extract, chunk)
            importance = max(fused.importance_score, 0.5)
            episode = sess.episodic.write_document_chunk(chunk, importance)
            entity_names = await sess.kg.update_graph(fused, episode_id=episode.id if episode else "")
            if episode and entity_names:
                sess.episodic.update_entity_links(episode.id, entity_names)
            kg_node_count += len(getattr(fused, "entities", []))

        await db.execute(
            "UPDATE user_documents SET status='ready', kg_node_count=$1 WHERE id=$2",
            kg_node_count, doc_id,
        )
    except Exception:
        _logger.exception("File ingestion failed for doc %s", doc_id)
        await db.execute("UPDATE user_documents SET status='error' WHERE id=$1", doc_id)
        raise HTTPException(500, detail="Ingestion failed — check server logs")

    return {"doc_id": doc_id, "chunk_count": len(chunks), "kg_nodes": kg_node_count}


@router.get("/files")
async def list_files(
    session: UserSession = Depends(verify_session),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, filename, file_type, size_bytes, chunk_count, kg_node_count, status, uploaded_at
           FROM user_documents
           WHERE user_id = $1 AND deleted_at IS NULL
           ORDER BY uploaded_at DESC""",
        session.user_id,
    )
    return [
        {
            "id": str(r["id"]),
            "filename": r["filename"],
            "file_type": r["file_type"],
            "size_bytes": r["size_bytes"],
            "chunk_count": r["chunk_count"],
            "kg_nodes": r["kg_node_count"],
            "status": r["status"],
            "uploaded_at": r["uploaded_at"].isoformat(),
        }
        for r in rows
    ]
