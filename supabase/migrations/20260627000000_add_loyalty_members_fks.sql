-- =============================================================
-- Restore loyalty_members.property_id FK to properties(id).
--
-- Root cause: 20260117153500_tier1_features.sql created
-- loyalty_members with property_id UUID REFERENCES properties(id),
-- but the properties table is not created until
-- 20260202095000_create_properties_table.sql — 85 migrations later.
-- This caused the shadow DB (used by supabase db diff and CI) to
-- fail on fresh installs with "relation properties does not exist".
--
-- Fix: tier1_features now creates property_id as a plain UUID column.
-- This migration adds the FK constraint after properties exists.
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
      AND  kcu.column_name   = 'property_id'
  ) THEN
    ALTER TABLE loyalty_members
      ADD CONSTRAINT fk_loyalty_members_property_id
      FOREIGN KEY (property_id)
      REFERENCES properties(id)
      ON DELETE CASCADE;
  END IF;
END $$;
