-- Add missing columns identified in audit report (Phase 1C)
-- This migration adds: roles.is_system, roles.slug, loyalty_accounts.tier_name, memberships.expires_at

-- ============================================================
-- 1. Add is_system and slug columns to roles table
-- ============================================================

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(50);

-- Add unique constraint on slug (per tenant if tenant_id exists)
DO $$
BEGIN
  -- Check if tenant_id column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'roles' 
    AND column_name = 'tenant_id'
  ) THEN
    -- Add unique constraint for slug per tenant
    BEGIN
      ALTER TABLE roles
        ADD CONSTRAINT uq_roles_tenant_slug UNIQUE (tenant_id, slug);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  ELSE
    -- Add unique constraint for slug globally
    BEGIN
      ALTER TABLE roles
        ADD CONSTRAINT uq_roles_slug UNIQUE (slug);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Update existing roles to have slug based on name
UPDATE roles
SET slug = LOWER(REPLACE(name, '_', '-'))
WHERE slug IS NULL;

-- Mark system roles as is_system = true
UPDATE roles
SET is_system = true
WHERE name IN ('admin', 'staff', 'customer', 'super_admin');

-- ============================================================
-- 2. Add tier_name to loyalty_accounts view
-- ============================================================
-- loyalty_accounts is a VIEW over loyalty_members table
-- Add tier_name to the underlying table first, then update the view

-- Add tier_name column to loyalty_members table
ALTER TABLE loyalty_members
  ADD COLUMN IF NOT EXISTS tier_name VARCHAR(50);

-- Update the loyalty_accounts view to include tier_name (at end to avoid column conflicts)
CREATE OR REPLACE VIEW loyalty_accounts AS
SELECT
    id,
    user_id,
    tier_id,
    total_points,
    available_points,
    lifetime_points,
    member_since,
    last_activity,
    created_at,
    updated_at,
    tier_name
FROM loyalty_members;

-- ============================================================
-- 3. Add expires_at to memberships table
-- ============================================================

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add index on expires_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_memberships_expires_at
  ON memberships (expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================
-- 4. Add comments for documentation
-- ============================================================

COMMENT ON COLUMN roles.is_system IS 'Indicates if this is a system role that cannot be deleted';
COMMENT ON COLUMN roles.slug IS 'URL-friendly identifier for the role';
COMMENT ON COLUMN loyalty_members.tier_name IS 'Name of the loyalty tier (e.g., Bronze, Silver, Gold)';
COMMENT ON COLUMN memberships.expires_at IS 'Expiration date for the membership';
