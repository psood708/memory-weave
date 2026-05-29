CREATE TABLE IF NOT EXISTS knowledge_graphs (
    user_id     TEXT PRIMARY KEY REFERENCES users(id),
    graph_data  TEXT NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
