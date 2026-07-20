-- Stage 4 of the tenant-isolation contract freeze
-- (docs/architecture/DATA_OWNERSHIP_CONTRACT.md).
--
-- Closes the one verified gap found during the Stage 3 data-ownership
-- audit: property_groups.tenant_id has no protecting constraint (unlike
-- users.tenant_id, which is deliberately nullable behind chk_scope_tenant)
-- and no code was found anywhere relying on the NULL state. It was simply
-- never finished in the June 24 remediation, which excluded it from its
-- own NOT NULL enforcement loop for reasons the migration itself doesn't
-- explain.
--
-- properties.tenant_id is derived FROM property_groups.tenant_id
-- elsewhere (20260624010000_audit_isolation_remediation.sql), so a NULL
-- here is not contained to this table -- it can propagate to every
-- property in the group.

-- Fail loudly instead of silently forcing NOT NULL over real gaps.
-- If this fires, there are property_groups rows with no tenant -- triage
-- manually (either backfill the correct tenant_id or delete orphaned
-- rows) before re-running this migration.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM property_groups WHERE tenant_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'freeze_property_groups_tenant_scoping: % property_groups row(s) have no tenant_id. Triage before re-running.',
      orphan_count;
  END IF;
END $$;

ALTER TABLE property_groups ALTER COLUMN tenant_id SET NOT NULL;

COMMENT ON COLUMN property_groups.tenant_id IS
  'Owning tenant. NOT NULL as of the Stage 4 contract freeze -- property_groups has no legitimate platform-wide row, unlike users. See docs/architecture/DATA_OWNERSHIP_CONTRACT.md.';
