-- ============================================================
-- Migration: User Scope Model
--
-- Replaces the legacy `roles TEXT[]` + `role VARCHAR(50)` +
-- `is_platform_admin BOOLEAN` trifecta with a single
-- user_scope enum column as the authorization primitive.
--
-- Also adds two-factor auth columns per the agreed table shape,
-- and drops the legacy columns once data is migrated.
--
-- Data migration priority order (first match wins):
--   1. user_roles → platform-level 'super_admin' role
--      (tenant_id IS NULL — predates the SaaS tenant layer)
--      → super_admin
--   2. is_platform_admin = TRUE (not already mapped)
--      → platform_admin
--   3. user_roles → 'tenant_owner' role
--      → tenant_owner
--   4. user_roles → 'admin' role, NOT also 'tenant_owner'
--      → tenant_admin
--   5. user_roles → 'manager' role
--      → property_manager
--   6. user_roles → 'staff' role
--      → property_staff
--   7. catch-all
--      → customer
--
-- Idempotent — safe to re-run.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Create user_scope enum
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_scope AS ENUM (
    'super_admin',
    'platform_admin',
    'tenant_owner',
    'tenant_admin',
    'property_manager',
    'property_staff',
    'customer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Add scope column — nullable initially so the data
--    migration UPDATE statements can run without violating
--    NOT NULL. Locked in after migration (step 4).
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS scope user_scope;

-- ============================================================
-- 3. Data migration — derive scope from existing signals.
--    Each UPDATE only touches rows still NULL so priority
--    order is respected without subquery overhead.
-- ============================================================

-- 3a. super_admin
--     Matches the seeded platform-root super_admin role.
--     That role has tenant_id IS NULL because it was seeded
--     before the SaaS tenant layer added tenant_id to roles.
UPDATE users u
SET scope = 'super_admin'
WHERE u.scope IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'super_admin'
      AND r.tenant_id IS NULL
  );

-- 3b. platform_admin
--     Any remaining user with is_platform_admin = TRUE who
--     was not caught by 3a.
UPDATE users u
SET scope = 'platform_admin'
WHERE u.scope IS NULL
  AND u.is_platform_admin = TRUE;

-- 3c. tenant_owner
--     Role renamed from 'super_admin' → 'tenant_owner' for
--     tenant-scoped rows in 20260623000000_fix_tenant_super_admin.
UPDATE users u
SET scope = 'tenant_owner'
WHERE u.scope IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'tenant_owner'
  );

-- 3d. tenant_admin
--     Has an 'admin' role in some tenant, but is NOT a
--     tenant_owner (the backfill in the fix migration gave
--     tenant_owners 'admin' too — exclude those).
UPDATE users u
SET scope = 'tenant_admin'
WHERE u.scope IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'admin'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'tenant_owner'
  );

-- 3e. property_manager
UPDATE users u
SET scope = 'property_manager'
WHERE u.scope IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'manager'
  );

-- 3f. property_staff
UPDATE users u
SET scope = 'property_staff'
WHERE u.scope IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name = 'staff'
  );

-- 3g. customer — catch-all for anyone with a tenant_id not matched above
UPDATE users
SET scope = 'customer'
WHERE scope IS NULL
  AND tenant_id IS NOT NULL;

-- 3h. Handle orphaned users (no tenant_id, no platform role)
--     These are legacy users that predate the SaaS tenant layer.
--     Assign them to the first available tenant, or leave as customer
--     with a NULL tenant_id (violates constraint, so we must fix).
--     For now, set to platform_admin if they have is_platform_admin,
--     otherwise we need to assign them a tenant or delete them.
--     Safest approach: assign to the first tenant in the system.
UPDATE users u
SET scope = 'customer',
    tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
WHERE u.scope IS NULL
  AND u.tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM tenants LIMIT 1);

-- 3i. If no tenants exist at all, set to platform_admin as a fallback
--     (this should not happen in production, but handles edge case)
UPDATE users
SET scope = 'platform_admin'
WHERE scope IS NULL
  AND tenant_id IS NULL;

-- ============================================================
-- 4. Lock in NOT NULL + DEFAULT now that every row has a value
-- ============================================================

ALTER TABLE users
  ALTER COLUMN scope SET NOT NULL,
  ALTER COLUMN scope SET DEFAULT 'customer';

-- ============================================================
-- 5. Scope-tenant integrity constraint
--    Only super_admin and platform_admin may have a NULL
--    tenant_id. Every other scope must belong to a tenant.
-- ============================================================

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_scope_tenant;

ALTER TABLE users
  ADD CONSTRAINT chk_scope_tenant
    CHECK (
      scope IN ('super_admin', 'platform_admin')
      OR tenant_id IS NOT NULL
    );

-- ============================================================
-- 6. Two-factor auth columns (per agreed table shape)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_secret  TEXT,
  ADD COLUMN IF NOT EXISTS backup_codes       TEXT[];

-- ============================================================
-- 7. DEPRECATE legacy columns (not dropped yet)
--    role VARCHAR(50)        — pure legacy, scope is the truth
--    roles TEXT[]            — derived in JWT only going forward
--    is_platform_admin BOOL  — derived from scope IN (super_admin, platform_admin)
--
--    NOTE: These columns cannot be dropped yet because ~50 RLS policies
--    reference them. A future cleanup migration will:
--      1. Update all policies to use scope instead of role/roles/is_platform_admin
--      2. Drop these deprecated columns
--
--    For now, the application code (auth middleware, JWT generation) uses
--    the new `scope` column as the source of truth. These legacy columns
--    are ignored by the backend.
-- ============================================================

-- Columns left in place for RLS policy compatibility
-- ALTER TABLE users
--   DROP COLUMN IF EXISTS role,
--   DROP COLUMN IF EXISTS roles,
--   DROP COLUMN IF EXISTS is_platform_admin;

-- ============================================================
-- 8. Index on scope for the auth middleware hot path
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_scope
  ON users (scope);

COMMIT;
