ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'google';
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_sub ON users(provider, google_sub);
