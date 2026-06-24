-- purchase_pool_ticket_atomic: writes to transactions (shared_capacity_access engine)
CREATE OR REPLACE FUNCTION purchase_pool_ticket_atomic(
  p_session_id UUID,
  p_ticket_date TIMESTAMPTZ,
  p_ticket_number TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_customer_name TEXT DEFAULT '',
  p_customer_phone TEXT DEFAULT NULL,
  p_number_of_guests INTEGER DEFAULT 1,
  p_number_of_adults INTEGER DEFAULT 0,
  p_number_of_children INTEGER DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash',
  p_qr_code TEXT DEFAULT ''
)
RETURNS TABLE(
  success BOOLEAN,
  ticket_id UUID,
  total_amount DECIMAL,
  available_capacity INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_session RECORD;
  v_sold_guests INTEGER;
  v_total DECIMAL;
  v_new_txn_id UUID;
  v_target_date DATE;
BEGIN
  v_target_date := p_ticket_date::date;

  -- Lock the session row to prevent concurrent capacity checks from racing
  SELECT * INTO v_session
  FROM pool_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session not found'::TEXT;
    RETURN;
  END IF;

  IF NOT v_session.is_active THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session is not active'::TEXT;
    RETURN;
  END IF;

  -- Count confirmed/active guests for this session + date from transactions
  SELECT COALESCE(SUM((metadata->>'number_of_guests')::INTEGER), 0) INTO v_sold_guests
  FROM transactions
  WHERE engine_type = 'shared_capacity_access'
    AND (metadata->>'session_id')::UUID = p_session_id
    AND (metadata->>'date') = v_target_date::text
    AND status IN ('confirmed', 'active', 'used');

  -- Capacity check
  IF v_sold_guests + p_number_of_guests > v_session.max_capacity THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      0::DECIMAL,
      GREATEST(0, v_session.max_capacity - v_sold_guests),
      'Not enough capacity available'::TEXT;
    RETURN;
  END IF;

  -- Calculate total amount
  IF v_session.adult_price IS NOT NULL AND v_session.child_price IS NOT NULL THEN
    v_total := (v_session.adult_price * p_number_of_adults) + (v_session.child_price * p_number_of_children);
  ELSE
    v_total := v_session.price * p_number_of_guests;
  END IF;

  -- Insert into transactions (single source of truth)
  INSERT INTO transactions (
    engine_type,
    status,
    amount,
    customer_id,
    module_id,
    property_id,
    metadata
  ) VALUES (
    'shared_capacity_access',
    'confirmed',
    ROUND(v_total, 2),
    p_customer_id,
    v_session.module_id,
    v_session.property_id,
    jsonb_build_object(
      'ticket_number', p_ticket_number,
      'session_id', p_session_id,
      'date', v_target_date,
      'number_of_guests', p_number_of_guests,
      'number_of_adults', p_number_of_adults,
      'number_of_children', p_number_of_children,
      'customer_name', p_customer_name,
      'customer_phone', p_customer_phone,
      'payment_method', p_payment_method,
      'qr_code', p_qr_code
    )
  )
  RETURNING id INTO v_new_txn_id;

  RETURN QUERY SELECT
    true,
    v_new_txn_id,
    ROUND(v_total, 2),
    GREATEST(0, v_session.max_capacity - v_sold_guests - p_number_of_guests),
    NULL::TEXT;
END;
$func$
