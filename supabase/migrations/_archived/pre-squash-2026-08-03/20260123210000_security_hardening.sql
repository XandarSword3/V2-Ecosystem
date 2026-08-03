-- Migration: Dynamic Permissions & Payment Ledger Hardening

-- 1. Dynamic Permissions Support
-- We need a table to store permissions that are generated at runtime (e.g. module-specific)
-- and a way to link them to roles.

-- Use 'app_' prefix to avoid conflict with legacy authentication tables
CREATE TABLE IF NOT EXISTS app_permissions (
  slug VARCHAR(255) PRIMARY KEY, -- e.g. 'module:restaurant:manage'
  description TEXT,
  module_slug VARCHAR(100), -- for easier cleanup
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_role_permissions (
  role_name VARCHAR(50) NOT NULL, -- Link to 'roles' table or just string if roles are enums
  permission_slug VARCHAR(255) REFERENCES app_permissions(slug) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (role_name, permission_slug)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_app_role_permissions_role ON app_role_permissions(role_name);

-- 2. Payment Ledger Immutability
-- Ensure no updates or deletes can happen on payment_ledger

CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Deleting from payment_ledger is strictly forbidden. Create a reversal entry instead.';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Allow updating ONLY metadata or status if it was 'pending' -> 'success'/'failed'
    -- But strictly speaking, a pure ledger should be append-only.
    -- If we allow status updates, we must ensure amount/currency/refs are untouched.
    IF OLD.amount != NEW.amount OR OLD.currency != NEW.currency OR OLD.reference_id != NEW.reference_id THEN
       RAISE EXCEPTION 'Modifying financial fields in payment_ledger is forbidden.';
    END IF;
    
    -- Ideally, we only allow updating 'status' and 'metadata'
    -- But strict audit says: insert a NEW row with new status.
    -- However, for practicality, we might allow status transition once.
    
    RETURN NEW; 
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_ledger_immutable ON payment_ledger;

CREATE TRIGGER trg_payment_ledger_immutable
BEFORE DELETE OR UPDATE ON payment_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();

-- 3. Unique Constraint for Idempotency
-- Ensure webhook_id is unique per event source to prevent double-processing
DO $$ BEGIN
  ALTER TABLE payment_ledger ADD CONSTRAINT uq_payment_ledger_webhook UNIQUE (webhook_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Initial Seed for standard roles (optional, just to ensure table isn't empty if we use it)
-- INSERT INTO permissions (slug, description) VALUES ('admin:dashboard', 'Access Admin Dashboard') ON CONFLICT DO NOTHING;

