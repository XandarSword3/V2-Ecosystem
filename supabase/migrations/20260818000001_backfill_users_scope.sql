-- Migration: backfill users.scope from legacy role/roles
-- Date: 2026-08-18
--
-- users.scope is the single source of truth for the authorization tier
-- (auth.service.ts derives the JWT roles[] claim from it). This backfills
-- scope for rows created before the scope model existed, where a legacy
-- role/roles value is present but scope is still NULL or the DB default
-- 'customer'.
--
-- Rules:
--   * Never overwrite a scope that is already more specific than 'customer'.
--   * Only act when a legacy role value actually exists.
--   * Idempotent — safe to re-run.

-- 4a. From the legacy users.role varchar column.
UPDATE users
SET scope = CASE role
  WHEN 'super_admin'    THEN 'super_admin'::user_scope
  WHEN 'platform_admin' THEN 'platform_admin'::user_scope
  WHEN 'tenant_owner'   THEN 'tenant_owner'::user_scope
  WHEN 'tenant_admin'   THEN 'tenant_admin'::user_scope
  WHEN 'admin'          THEN 'tenant_admin'::user_scope
  WHEN 'manager'        THEN 'property_manager'::user_scope
  WHEN 'staff'          THEN 'property_staff'::user_scope
  ELSE NULL
END
WHERE (scope IS NULL OR scope = 'customer')
  AND role IS NOT NULL
  AND role IN (
    'super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin',
    'admin', 'manager', 'staff'
  );

-- 4b. From the legacy users.roles text[] column (highest tier wins).
WITH ranked AS (
  SELECT
    id,
    CASE
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'super_admin')    THEN 'super_admin'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'platform_admin') THEN 'platform_admin'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'tenant_owner')   THEN 'tenant_owner'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'tenant_admin')   THEN 'tenant_admin'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'admin')          THEN 'tenant_admin'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'manager')        THEN 'property_manager'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'staff')          THEN 'property_staff'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r LIKE '%_admin')     THEN 'property_manager'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r LIKE '%_staff')     THEN 'property_staff'::user_scope
      WHEN EXISTS (SELECT 1 FROM unnest(roles) r WHERE r LIKE '%_manager')   THEN 'property_manager'::user_scope
      ELSE NULL
    END AS mapped_scope
  FROM users
  WHERE (scope IS NULL OR scope = 'customer')
    AND roles IS NOT NULL
    AND cardinality(roles) > 0
)
UPDATE users u
SET scope = r.mapped_scope
FROM ranked r
WHERE u.id = r.id
  AND r.mapped_scope IS NOT NULL;

-- 5. is_platform_admin is derived from scope at runtime; mirror it once so the
-- frozen column doesn't contradict scope during the transition.
UPDATE users
SET is_platform_admin = (scope IN ('super_admin', 'platform_admin'))
WHERE is_platform_admin <> (scope IN ('super_admin', 'platform_admin'));
