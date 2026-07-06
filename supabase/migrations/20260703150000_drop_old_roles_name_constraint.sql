-- Drop the old global UNIQUE constraint on roles.name
-- This conflicts with the composite UNIQUE (tenant_id, name) constraint
-- that was added for multi-tenant support
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
