-- =============================================================================
-- Migration: 20260901130000_engine_a_f4_idempotency_and_occupancy.sql
-- Description: Database-enforced scoped idempotency lifecycle, owner tokens, active lease assertion, and occupancy
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
  claim_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  response JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS claim_token UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds');
CREATE INDEX IF NOT EXISTS idx_idempotency_records_status ON idempotency_records(status);

-- Atomic single-writer lease acquisition RPC with unique owner claim token
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
  v_token UUID := gen_random_uuid();
BEGIN
  -- 1. Try to insert new in_progress claim
  INSERT INTO idempotency_records (key, claim_token, status, response, transaction_id, created_at, updated_at, expires_at)
  VALUES (p_key, v_token, 'in_progress', NULL, NULL, v_now, v_now, v_expires)
  ON CONFLICT (key) DO NOTHING
  RETURNING * INTO v_record;

  IF FOUND THEN
    RETURN jsonb_build_object('claimed', true, 'status', 'in_progress', 'claim_token', v_record.claim_token);
  END IF;

  -- 2. Row exists, check current state with row-lock
  SELECT * INTO v_record FROM idempotency_records WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO idempotency_records (key, claim_token, status, response, transaction_id, created_at, updated_at, expires_at)
    VALUES (p_key, v_token, 'in_progress', NULL, NULL, v_now, v_now, v_expires)
    ON CONFLICT (key) DO NOTHING
    RETURNING * INTO v_record;
    
    IF FOUND THEN
      RETURN jsonb_build_object('claimed', true, 'status', 'in_progress', 'claim_token', v_record.claim_token);
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
    -- Clean up uncompleted transactions from dead/expired attempts
    IF v_record.transaction_id IS NOT NULL THEN
      DELETE FROM order_items WHERE transaction_id = v_record.transaction_id;
      DELETE FROM transactions WHERE id = v_record.transaction_id;
    END IF;

    UPDATE idempotency_records
    SET claim_token = v_token,
        status = 'in_progress',
        response = NULL,
        transaction_id = NULL,
        updated_at = v_now,
        expires_at = v_expires
    WHERE key = p_key;

    RETURN jsonb_build_object('claimed', true, 'status', 'in_progress', 'claim_token', v_token);
  END IF;

  RETURN jsonb_build_object(
    'claimed', false,
    'status', 'in_progress',
    'expires_at', v_record.expires_at
  );
END;
$$;

-- Assert that the active lease is still valid, owned by calling token, AND NOT EXPIRED
CREATE OR REPLACE FUNCTION assert_active_lease(
  p_key TEXT,
  p_claim_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM idempotency_records
  WHERE key = p_key 
    AND claim_token = p_claim_token 
    AND status = 'in_progress'
    AND expires_at > NOW();

  RETURN v_count > 0;
END;
$$;

-- Atomic transaction creation locked under the active lease boundary
CREATE OR REPLACE FUNCTION create_order_atomic(
  p_key TEXT,
  p_claim_token UUID,
  p_transaction JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease RECORD;
  v_inserted RECORD;
  v_service_location_id UUID;
  v_existing_open_order UUID;
BEGIN
  -- 1. Check & lock idempotency lease atomically
  IF p_key IS NOT NULL AND p_claim_token IS NOT NULL THEN
    SELECT * INTO v_lease
    FROM idempotency_records
    WHERE key = p_key
    FOR UPDATE;

    IF NOT FOUND OR v_lease.claim_token != p_claim_token OR v_lease.status != 'in_progress' OR v_lease.expires_at <= NOW() THEN
      RETURN jsonb_build_object('success', false, 'error', 'LEASE_LOST', 'message', 'Active checkout lease expired or taken over.');
    END IF;
  END IF;

  -- 2. Extract and check service location if provided
  IF (p_transaction->>'service_location_id') IS NOT NULL AND (p_transaction->>'service_location_id') != '' THEN
    v_service_location_id := (p_transaction->>'service_location_id')::UUID;
    
    SELECT id INTO v_existing_open_order
    FROM transactions
    WHERE service_location_id = v_service_location_id
      AND engine_type = 'instant_transaction'
      AND status NOT IN ('completed', 'cancelled')
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'LOCATION_OCCUPIED', 'message', 'This location/table already has an open order');
    END IF;
  END IF;

  -- 3. Insert transaction
  INSERT INTO transactions (
    engine_type,
    module_id,
    property_id,
    tenant_id,
    customer_id,
    staff_id,
    status,
    amount,
    discount_amount,
    tax_amount,
    service_charge,
    currency,
    service_location_id,
    metadata
  ) VALUES (
    COALESCE(p_transaction->>'engine_type', 'instant_transaction'),
    (p_transaction->>'module_id')::UUID,
    (p_transaction->>'property_id')::UUID,
    (p_transaction->>'tenant_id')::UUID,
    NULLIF(p_transaction->>'customer_id', '')::UUID,
    NULLIF(p_transaction->>'staff_id', '')::UUID,
    COALESCE(p_transaction->>'status', 'pending'),
    COALESCE((p_transaction->>'amount')::NUMERIC, 0),
    COALESCE((p_transaction->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_transaction->>'tax_amount')::NUMERIC, 0),
    COALESCE((p_transaction->>'service_charge')::NUMERIC, 0),
    COALESCE(p_transaction->>'currency', 'USD'),
    v_service_location_id,
    COALESCE(p_transaction->'metadata', '{}'::jsonb)
  )
  RETURNING * INTO v_inserted;

  -- 4. Associate transaction_id on idempotency record if key was provided
  IF p_key IS NOT NULL AND p_claim_token IS NOT NULL THEN
    UPDATE idempotency_records
    SET transaction_id = v_inserted.id,
        updated_at = NOW()
    WHERE key = p_key AND claim_token = p_claim_token;
  END IF;

  RETURN jsonb_build_object('success', true, 'data', to_jsonb(v_inserted));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'CONFLICT', 'message', SQLERRM);
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'DB_ERROR', 'message', SQLERRM);
END;
$$;

-- Atomic order_items persistence locked under active lease boundary
CREATE OR REPLACE FUNCTION persist_order_items_atomic(
  p_key TEXT,
  p_claim_token UUID,
  p_transaction_id UUID,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease RECORD;
  v_item JSONB;
  v_inserted JSONB := '[]'::jsonb;
  v_row RECORD;
BEGIN
  IF p_key IS NOT NULL AND p_claim_token IS NOT NULL THEN
    SELECT * INTO v_lease
    FROM idempotency_records
    WHERE key = p_key
    FOR UPDATE;

    IF NOT FOUND OR v_lease.claim_token != p_claim_token OR v_lease.status != 'in_progress' OR v_lease.expires_at <= NOW() THEN
      RETURN jsonb_build_object('success', false, 'error', 'LEASE_LOST', 'message', 'Active checkout lease expired or taken over.');
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      transaction_id,
      catalog_item_id,
      quantity,
      unit_price,
      subtotal,
      special_instructions,
      status,
      tenant_id,
      property_id,
      metadata
    ) VALUES (
      p_transaction_id,
      NULLIF(v_item->>'catalog_item_id', '')::UUID,
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      COALESCE((v_item->>'unit_price')::NUMERIC, 0),
      COALESCE((v_item->>'subtotal')::NUMERIC, 0),
      v_item->>'special_instructions',
      COALESCE(v_item->>'status', 'pending'),
      (v_item->>'tenant_id')::UUID,
      (v_item->>'property_id')::UUID,
      COALESCE(v_item->'metadata', '{}'::jsonb)
    )
    RETURNING id, catalog_item_id, quantity, metadata INTO v_row;

    v_inserted := v_inserted || jsonb_build_array(to_jsonb(v_row));
  END LOOP;

  RETURN jsonb_build_object('success', true, 'data', v_inserted);
END;
$$;

-- Durable compensation queue for recording and retrying uncompensated failed operations
CREATE TABLE IF NOT EXISTS checkout_compensation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT,
  transaction_id UUID,
  operation VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compensation_queue_status ON checkout_compensation_queue(status);

CREATE OR REPLACE FUNCTION queue_failed_compensation(
  p_key TEXT,
  p_transaction_id UUID,
  p_operation TEXT,
  p_payload JSONB,
  p_error TEXT
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO checkout_compensation_queue (
    idempotency_key,
    transaction_id,
    operation,
    payload,
    last_error
  ) VALUES (
    p_key,
    p_transaction_id,
    p_operation,
    p_payload,
    p_error
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Atomic completion with owner token verification
CREATE OR REPLACE FUNCTION complete_idempotency_key(
  p_key TEXT,
  p_claim_token UUID,
  p_transaction_id UUID,
  p_response JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE idempotency_records
  SET status = 'completed',
      transaction_id = p_transaction_id,
      response = p_response,
      updated_at = NOW()
  WHERE key = p_key AND claim_token = p_claim_token AND status = 'in_progress';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Atomic failure mark with owner token verification
CREATE OR REPLACE FUNCTION fail_idempotency_key(
  p_key TEXT,
  p_claim_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE idempotency_records
  SET status = 'failed',
      updated_at = NOW()
  WHERE key = p_key AND claim_token = p_claim_token AND status = 'in_progress';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Heartbeat lease extension with owner token verification
CREATE OR REPLACE FUNCTION heartbeat_idempotency_key(
  p_key TEXT,
  p_claim_token UUID,
  p_extension_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE idempotency_records
  SET expires_at = NOW() + (p_extension_seconds || ' seconds')::INTERVAL,
      updated_at = NOW()
  WHERE key = p_key AND claim_token = p_claim_token AND status = 'in_progress';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
