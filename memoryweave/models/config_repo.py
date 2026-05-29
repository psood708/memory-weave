from dataclasses import dataclass

import asyncpg

from memoryweave.models.encryption import decrypt, encrypt


@dataclass
class UserModelConfig:
    user_id: str
    provider: str
    chat_model: str | None
    embedding_model: str | None
    judge_model: str | None
    hf_api_key: str | None


class ModelConfigRepo:
    def __init__(self, db: asyncpg.Connection):
        self._db = db

    async def save(
        self,
        user_id: str,
        provider: str,
        chat_model: str | None = None,
        embedding_model: str | None = None,
        judge_model: str | None = None,
        hf_api_key: str | None = None,
    ) -> None:
        enc_key = encrypt(hf_api_key) if hf_api_key else None
        await self._db.execute(
            """
            INSERT INTO user_model_configs
                (user_id, provider, chat_model, embedding_model, judge_model, hf_api_key_enc)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE SET
                provider        = EXCLUDED.provider,
                chat_model      = EXCLUDED.chat_model,
                embedding_model = EXCLUDED.embedding_model,
                judge_model     = EXCLUDED.judge_model,
                hf_api_key_enc  = COALESCE(EXCLUDED.hf_api_key_enc, user_model_configs.hf_api_key_enc),
                updated_at      = NOW()
            """,
            user_id, provider, chat_model, embedding_model, judge_model, enc_key,
        )

    async def load(self, user_id: str) -> UserModelConfig | None:
        row = await self._db.fetchrow(
            "SELECT * FROM user_model_configs WHERE user_id = $1", user_id
        )
        if row is None:
            return None
        raw_key = row["hf_api_key_enc"]
        hf_key = decrypt(bytes(raw_key)) if raw_key else None
        return UserModelConfig(
            user_id=row["user_id"],
            provider=row["provider"],
            chat_model=row["chat_model"],
            embedding_model=row["embedding_model"],
            judge_model=row["judge_model"],
            hf_api_key=hf_key,
        )
