-- Stage 1 of the tenant-isolation/module-engine contract freeze
-- (docs/architecture/MODULE_ENGINE_CONTRACT.md).
--
-- Backfills any remaining NULL modules.engine_type from the full
-- 8-alias legacy template_type mapping, then locks the column down:
-- NOT NULL + CHECK restricted to the 5 canonical engine types.
--
-- This supersedes the partial 3-alias backfill in
-- 20260529000001_modules_engine_type.sql, which only covered
-- menu_service / multi_day_booking / session_access. Five more
-- aliases have been found live in backend code since then
-- (backend/src/security/template-permission-presets.ts,
-- backend/src/modules/analytics/metrics-layer.service.ts,
-- backend/src/routes/dynamic-module.router.ts) and are folded in here
-- so no known template_type value is left unmapped.

UPDATE modules SET engine_type = CASE template_type
  WHEN 'menu_service'        THEN 'instant_transaction'
  WHEN 'multi_day_booking'   THEN 'time_exclusive_reservation'
  WHEN 'session_access'      THEN 'shared_capacity_access'
  WHEN 'subscription'        THEN 'ongoing_entitlement'
  WHEN 'membership_access'   THEN 'ongoing_entitlement'
  WHEN 'class_scheduling'    THEN 'shared_capacity_access'
  WHEN 'appointment_booking' THEN 'time_exclusive_reservation'
  WHEN 'saas_subscription'   THEN 'platform_entitlement'
  ELSE engine_type
END
WHERE engine_type IS NULL;

-- Fail loudly instead of silently forcing NOT NULL on unmappable rows.
-- If this fires, there's a template_type value in the live table that
-- isn't in the 8-alias closed list above -- triage it manually
-- (either it's a genuine 9th alias that needs a product decision, or
-- it's bad data) before re-running this migration.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM modules WHERE engine_type IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'freeze_modules_engine_type: % module row(s) have no resolvable engine_type. Triage before re-running.',
      orphan_count;
  END IF;
END $$;

ALTER TABLE modules ALTER COLUMN engine_type SET NOT NULL;

ALTER TABLE modules DROP CONSTRAINT IF EXISTS chk_modules_engine_type;

ALTER TABLE modules
  ADD CONSTRAINT chk_modules_engine_type CHECK (engine_type IN (
    'instant_transaction',
    'time_exclusive_reservation',
    'shared_capacity_access',
    'ongoing_entitlement',
    'platform_entitlement'
  ));

COMMENT ON COLUMN modules.engine_type IS
  'Canonical engine type per Architecture Law. NOT NULL, CHECK-constrained to the 5 engines. See docs/architecture/MODULE_ENGINE_CONTRACT.md.';

COMMENT ON COLUMN modules.template_type IS
  'FROZEN legacy compat column. Read-only as of the Stage 1 contract freeze -- no new code may read or write it. Resolve engine identity via modules.engine_type only. See docs/architecture/MODULE_ENGINE_CONTRACT.md.';
