-- ============================================================
-- Migration: Platform-root tenant flag
--
-- Replaces the PLATFORM_ROOT_TENANT_ID env var as the source of truth
-- for "which tenant is allowed to trigger provision_tenant_on_activate".
--
-- Why a column instead of an env var:
--   - tenantGate already loads the full tenant row onto req.tenant on
--     every request. Checking a boolean on that row is free; checking
--     an env var is a second, separately-maintained source of truth
--     that has to be kept in sync by hand after every reseed.
--   - The two guards (modules.controller.ts createModule, and
--     saas-webhook.controller.ts checkout.session.completed) previously
--     disagreed on what an unset/missing value means: one rejected
--     everything, the other bypassed the check entirely. A DB column
--     with no "unset" state removes that asymmetry — no row is root
--     until explicitly marked, so the safe default (reject) is now
--     automatic and identical in both guards.
--
-- The partial unique index guarantees at most one tenant can ever
-- hold the flag, DB-enforced rather than convention-enforced.
--
-- All statements are idempotent — safe to re-run on db reset.
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_platform_root BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_single_platform_root
  ON tenants (is_platform_root)
  WHERE is_platform_root = TRUE;

-- Mark the tenant seeded in 20260621000000_seed_platform_tenant.sql
-- (Alessandro / V2's own tenant, subdomain 'platform') as platform-root.
UPDATE tenants
SET is_platform_root = TRUE
WHERE subdomain = 'platform';
