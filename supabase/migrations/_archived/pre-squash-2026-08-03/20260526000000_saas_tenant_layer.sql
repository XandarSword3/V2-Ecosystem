-- ============================================================
-- Migration: SaaS Tenant Layer (Step 2)
-- 
-- Creates the tenants table and adds tenant_id FK to property_groups,
-- users, and roles. Also adds is_platform_admin to users.
--
-- The tenants table sits above property_groups in the hierarchy:
--   tenants → property_groups → properties → modules
--
-- RLS: Tenants table is service-role only (bypasses RLS).
--      Existing RLS on all other tables is unchanged.
-- ============================================================

-- ============================================================
-- 1. Subscription tier and billing status enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('starter', 'growth', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_status AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Tenants table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain             TEXT NOT NULL UNIQUE,
  property_group_id     UUID REFERENCES property_groups(id) ON DELETE SET NULL,
  subscription_tier     subscription_tier NOT NULL DEFAULT 'starter',
  billing_status        billing_status NOT NULL DEFAULT 'trialing',
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT UNIQUE,          -- idempotency key for provisioning
  feature_limits        JSONB NOT NULL DEFAULT '{}',
  trial_ends_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain
  ON tenants (subdomain);

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_subscription
  ON tenants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_billing_status
  ON tenants (billing_status);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

-- ============================================================
-- 3. Link property_groups → tenants (soft FK — nullable for
--    existing single-tenant deployments)
-- ============================================================

ALTER TABLE property_groups
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_property_groups_tenant
  ON property_groups (tenant_id)
  WHERE tenant_id IS NOT NULL;

-- ============================================================
-- 4. Tenant-scope users and roles
--    (nullable — existing rows remain valid in single-tenant mode)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_tenant
  ON users (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_platform_admin
  ON users (is_platform_admin)
  WHERE is_platform_admin = TRUE;

-- ============================================================
-- 5. Tenant-scope roles
--    Add tenant_id so the same role name can exist across tenants.
-- ============================================================

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add description and permissions columns if missing (some older schemas lack them)
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';

-- Unique constraint: role name must be unique per tenant
DO $$ BEGIN
  ALTER TABLE roles
    ADD CONSTRAINT uq_roles_tenant_name UNIQUE (tenant_id, name);
EXCEPTION WHEN duplicate_table THEN NULL;
          WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. RLS — tenants table is platform-admin only
--    All access via service role (middleware) or platform_admin check.
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write tenants
DROP POLICY IF EXISTS tenants_service_role_all ON tenants;
CREATE POLICY tenants_service_role_all
  ON tenants
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Authenticated users with is_platform_admin flag can SELECT
-- (for the control plane dashboard — reads are proxied via the backend anyway,
--  but this policy provides defence-in-depth)
DROP POLICY IF EXISTS tenants_platform_admin_read ON tenants;
CREATE POLICY tenants_platform_admin_read
  ON tenants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::TEXT::UUID
        AND u.is_platform_admin = TRUE
    )
  );

-- ============================================================
-- 7. Engine feature flags — ensure tenant_id column exists
-- ============================================================

ALTER TABLE engine_feature_flags
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- 8. Helpful view for the control plane dashboard
-- ============================================================

CREATE OR REPLACE VIEW v_tenant_overview AS
SELECT
  t.id,
  t.subdomain,
  t.subscription_tier,
  t.billing_status,
  t.stripe_customer_id,
  t.stripe_subscription_id,
  t.trial_ends_at,
  t.created_at,
  pg.name AS group_name,
  COUNT(DISTINCT p.id) AS property_count
FROM tenants t
LEFT JOIN property_groups pg ON pg.id = t.property_group_id
LEFT JOIN properties p ON p.group_id = pg.id
GROUP BY t.id, pg.name;

COMMENT ON VIEW v_tenant_overview IS
  'Aggregated tenant view for the control plane dashboard. Service role only.';
