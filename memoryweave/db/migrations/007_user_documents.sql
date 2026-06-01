CREATE TABLE IF NOT EXISTS user_documents (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename      TEXT        NOT NULL,
    file_type     TEXT        NOT NULL,
    size_bytes    INT         NOT NULL,
    chunk_count   INT         NOT NULL DEFAULT 0,
    kg_node_count INT         NOT NULL DEFAULT 0,
    status        TEXT        NOT NULL DEFAULT 'processing'
                              CHECK (status IN ('processing', 'ready', 'error')),
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_docs_user ON user_documents (user_id) WHERE deleted_at IS NULL;
