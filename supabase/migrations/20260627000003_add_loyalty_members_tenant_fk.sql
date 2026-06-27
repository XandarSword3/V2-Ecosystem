-- =============================================================
-- Restore loyalty_members.tenant_id FK to tenants(id).
--
-- Root cause: same chain-order bug as 20260627000000, second instance
-- in the same table. 20260117153500_tier1_features.sql created
-- loyalty_members with tenant_id UUID REFERENCES tenants(id), but the
-- tenants table is not created until 20260526000000_saas_tenant_layer.sql
-- — over 100 migrations later. This broke fresh installs (shadow DB /
-- CI) with "relation tenants does not exist", surfaced by re-running
-- supabase db diff after fixing the property_id FK in the prior migration.
--
-- Fix: tier1_features now creates tenant_id as a plain UUID column.
-- This migration adds the FK constraint after tenants exists.
-- On the live DB the column already has the FK — the IF NOT EXISTS
-- guard makes this a no-op for the remote, and fixes CI fresh installs.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.key_column_usage  kcu
           ON tc.constraint_name = kcu.constraint_name
    WHERE  tc.table_name     = 'loyalty_members'
      AND  tc.constraint_type = 'FOREIGN KEY'
      AND  kcu.column_name   = 'tenant_id'
  ) THEN
    ALTER TABLE loyalty_members
      ADD CONSTRAINT fk_loyalty_members_tenant_id
      FOREIGN KEY (tenant_id)
      REFERENCES tenants(id)
      ON DELETE CASCADE;
  END IF;
END $$;
