-- Add missing index for biometric credentials lookups
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_credential_id ON biometric_credentials(credential_id);

-- Ensure user_id is indexed for listing credentials
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_user_id ON biometric_credentials(user_id);
