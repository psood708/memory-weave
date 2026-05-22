CREATE TABLE IF NOT EXISTS user_model_configs (
    user_id         TEXT PRIMARY KEY REFERENCES users(id),
    provider        TEXT NOT NULL DEFAULT 'ollama',
    chat_model      TEXT,
    embedding_model TEXT,
    judge_model     TEXT,
    hf_api_key_enc  BLOB,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
