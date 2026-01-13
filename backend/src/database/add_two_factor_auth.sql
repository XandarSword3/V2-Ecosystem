-- Migration: Add two-factor authentication tables
-- This adds support for TOTP-based 2FA with backup codes

-- Add 2FA flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;

-- Table for pending 2FA setups (temporary, expires after 10 minutes)
CREATE TABLE IF NOT EXISTS two_factor_pending (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret TEXT NOT NULL,
    backup_codes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Create index on expiry for cleanup
CREATE INDEX IF NOT EXISTS idx_two_factor_pending_expires ON two_factor_pending(expires_at);

-- Table for active 2FA configurations
CREATE TABLE IF NOT EXISTS two_factor_auth (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret TEXT NOT NULL,
    backup_codes TEXT[] NOT NULL DEFAULT '{}',
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE two_factor_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_auth ENABLE ROW LEVEL SECURITY;

-- Users can only see their own 2FA data
CREATE POLICY "Users can manage their own 2FA pending" ON two_factor_pending
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can view their own 2FA" ON two_factor_auth
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Service role can manage all (for backend operations)
CREATE POLICY "Service role full access pending" ON two_factor_pending
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Service role full access auth" ON two_factor_auth
    FOR ALL
    TO service_role
    USING (true);

-- Comments
COMMENT ON TABLE two_factor_pending IS 'Temporary storage for 2FA setup process';
COMMENT ON TABLE two_factor_auth IS 'Active 2FA configurations with encrypted secrets';
COMMENT ON COLUMN two_factor_auth.secret IS 'AES-256 encrypted TOTP secret';
COMMENT ON COLUMN two_factor_auth.backup_codes IS 'SHA-256 hashed backup codes';
