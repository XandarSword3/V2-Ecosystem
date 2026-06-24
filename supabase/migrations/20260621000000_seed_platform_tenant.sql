-- ============================================================
-- Migration: Seed Platform Tenant (Alessandro / V2 as tenant #1)
--
-- Inserts Alessandro's tenant row, links existing property_groups
-- to it, and marks the super_admin user as platform admin.
--
-- billing_status starts as 'trialing' — Engine E's documented
-- initialState. This is not a bypass; it IS the state machine's
-- entry point. Stripe will drive transitions from here.
--
-- subscription_tier is 'enterprise' — the platform operator runs
-- on full access; this is not a customer-facing plan selection.
--
-- subdomain 'platform' matches the dev alias platform.localhost:3000
-- and will match the registered prod domain (v2platform.com or
-- equivalent) once that's configured.
--
-- All statements are idempotent — safe to re-run on db reset.
-- ============================================================

-- ============================================================
-- 1. Insert Alessandro as tenant #1
-- ============================================================

INSERT INTO tenants (
  subdomain,
  subscription_tier,
  billing_status,
  feature_limits,
  trial_ends_at
)
VALUES (
  'platform',
  'enterprise',
  'trialing',
  '{}'::jsonb,
  NULL
)
ON CONFLICT (subdomain) DO NOTHING;

-- ============================================================
-- 2. Link all existing property_groups to this tenant.
--    All current groups belong to Alessandro — there are no
--    other tenants yet. New tenants provisioned via Engine E
--    will have their own groups from birth.
-- ============================================================

UPDATE property_groups
SET tenant_id = (SELECT id FROM tenants WHERE subdomain = 'platform')
WHERE tenant_id IS NULL;

-- ============================================================
-- 3. Backlink: set property_group_id on the tenant to its
--    primary (oldest) property group.
-- ============================================================

UPDATE tenants
SET property_group_id = (
  SELECT id
  FROM property_groups
  WHERE tenant_id = (SELECT id FROM tenants WHERE subdomain = 'platform')
  ORDER BY id ASC
  LIMIT 1
)
WHERE subdomain = 'platform'
  AND property_group_id IS NULL;

-- ============================================================
-- 4. Mark the super_admin user as platform admin and link
--    them to this tenant.
-- ============================================================

UPDATE users
SET
  is_platform_admin = TRUE,
  tenant_id         = (SELECT id FROM tenants WHERE subdomain = 'platform')
WHERE email = 'admin@v2ecosystem.com';
