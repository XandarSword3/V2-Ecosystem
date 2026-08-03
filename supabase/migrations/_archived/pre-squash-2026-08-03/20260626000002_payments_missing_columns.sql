-- =============================================================
-- Wave 4: Add missing operational columns to payments table.
--
-- Root cause: payments was created in 00000000000001_base_schema_shim.sql
-- with only: id, amount, currency, status, stripe_payment_intent_id,
-- transaction_id, created_at.
-- No subsequent migration ever added the columns that payment.controller.ts
-- and gdpr.service.ts have always written/read.
-- The code is correct. This migration closes the DB gap.
-- =============================================================

BEGIN;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS method           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS processed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS receipt_url      TEXT;

-- Index for staff-processed payment lookups (cash reconciliation reports)
CREATE INDEX IF NOT EXISTS idx_payments_processed_by
  ON payments(processed_by)
  WHERE processed_by IS NOT NULL;

-- Index for method-based filtering (cash vs card vs whish/omt)
CREATE INDEX IF NOT EXISTS idx_payments_method
  ON payments(method)
  WHERE method IS NOT NULL;

COMMIT;
