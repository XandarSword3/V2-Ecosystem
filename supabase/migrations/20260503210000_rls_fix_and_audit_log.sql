-- Migration: Fix RLS Redundancy and Audit Log issues
-- This migration fixes the duplicate policies and ensures user_has_role is robustly defined

BEGIN;

-- 1. Ensure user_has_role() is available
-- Even if it was defined before, we re-define it to ensure it matches the current schema
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

  -- Fast path: check JWT user_metadata
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IS NOT NULL THEN
    IF (auth.jwt() -> 'user_metadata' ->> 'role') = check_role THEN RETURN true; END IF;
    IF check_role = 'admin' AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin' THEN RETURN true; END IF;
  END IF;

  -- Authoritative path: check user_roles junction table
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

-- 2. Clean up redundant policies from previous migrations
-- We prefer the "hardened_" prefix for consistency
DROP POLICY IF EXISTS manager_admin_manage_cash_drawers ON cash_drawers;
DROP POLICY IF EXISTS manager_admin_manage_cash_drawer_transactions ON cash_drawer_transactions;

-- 3. Audit Log Fix
-- Migration 190000 might have failed if user_id was NOT NULL (it isn't, but let's be safe)
-- We record the fix here
INSERT INTO audit_logs (action, resource, details, user_id)
VALUES ('schema_fix', 'system', '{"description": "Consolidated RLS policies and ensured user_has_role function availability"}', NULL);

COMMIT;
