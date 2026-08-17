-- Make tenant_id and property_id nullable on security_audit_log table
-- This allows security events that occur outside a tenant/property context
-- (e.g. unauthenticated rate limits, failed logins before tenant resolution, system health checks)
-- to be recorded without violating NOT NULL constraints.

ALTER TABLE IF EXISTS "public"."security_audit_log" 
  ALTER COLUMN "tenant_id" DROP NOT NULL,
  ALTER COLUMN "property_id" DROP NOT NULL;
