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
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds');
CREATE INDEX IF NOT EXISTS idx_idempotency_records_status ON idempotency_records(status);

-- Atomic single-writer lease acquisition RPC
CREATE OR REPLACE FUNCTION claim_idempotency_key(
  p_key TEXT,
  p_lease_seconds INTEGER DEFAULT 60
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_record RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_expires TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
  -- 1. Try to insert new in_progress claim
  INSERT INTO idempotency_records (key, status, response, transaction_id, created_at, updated_at, expires_at)
  VALUES (p_key, 'in_progress', NULL, NULL, v_now, v_now, v_expires)
  ON CONFLICT (key) DO NOTHING
  RETURNING * INTO v_record;

  IF FOUND THEN
    RETURN jsonb_build_object('claimed', true, 'status', 'in_progress');
  END IF;

  -- 2. Row exists, check current state with row-lock
  SELECT * INTO v_record FROM idempotency_records WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO idempotency_records (key, status, response, transaction_id, created_at, updated_at, expires_at)
    VALUES (p_key, 'in_progress', NULL, NULL, v_now, v_now, v_expires)
    ON CONFLICT (key) DO NOTHING
    RETURNING * INTO v_record;
    
    IF FOUND THEN
      RETURN jsonb_build_object('claimed', true, 'status', 'in_progress');
    END IF;
    SELECT * INTO v_record FROM idempotency_records WHERE key = p_key;
  END IF;

  IF v_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'status', 'completed',
      'response', v_record.response,
      'transaction_id', v_record.transaction_id
    );
  END IF;

  IF v_record.status = 'failed' OR (v_record.status = 'in_progress' AND v_record.expires_at < v_now) THEN
    UPDATE idempotency_records
    SET status = 'in_progress',
        response = NULL,
        transaction_id = NULL,
        updated_at = v_now,
        expires_at = v_expires
    WHERE key = p_key;

    RETURN jsonb_build_object('claimed', true, 'status', 'in_progress');
  END IF;

  RETURN jsonb_build_object(
    'claimed', false,
    'status', 'in_progress',
    'expires_at', v_record.expires_at
  );
END;
$$;
