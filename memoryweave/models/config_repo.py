from dataclasses import dataclass

import aiosqlite

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
    def __init__(self, db: aiosqlite.Connection):
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
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                provider=excluded.provider,
                chat_model=excluded.chat_model,
                embedding_model=excluded.embedding_model,
                judge_model=excluded.judge_model,
                hf_api_key_enc=COALESCE(excluded.hf_api_key_enc, hf_api_key_enc),
                updated_at=CURRENT_TIMESTAMP
            """,
            (user_id, provider, chat_model, embedding_model, judge_model, enc_key),
        )
        await self._db.commit()

    async def load(self, user_id: str) -> UserModelConfig | None:
        cur = await self._db.execute(
            "SELECT * FROM user_model_configs WHERE user_id = ?", (user_id,)
        )
        row = await cur.fetchone()
        if row is None:
            return None
        hf_key = decrypt(row["hf_api_key_enc"]) if row["hf_api_key_enc"] else None
        return UserModelConfig(
            user_id=row["user_id"],
            provider=row["provider"],
            chat_model=row["chat_model"],
            embedding_model=row["embedding_model"],
            judge_model=row["judge_model"],
            hf_api_key=hf_key,
        )
