-- Migration: Add token_version column to users table
-- Purpose: Enable secure logout-all-devices by version-based token invalidation
-- When token_version is incremented, all previously issued JWTs become invalid

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Add index for efficient lookups during token validation
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(id, token_version);

COMMENT ON COLUMN users.token_version IS 'Incremented on logout-all-devices to invalidate all existing tokens';

-- RPC function to atomically increment token_version
CREATE OR REPLACE FUNCTION increment_token_version(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_version INTEGER;
BEGIN
  UPDATE users 
  SET token_version = token_version + 1 
  WHERE id = p_user_id
  RETURNING token_version INTO new_version;
  
  RETURN new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
