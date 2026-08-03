-- Add index on sessions.refresh_token for faster token lookup during refresh/revocation
-- Also add index on sessions.expires_at for efficient cleanup of expired sessions

CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions (refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_is_active ON sessions (user_id, is_active);
