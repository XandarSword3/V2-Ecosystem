-- Migration: Add session_type discriminator column to sessions table
-- Fixes MEDIUM #10: sessions table was shared by real login sessions, password-reset
-- tokens, and email-verification tokens with no column distinguishing them.
-- The old "hack" (token === refresh_token means it's a token, not a session) had a
-- real functional bug: sendPasswordResetEmail's cleanup would also delete a pending
-- email-verification token and vice-versa, because both used the same pattern.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'session'
    CHECK (session_type IN ('session', 'password_reset', 'email_verification'));

-- Back-fill any existing rows that are legacy reset/verify tokens.
-- token = refresh_token was the old discriminator; can't distinguish reset from verify,
-- so mark them 'password_reset'. They expire within 24h anyway.
-- This is a no-op on production (no live data).
UPDATE sessions
  SET session_type = 'password_reset'
  WHERE token = refresh_token;

-- Composite index: user_id + session_type on active rows.
-- Speeds up the cleanup queries in sendPasswordResetEmail / sendVerificationEmail.
CREATE INDEX IF NOT EXISTS idx_sessions_user_type
  ON sessions (user_id, session_type)
  WHERE is_active = true;
