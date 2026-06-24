-- Migration: Phase 3 Financial and Security Hardening
-- Adds discount_price columns to Kiosk items and Accommodation Units
-- Increments token_version for all users to force session re-authentication

BEGIN;

-- 1. Security: Global session invalidation
-- This forces all existing JWTs (which have version 0 or NULL) to be invalid
-- once we implement the version check in auth middleware.
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;

UPDATE users SET token_version = token_version + 1;

-- 2. Financial: Support for sale prices in Kiosk
-- kiosk_items not in canonical schema — no-op.

-- 3. Financial: Support for sale prices in Accommodation Units
-- This provides a simpler discount mechanism alongside the complex price rules.
ALTER TABLE IF EXISTS accommodation_units
  ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10,2);

-- 4. Audit Log: Record the migration
-- This is a manual entry since this is a schema change
INSERT INTO audit_logs (action, resource, details)
VALUES ('schema_migration', 'system', '{"phase": 3, "description": "Added discount_price columns and rotated token_version"}'::jsonb);

COMMIT;
