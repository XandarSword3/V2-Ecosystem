-- Migration: Add biometric_credentials table
-- Purpose: Store public keys for WebAuthn/passkey/biometric authentication
-- Supports Face ID, Touch ID, Fingerprint, and other biometric methods

CREATE TABLE IF NOT EXISTS biometric_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT, -- 'face_id', 'touch_id', 'fingerprint', 'security_key'
  device_name TEXT, -- User-friendly name like "iPhone 15 Pro"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_user_id ON biometric_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_credential_id ON biometric_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_active ON biometric_credentials(user_id, is_active) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE biometric_credentials IS 'Stores WebAuthn/passkey credentials for biometric authentication';
COMMENT ON COLUMN biometric_credentials.credential_id IS 'Base64 encoded credential ID from WebAuthn';
COMMENT ON COLUMN biometric_credentials.public_key IS 'Base64 encoded public key from WebAuthn';
COMMENT ON COLUMN biometric_credentials.counter IS 'Signature counter for replay attack prevention';
COMMENT ON COLUMN biometric_credentials.device_type IS 'Type of biometric: face_id, touch_id, fingerprint, security_key';
