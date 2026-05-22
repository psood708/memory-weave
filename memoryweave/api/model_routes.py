import asyncio

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from huggingface_hub import InferenceClient
from pydantic import BaseModel

from memoryweave.auth.models import UserSession
from memoryweave.auth.session import verify_session
from memoryweave.db.database import get_db
from memoryweave.models.catalog import get_catalog
from memoryweave.models.config_repo import ModelConfigRepo

router = APIRouter(prefix="/api")


@router.get("/models/catalog")
async def models_catalog():
    catalog = get_catalog()
    return {role.value: models for role, models in catalog.items()}


class ModelConfigRequest(BaseModel):
    provider: str = "ollama"
    chat_model: str | None = None
    embedding_model: str | None = None
    judge_model: str | None = None
    hf_api_key: str | None = None


@router.post("/user/model-config")
async def save_model_config(
    req: ModelConfigRequest,
    session: UserSession = Depends(verify_session),
    db: aiosqlite.Connection = Depends(get_db),
):
    if req.provider == "huggingface" and req.hf_api_key:
        try:
            client = InferenceClient(token=req.hf_api_key)
            await asyncio.to_thread(client.whoami)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid HuggingFace API key")

    repo = ModelConfigRepo(db)
    await repo.save(
        user_id=session.user_id,
        provider=req.provider,
        chat_model=req.chat_model,
        embedding_model=req.embedding_model,
        judge_model=req.judge_model,
        hf_api_key=req.hf_api_key,
    )
    return {"status": "saved"}


@router.get("/user/model-config")
async def get_model_config(
    session: UserSession = Depends(verify_session),
    db: aiosqlite.Connection = Depends(get_db),
):
    repo = ModelConfigRepo(db)
    config = await repo.load(session.user_id)
    if config is None:
        return {"configured": False}
    return {
        "configured": True,
        "provider": config.provider,
        "chat_model": config.chat_model,
        "embedding_model": config.embedding_model,
        "judge_model": config.judge_model,
        "hf_api_key": "hf_****" if config.hf_api_key else None,
    }
