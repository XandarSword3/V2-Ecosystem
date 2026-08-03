-- ============================================================================
-- GDPR Cookie Consent Enhancements
-- 
-- 1. Add consent_version column to gdpr_consents table
-- 2. Create gdpr_cookie_consents table for anonymous (pre-login) consent records
-- 3. RLS policies for the new table
-- ============================================================================

-- 1. Add consent_version to gdpr_consents for tracking which policy version
--    was accepted by authenticated users
ALTER TABLE gdpr_consents
  ADD COLUMN IF NOT EXISTS consent_version TEXT;

-- 2. Create a dedicated table for cookie consent records.
--    Unlike gdpr_consents (which requires user_id FK to auth.users),
--    this table supports anonymous consent records with nullable user_id
--    and hashed IP addresses (GDPR data minimisation).
CREATE TABLE IF NOT EXISTS gdpr_cookie_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,  -- nullable: consent may come before login
    consent_version TEXT NOT NULL,
    categories_accepted TEXT[] NOT NULL DEFAULT '{}',
    categories_rejected TEXT[] NOT NULL DEFAULT '{}',
    ip_address_hash TEXT,  -- SHA-256 hash, not raw IP (GDPR minimisation)
    user_agent TEXT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by user (when authenticated)
CREATE INDEX IF NOT EXISTS idx_gdpr_cookie_consents_user 
  ON gdpr_cookie_consents(user_id) WHERE user_id IS NOT NULL;

-- Index for querying by consent version (for re-consent auditing)
CREATE INDEX IF NOT EXISTS idx_gdpr_cookie_consents_version
  ON gdpr_cookie_consents(consent_version);

-- 3. RLS Policies
ALTER TABLE gdpr_cookie_consents ENABLE ROW LEVEL SECURITY;

-- Allow the service role (backend) to insert consent records for any user
-- (including anonymous). This is needed because the endpoint is unauthenticated.
CREATE POLICY gdpr_cookie_consents_insert ON gdpr_cookie_consents
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- Users can read their own cookie consent records
CREATE POLICY gdpr_cookie_consents_read_own ON gdpr_cookie_consents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all cookie consent records (for auditing)
CREATE POLICY gdpr_cookie_consents_admin_read ON gdpr_cookie_consents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );
