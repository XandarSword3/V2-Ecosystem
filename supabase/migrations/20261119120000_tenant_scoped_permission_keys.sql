-- Migration: tenant-scoped permission keys (2026-11-19)
--
-- Batch 3, Task 6.
--
-- `app_permissions` was PRIMARY KEY (slug) and `app_role_permissions` was
-- PRIMARY KEY (role_name, permission_slug). Module slugs are unique per tenant
-- (`modules` has UNIQUE (slug, tenant_id)), so tenant A and tenant B could each
-- create a module called "restaurant" — but only one of them could own
-- `module:restaurant:manage`. The second `createModule` upserted on `slug`,
-- overwriting the first tenant's row (including its tenant_id/property_id);
-- the second tenant's role grants then upserted on (role_name, permission_slug)
-- and overwrote the first tenant's grants. The loser's admins got 403 on their
-- own module.
--
-- New keys:
--   app_permissions        PRIMARY KEY (tenant_id, property_id, slug)
--   app_role_permissions   PRIMARY KEY (tenant_id, property_id, role_name,
--                                        permission_slug)
--
-- The role-permission FK now references the full permission key, so a grant
-- can only point at a permission row owned by the same tenant and property.
--
-- Rollback: supabase/migrations/rollback/20261119120000_tenant_scoped_permission_keys.down.sql
-- (the rollback fails if two tenants already own the same slug, by design).

BEGIN;

ALTER TABLE public.app_role_permissions
  DROP CONSTRAINT IF EXISTS app_role_permissions_permission_slug_fkey;

ALTER TABLE public.app_permissions
  DROP CONSTRAINT IF EXISTS app_permissions_pkey;

ALTER TABLE public.app_permissions
  ADD CONSTRAINT app_permissions_pkey
  PRIMARY KEY (tenant_id, property_id, slug);

ALTER TABLE public.app_role_permissions
  DROP CONSTRAINT IF EXISTS app_role_permissions_pkey;

ALTER TABLE public.app_role_permissions
  ADD CONSTRAINT app_role_permissions_pkey
  PRIMARY KEY (tenant_id, property_id, role_name, permission_slug);

ALTER TABLE public.app_role_permissions
  ADD CONSTRAINT app_role_permissions_permission_fkey
  FOREIGN KEY (tenant_id, property_id, permission_slug)
  REFERENCES public.app_permissions (tenant_id, property_id, slug)
  ON DELETE CASCADE;

COMMIT;
