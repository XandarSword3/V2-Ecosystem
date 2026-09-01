-- =============================================================================
-- Migration: 20260901130000_engine_a_f4_idempotency_and_occupancy.sql
-- Description: Database-enforced scoped idempotency lifecycle and atomic service location occupancy
-- =============================================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service_location_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS staff_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_engine_type ON transactions(engine_type);
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_id ON transactions(metadata_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Unique index for scoped commercial checkout idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_scoped_idempotency 
ON transactions ((metadata->>'scoped_idempotency_key')) 
WHERE (metadata->>'scoped_idempotency_key') IS NOT NULL;

-- Unique index for atomic single-occupancy of service locations / tables
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_active_service_location 
ON transactions (service_location_id) 
WHERE service_location_id IS NOT NULL 
  AND engine_type = 'instant_transaction' 
  AND status NOT IN ('completed', 'cancelled');

-- Idempotency lifecycle tracking table
CREATE TABLE IF NOT EXISTS idempotency_records (
  key VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_status ON idempotency_records(status);
