-- Atomic shared-capacity purchase using transactions (Engine Refit)
-- Replaces legacy purchase_pool_ticket_atomic which wrote to pool_tickets.

CREATE OR REPLACE FUNCTION purchase_shared_capacity_atomic(
  p_session_id UUID,
  p_module_id UUID,
  p_property_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_ticket_date DATE DEFAULT CURRENT_DATE,
  p_amount DECIMAL DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success BOOLEAN,
  transaction_id UUID,
  total_amount DECIMAL,
  available_capacity INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_sold INTEGER;
  v_max_capacity INTEGER;
  v_new_id UUID;
  v_meta JSONB;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'quantity must be at least 1'::TEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_session
  FROM pool_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session not found'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(v_session.is_active, true) = false THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session is not active'::TEXT;
    RETURN;
  END IF;

  v_max_capacity := COALESCE(v_session.max_capacity, v_session.capacity, 0);
  IF v_max_capacity <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session has no capacity configured'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(
      COALESCE(NULLIF(t.metadata->>'quantity', '')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'number_of_guests', '')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'adults', '')::INTEGER, 0)
        + COALESCE(NULLIF(t.metadata->>'children', '')::INTEGER, 0),
      1
    )
  ), 0)::INTEGER
  INTO v_sold
  FROM transactions t
  WHERE t.engine_type = 'shared_capacity_access'
    AND (
      t.reference_id = p_session_id
      OR (t.metadata->>'session_id')::UUID = p_session_id
    )
    AND COALESCE(t.metadata->>'ticket_date', t.metadata->>'date', '') = p_ticket_date::TEXT
    AND t.status NOT IN ('cancelled', 'expired', 'no_show');

  IF v_sold + p_quantity > v_max_capacity THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      0::DECIMAL,
      GREATEST(0, v_max_capacity - v_sold),
      'Not enough capacity available'::TEXT;
    RETURN;
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'session_id', p_session_id::TEXT,
      'quantity', p_quantity,
      'ticket_date', p_ticket_date::TEXT,
      'date', p_ticket_date::TEXT
    );

  INSERT INTO transactions (
    engine_type,
    module_id,
    property_id,
    customer_id,
    status,
    amount,
    net_amount,
    reference_id,
    reference_table,
    metadata
  )
  VALUES (
    'shared_capacity_access',
    COALESCE(p_module_id, v_session.module_id),
    p_property_id,
    p_customer_id,
    'confirmed',
    p_amount,
    p_amount,
    p_session_id,
    'pool_sessions',
    v_meta
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT
    true,
    v_new_id,
    p_amount,
    GREATEST(0, v_max_capacity - v_sold - p_quantity),
    NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION purchase_shared_capacity_atomic IS
  'Atomically reserves shared-capacity access in transactions with FOR UPDATE session lock.';
