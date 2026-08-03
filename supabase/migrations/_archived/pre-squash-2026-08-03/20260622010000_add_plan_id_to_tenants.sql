-- ============================================================
-- Migration: Link tenants to plans via plan_id
--
-- Problem this fixes: tenants.feature_limits was a one-time snapshot
-- written by provisioning.service.ts's hardcoded defaultFeatureLimits()
-- function — completely disconnected from the plans table's
-- feature_limits column (the one editable via the admin Plans CRUD).
-- Editing a plan's limits in the UI had zero effect on anyone, ever,
-- including brand-new signups.
--
-- This migration adds the FK. provisioning.service.ts and
-- tenantAccess.middleware.ts are updated in the same change to:
--   - look up the real plan row at signup time instead of using the
--     hardcoded duplicate (new signups now reflect live plan data)
--   - resolve feature_limits LIVE off the linked plan on every tenant
--     lookup, so editing a plan's limits in the CRUD immediately
--     applies to every tenant on that plan (within the existing 30s
--     tenant-cache TTL) — this is the standard "limits belong to the
--     plan, not the tenant" SaaS model.
--
-- tenants.feature_limits is NOT dropped. It remains as:
--   (a) the fallback for any tenant with plan_id IS NULL (legacy /
--       single-tenant / dev-mode tenants that predate this migration
--       and have no matching plans row)
--   (b) a per-tenant override mechanism, if one is ever needed later
--       (e.g. a custom enterprise deal with non-standard limits)
--
-- Backfill: existing tenants are linked to their plan by matching
-- subscription_tier (the legacy enum) against plans.code, since that's
-- exactly the same string by convention (see provisioning.service.ts's
-- ProvisioningInput.tier / 20260621000001_create_plans_table.sql's
-- seeded codes). Safe no-op if the plans table is empty or a tenant's
-- tier has no matching plan row — plan_id just stays NULL and that
-- tenant falls back to its existing feature_limits snapshot, same
-- behavior as today.
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_plan_id
  ON tenants (plan_id)
  WHERE plan_id IS NOT NULL;

-- Backfill existing tenants by matching tier enum text to plans.code
UPDATE tenants t
SET plan_id = p.id
FROM plans p
WHERE p.code = t.subscription_tier::TEXT
  AND t.plan_id IS NULL;

COMMENT ON COLUMN tenants.plan_id IS
  'FK to plans.id — the live source of truth for this tenant''s feature_limits '
  '(resolved by tenantAccess.middleware.ts on every tenant lookup). NULL means '
  'no matching plan row was found (legacy tenant); falls back to the snapshot '
  'in tenants.feature_limits in that case. Set at provisioning time by '
  'provisioning.service.ts and refreshed on tier change by '
  'ProvisioningService.updateBillingStatus().';