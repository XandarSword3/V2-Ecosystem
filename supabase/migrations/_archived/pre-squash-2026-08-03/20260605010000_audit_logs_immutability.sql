-- Q36/Q113: Enforce physical immutability on audit_logs.
-- RLS policies already block UPDATE/DELETE via the Supabase role, but a service-role
-- bypass or direct Postgres connection would circumvent them.
-- These RULE definitions prevent modifications at the storage level, independent of RLS.

DO $$ BEGIN
  -- Reject any UPDATE on audit_logs at the rule level
  CREATE RULE audit_log_no_update
    AS ON UPDATE TO audit_logs
    DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Reject any DELETE on audit_logs at the rule level
  CREATE RULE audit_log_no_delete
    AS ON DELETE TO audit_logs
    DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Verify rules exist (this query is a no-op but documents the expected state)
-- SELECT rulename, tablename FROM pg_rules WHERE tablename = 'audit_logs';
