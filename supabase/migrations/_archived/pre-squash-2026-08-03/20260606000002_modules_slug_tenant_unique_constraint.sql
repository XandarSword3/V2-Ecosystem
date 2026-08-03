-- Ensure modules has a tenant_id column (added to other tables in saas_tenant_layer)
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

DO $$
BEGIN
  -- Drop the old single-column unique constraint on slug so that two different
  -- tenants can independently own the same slug (e.g. both create "vip-lounge").
  -- The application layer (createModule) already scopes uniqueness per tenant_id;
  -- this migration brings the DB constraint into alignment with that logic.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'modules'
      AND indexname  = 'modules_slug_key'
  ) THEN
    ALTER TABLE modules DROP CONSTRAINT modules_slug_key;
  END IF;

  -- Add composite unique constraint: (slug, tenant_id).
  -- NULL tenant_id rows (unscoped platform modules) still conflict with each other
  -- because NULL != NULL in UNIQUE indexes — wrap with COALESCE if needed, but for
  -- now the existing NULL-safe behaviour is acceptable.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'modules'
      AND indexname  = 'idx_modules_slug_tenant'
  ) THEN
    CREATE UNIQUE INDEX idx_modules_slug_tenant ON modules (slug, tenant_id);
  END IF;
END $$;
