-- =============================================================================
-- Migration: Unify user roles — deprecate denormalized columns
-- Date: 2026-04-24
--
-- Problem: users.role (VARCHAR) and users.roles (TEXT[]) can disagree,
-- causing silent mismatches between auth middleware and RLS policies.
-- The user_roles junction table (created in 00000000000000_init_users.sql)
-- already exists and is the correct relational model.
--
-- This migration:
--   1. Backfills user_roles from the existing role/roles columns for any user
--      whose junction table entries are missing.
--   2. Adds a DB-level trigger that keeps role/roles in sync with user_roles
--      so existing code that reads those columns continues working during the
--      transition period.
--   3. Adds the unique constraint on user_roles(user_id, role_id) if missing.
--   4. Adds composite index for fast lookup by user_id.
--
-- Phase 2 will remove the role/roles columns entirely once all backend code
-- is reading from user_roles / the junction table.
-- =============================================================================

BEGIN;

-- 1. Ensure the unique constraint exists (idempotent)
DO $$ BEGIN
  ALTER TABLE user_roles ADD CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_id);
EXCEPTION WHEN duplicate_table THEN NULL;
           WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add composite index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- 3. Backfill user_roles from users.role (single string column)
--    For each user, find the matching role row and insert into user_roles if absent.
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT
  u.id AS user_id,
  r.id AS role_id,
  NOW() AS granted_at
FROM users u
JOIN roles r ON r.name = u.role
WHERE u.role IS NOT NULL
  AND u.deleted_at IS NULL
ON CONFLICT ON CONSTRAINT uq_user_roles_user_role DO NOTHING;

-- 4. Backfill from users.roles (TEXT array) — handles multi-role users
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT
  u.id AS user_id,
  r.id AS role_id,
  NOW() AS granted_at
FROM users u
CROSS JOIN LATERAL unnest(u.roles) AS role_name
JOIN roles r ON r.name = role_name
WHERE u.roles IS NOT NULL
  AND array_length(u.roles, 1) > 0
  AND u.deleted_at IS NULL
ON CONFLICT ON CONSTRAINT uq_user_roles_user_role DO NOTHING;

-- 5. Sync trigger: when user_roles changes, keep users.role and users.roles
--    consistent so legacy code reading those columns doesn't break.
CREATE OR REPLACE FUNCTION sync_user_role_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_role_names TEXT[];
BEGIN
  -- Determine which user was affected
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Collect all current role names for that user
  SELECT ARRAY_AGG(r.name ORDER BY r.name)
  INTO v_role_names
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_user_id;

  v_role_names := COALESCE(v_role_names, ARRAY['customer']::TEXT[]);

  -- Write back to the denormalized columns
  -- roles[] gets the full set; role gets the "primary" role by priority
  UPDATE users
  SET
    roles = v_role_names,
    role  = COALESCE(
      -- Priority order: super_admin > admin > manager > *_admin > *_staff > customer > guest
      (SELECT name FROM unnest(v_role_names) AS name
       ORDER BY
         CASE name
           WHEN 'super_admin' THEN 1
           WHEN 'admin'       THEN 2
           WHEN 'manager'     THEN 3
           ELSE 4
         END,
         name
       LIMIT 1),
      'customer'
    )
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_role_columns ON user_roles;

CREATE TRIGGER trg_sync_user_role_columns
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_user_role_columns();

COMMENT ON TRIGGER trg_sync_user_role_columns ON user_roles IS
  'Keeps users.role and users.roles in sync with the user_roles junction table. '
  'These columns are deprecated and will be removed in a future migration once '
  'all application code reads directly from user_roles.';

-- 6. Update user_has_role() RLS helper to prefer the junction table
--    (it currently checks only users.role via the fallback path)
CREATE OR REPLACE FUNCTION public.user_has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  check_role text;
BEGIN
  -- Normalise super_admin → admin for legacy callers
  check_role := CASE WHEN role_name = 'super_admin' THEN 'admin' ELSE role_name END;

  -- Fast path: check JWT user_metadata (set by Supabase Auth on login)
  -- The JWT carries the roles array set when the token was minted.
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IS NOT NULL THEN
    DECLARE
      jwt_role text := auth.jwt() -> 'user_metadata' ->> 'role';
    BEGIN
      IF jwt_role = check_role THEN RETURN true; END IF;
      IF check_role = 'admin' AND jwt_role = 'super_admin' THEN RETURN true; END IF;
      RETURN false;
    END;
  END IF;

  -- Authoritative path: check user_roles junction table
  -- This is the source of truth post-migration.
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND (
        r.name = check_role
        OR (check_role = 'admin' AND r.name = 'super_admin')
      )
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$;

COMMENT ON FUNCTION public.user_has_role(text) IS
  'RLS helper — returns true when the calling user holds the given role. '
  'Checks auth.jwt() metadata first (fast), then queries user_roles junction table. '
  'Updated 2026-04-24: authoritative fallback is now user_roles, not users.role.';

COMMIT;
