CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    google_sub  TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL,
    name        TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
