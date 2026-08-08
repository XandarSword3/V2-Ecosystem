-- Migration: Add missing operational columns to payments table and index on payment_ledger
-- Ensures room_charge and manual payment methods work correctly and enables fast folio balance queries.

BEGIN;

-- 1. Restore missing operational columns on payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS method           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS processed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS receipt_url      TEXT;

-- Index for staff-processed payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_processed_by
  ON payments(processed_by)
  WHERE processed_by IS NOT NULL;

-- Index for method-based payment filtering
CREATE INDEX IF NOT EXISTS idx_payments_method
  ON payments(method)
  WHERE method IS NOT NULL;

-- 2. Add index on payment_ledger for fast reference (folio) queries
CREATE INDEX IF NOT EXISTS idx_payment_ledger_ref
  ON payment_ledger(reference_type, reference_id);

COMMIT;
