-- ============================================================
-- Migration: scope users.email uniqueness per tenant
--
-- Root cause: users.email carried a bare table-wide UNIQUE constraint
-- (00000000000000_init_users.sql, auto-named users_email_key by
-- Postgres). In a multi-tenant SaaS that's the wrong boundary: the same
-- person's email needs to be able to exist once as a customer under one
-- tenant and once as an owner under another. platform-admin.controller.ts's
-- createCheckoutSession already assumes this is allowed (see its
-- scope='tenant_owner' comment: "an unscoped email match here would block
-- anyone who's ever been a customer... from ever becoming a real tenant
-- owner"), but the DB never actually permitted it — any second users row
-- reusing an email hit users_email_key regardless of tenant. That's what
-- broke ProvisioningService.provision() Step 6 when a prospective tenant
-- owner's email already existed on a different tenant's users row.
--
-- Fix: replace the single global unique constraint with two narrower ones
-- that match the real identity boundaries:
--   1. Tenant-scoped users (customer/staff/admin/tenant_owner) — unique per
--      (tenant_id, email). The same email may exist under different tenants.
--   2. Platform-level users (super_admin/platform_admin, tenant_id IS NULL,
--      per the chk_scope_tenant constraint in 20260624000000_user_scope_model)
--      — unique globally among themselves, same guarantee as before.
--
-- Partial unique indexes are used instead of one composite
-- UNIQUE(tenant_id, email) because Postgres never treats two NULLs as
-- equal — a bare composite unique constraint would silently allow
-- unlimited duplicate tenant_id-IS-NULL rows instead of enforcing #2.
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_email
  ON users (tenant_id, email)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_platform_email
  ON users (email)
  WHERE tenant_id IS NULL;

COMMENT ON INDEX uq_users_tenant_email IS
  'Email must be unique within a tenant, not across the whole platform -- the same person can be a customer of one tenant and the owner of another.';

COMMENT ON INDEX uq_users_platform_email IS
  'Platform-level accounts (super_admin/platform_admin, tenant_id IS NULL) still need a globally unique email among themselves.';
