-- ============================================================
-- Migration: tenant_integrations table
--
-- Fixes Critical #1/#2 from the multi-tenant audit: per-tenant SMTP,
-- Stripe, SiteMinder, door lock, and WhatsApp credentials previously had
-- nowhere to live except process.env — meaning one tenant's onboarding
-- flow (finalizeOnboarding) mutated process.env.STRIPE_SECRET_KEY /
-- SMTP_PASS / SENDGRID_API_KEY for the entire Node process, silently
-- replacing every other tenant's credentials on the same instance.
--
-- This table gives each tenant its own row per integration type.
-- Secrets are stored encrypted (AES-256-GCM via secretsManager.encrypt(),
-- see backend/src/config/secrets.config.ts) — never plaintext.
--
-- Non-secret settings (host, port, fromEmail, propertyId, publicKey, etc.)
-- live in `config` JSONB; the secret itself (API key / password / token)
-- lives in `credentials_encrypted`.
--
-- RLS: service-role only, same pattern as the tenants table itself
-- (20260526000000_saas_tenant_layer.sql) — this table holds credentials,
-- so it must never be reachable via the anon/authenticated Supabase roles.
--
-- NOTE: this migration only creates the storage layer. Wiring the actual
-- runtime read paths (Stripe charge processing, email sending, SiteMinder
-- API calls) to pull from this table instead of process.env is a separate,
-- higher-blast-radius follow-up — see CONTEXT.md.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_type      TEXT NOT NULL CHECK (integration_type IN (
                           'stripe', 'smtp', 'sendgrid', 'siteminder', 'door_lock', 'whatsapp'
                         )),
  -- Non-secret settings: host, port, fromEmail, propertyId, publicKey, etc.
  config                JSONB NOT NULL DEFAULT '{}',
  -- Ciphertext from secretsManager.encrypt() — IV + AuthTag + AES-256-GCM
  -- ciphertext, base64-encoded. NULL if this integration has no secret yet
  -- (e.g. SMTP configured with no auth, or row created but not finished).
  credentials_encrypted TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_integrations_tenant_type UNIQUE (tenant_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant
  ON tenant_integrations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_type
  ON tenant_integrations (integration_type);

-- Auto-update updated_at on change (same pattern as update_tenants_updated_at)
CREATE OR REPLACE FUNCTION update_tenant_integrations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_integrations_updated_at ON tenant_integrations;
CREATE TRIGGER trg_tenant_integrations_updated_at
  BEFORE UPDATE ON tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION update_tenant_integrations_updated_at();

-- ============================================================
-- RLS — service-role only (holds encrypted credentials)
-- ============================================================

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_integrations_service_role_all ON tenant_integrations;
CREATE POLICY tenant_integrations_service_role_all
  ON tenant_integrations
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE tenant_integrations IS
  'Per-tenant third-party integration config + encrypted credentials (Stripe, SMTP, SendGrid, SiteMinder, door locks, WhatsApp). Secrets are encrypted at rest via secretsManager.encrypt() (AES-256-GCM, ENCRYPTION_KEY) — never store plaintext here. Service-role access only.';

COMMENT ON COLUMN tenant_integrations.credentials_encrypted IS
  'Ciphertext from secretsManager.encrypt(). Decrypt with secretsManager.decrypt() before use; never log or return this column to clients.';
