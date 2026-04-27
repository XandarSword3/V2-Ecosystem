-- Phase 9: database hardening for finance/staff reporting queries
-- Adds missing columns used by manager shift financial rollups and
-- performance indexes for cross-module reporting paths.

BEGIN;

ALTER TABLE staff_shifts
  ADD COLUMN IF NOT EXISTS orders_processed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_handled NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_created_by_created_at
  ON restaurant_orders(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snack_orders_created_by_created_at
  ON snack_orders(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chalet_bookings_created_by_created_at
  ON chalet_bookings(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pool_tickets_created_by_created_at
  ON pool_tickets(created_by, created_at DESC);

-- loyalty_transactions compatibility: older schemas may not have reference_type/reference_id.
ALTER TABLE IF EXISTS loyalty_transactions
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_reference
  ON loyalty_transactions(reference_type, reference_id, created_at DESC);

COMMIT;
