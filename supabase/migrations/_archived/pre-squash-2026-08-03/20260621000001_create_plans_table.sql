-- ============================================================
-- Migration: Plans Table
--
-- Replaces the hardcoded subscription_tier enum with a real,
-- database-driven, super-admin-editable plans table.
--
-- Design mirrors module_templates:
--   code            → engine_type  (plan identifier)
--   feature_limits  → default_settings (what the plan unlocks)
--   sort_order      → display order on pricing page
--
-- Prices stored as integer cents to avoid floating-point drift.
-- Both monthly and annual prices live on the same row — simpler
-- for a CRUD UI than one row per billing interval.
--
-- The existing tenants.subscription_tier enum is NOT removed here.
-- That column stays as a backward-compat signal while Engine E
-- is being built. A future migration will add plan_id FK to tenants
-- and retire subscription_tier once the billing flow is live.
--
-- RLS: active plans are readable by all (pricing page).
--      Write access is platform admin only.
-- ============================================================

-- ============================================================
-- 1. Plans table
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  code                     TEXT NOT NULL UNIQUE,   -- 'starter' | 'growth' | 'enterprise'
  name                     TEXT NOT NULL,          -- display name: 'Starter', 'Growth', etc.
  description              TEXT,

  -- Pricing (in cents — avoids floating-point drift)
  price_monthly_cents      INTEGER NOT NULL DEFAULT 0,
  price_annual_cents       INTEGER NOT NULL DEFAULT 0,

  -- Feature limits (what this plan unlocks)
  -- Mirrors module_templates.default_settings
  -- Keys: max_properties, max_modules, max_users, etc. (-1 = unlimited)
  feature_limits           JSONB NOT NULL DEFAULT '{}',

  -- Stripe (set when plans are connected to Stripe Products)
  stripe_monthly_price_id  TEXT,
  stripe_annual_price_id   TEXT,

  -- Display / lifecycle
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order               INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_plans_code
  ON plans (code);

CREATE INDEX IF NOT EXISTS idx_plans_active
  ON plans (is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_plans_sort
  ON plans (sort_order);

-- ============================================================
-- 3. Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plans_updated_at ON plans;
CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_plans_updated_at();

-- ============================================================
-- 4. RLS
--    Active plans: readable by everyone (public pricing page)
--    Write: platform admin only (via service role in middleware)
-- ============================================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_public_read ON plans;
CREATE POLICY plans_public_read ON plans
  FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS plans_service_role_all ON plans;
CREATE POLICY plans_service_role_all ON plans
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS plans_platform_admin_write ON plans;
CREATE POLICY plans_platform_admin_write ON plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::TEXT::UUID
        AND u.is_platform_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::TEXT::UUID
        AND u.is_platform_admin = TRUE
    )
  );

-- ============================================================
-- 4b. Base table-level GRANTs.
--
-- FIX (21 June 2026, eighth session): RLS policies and base SQL
-- table privileges are two SEPARATE gates in Postgres. service_role
-- has rolbypassrls = TRUE on this project (confirmed via pg_roles),
-- which skips RLS policy evaluation entirely -- but BYPASSRLS does
-- NOT skip the base GRANT check. This table was created with no
-- explicit GRANTs at all (confirmed via information_schema.role_
-- table_grants -- only 'postgres' had any privileges on it), so
-- every request from the app's service-role Supabase client failed
-- with "permission denied for table plans" before RLS was ever
-- consulted, regardless of how correct the policies above are.
--
-- Most tables in this codebase apparently rely on a project-level
-- ALTER DEFAULT PRIVILEGES rule from initial Supabase setup to get
-- these grants automatically; this table evidently didn't inherit
-- that (or the rule doesn't cover tables created via the CLI/migration
-- path). Granting explicitly here removes the dependency on that
-- assumption entirely for this table.
GRANT ALL ON plans TO service_role;
GRANT SELECT ON plans TO anon, authenticated;

-- ============================================================
-- 5. Seed the 3 plans that currently exist as hardcoded enum
--    values, so the DB reflects reality from day one.
--
--    Prices are placeholders — Alessandro sets the real numbers
--    through the CRUD UI (item 3) before going live.
-- ============================================================

INSERT INTO plans (code, name, description, price_monthly_cents, price_annual_cents, feature_limits, is_active, sort_order)
VALUES
  (
    'starter',
    'Starter',
    'For small venues getting started with one location.',
    2900,
    29000,
    '{"max_properties": 1, "max_modules": 3, "max_users": 5}'::jsonb,
    TRUE,
    1
  ),
  (
    'growth',
    'Growth',
    'For growing operations with multiple properties.',
    7900,
    79000,
    '{"max_properties": 5, "max_modules": 15, "max_users": 25}'::jsonb,
    TRUE,
    2
  ),
  (
    'enterprise',
    'Enterprise',
    'Unlimited access for large portfolios. White-glove onboarding included.',
    19900,
    199000,
    '{"max_properties": -1, "max_modules": -1, "max_users": -1}'::jsonb,
    TRUE,
    3
  )
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE plans IS
  'Database-driven SaaS subscription plans. Replaces the hardcoded subscription_tier enum on tenants. '
  'Prices in cents. feature_limits JSONB mirrors module_templates.default_settings. '
  'Writable only by platform admins via the Engine E admin dashboard.';
