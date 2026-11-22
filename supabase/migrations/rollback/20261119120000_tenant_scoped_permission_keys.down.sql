-- Rollback for 20261119120000_tenant_scoped_permission_keys.sql.
--
-- Fails if two tenants currently own the same permission slug (or the same
-- role_name + permission_slug), because the legacy keys cannot represent that
-- state. Resolve those duplicates or delete the newer tenant's rows first.

BEGIN;

ALTER TABLE public.app_role_permissions
  DROP CONSTRAINT IF EXISTS app_role_permissions_permission_fkey;

ALTER TABLE public.app_role_permissions
  DROP CONSTRAINT IF EXISTS app_role_permissions_pkey;

ALTER TABLE public.app_role_permissions
  ADD CONSTRAINT app_role_permissions_pkey
  PRIMARY KEY (role_name, permission_slug);

ALTER TABLE public.app_permissions
  DROP CONSTRAINT IF EXISTS app_permissions_pkey;

ALTER TABLE public.app_permissions
  ADD CONSTRAINT app_permissions_pkey
  PRIMARY KEY (slug);

ALTER TABLE public.app_role_permissions
  ADD CONSTRAINT app_role_permissions_permission_slug_fkey
  FOREIGN KEY (permission_slug)
  REFERENCES public.app_permissions (slug)
  ON DELETE CASCADE;

COMMIT;
