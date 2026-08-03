-- Migration: 20260522000000_add_system_config.sql
-- System-level configuration table for install state and machine identity.
-- This is NOT tenant/property scoped — it is global to the server instance.

CREATE TABLE IF NOT EXISTS system_config (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS — this table is read/written only by the backend service role.
-- The frontend never touches this directly.
ALTER TABLE system_config DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE system_config IS
  'Global server-level configuration. Not tenant-scoped. Read/written via backend service role only.';

COMMENT ON COLUMN system_config.key IS
  'Namespaced config key, e.g. install.machine_id, install.completed_at';

COMMENT ON COLUMN system_config.value IS
  'Arbitrary JSON value for the key.';
