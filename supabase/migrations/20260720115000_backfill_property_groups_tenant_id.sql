-- Backfill property_groups.tenant_id from related properties
-- This runs BEFORE 20260720120000_freeze_property_groups_tenant_scoping.sql
-- to fix orphaned property_groups rows

-- First, let's see what we're working with
-- (commented out - for manual inspection if needed)
-- SELECT id, name, tenant_id FROM property_groups WHERE tenant_id IS NULL;

-- Backfill tenant_id from properties that belong to these groups
-- If a property in the group has a tenant_id, use that
UPDATE property_groups pg
SET tenant_id = (
  SELECT DISTINCT p.tenant_id
  FROM properties p
  WHERE p.group_id = pg.id
  AND p.tenant_id IS NOT NULL
  LIMIT 1
)
WHERE pg.tenant_id IS NULL
AND EXISTS (
  SELECT 1 FROM properties p
  WHERE p.group_id = pg.id
  AND p.tenant_id IS NOT NULL
);

-- For any remaining NULL tenant_id rows, they're truly orphaned
-- (no properties in the group have a tenant_id either)
-- These should be deleted - they're data garbage
DELETE FROM property_groups
WHERE tenant_id IS NULL;
