-- Split from 20260224000000_atomic_safety_functions.sql
-- H2 Fix: atomic pool ticket purchase with capacity row lock

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
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
  v_sold_guests INTEGER;
  v_total DECIMAL;
  v_new_ticket_id UUID;
  v_target_date DATE;
BEGIN
  v_target_date := p_ticket_date::date;

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

  SELECT COALESCE(SUM(number_of_guests), 0) INTO v_sold_guests
  FROM pool_tickets
  WHERE session_id = p_session_id
    AND ticket_date::date = v_target_date
    AND status IN ('valid', 'used');

  IF v_sold_guests + p_number_of_guests > v_session.max_capacity THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      0::DECIMAL,
      GREATEST(0, v_session.max_capacity - v_sold_guests),
      'Not enough capacity available'::TEXT;
    RETURN;
  END IF;

  IF v_session.adult_price IS NOT NULL AND v_session.child_price IS NOT NULL THEN
    v_total := (v_session.adult_price * p_number_of_adults) + (v_session.child_price * p_number_of_children);
  ELSE
    v_total := v_session.price * p_number_of_guests;
  END IF;

  INSERT INTO pool_tickets (
    ticket_number,
    session_id,
    module_id,
    customer_id,
    customer_name,
    customer_phone,
    ticket_date,
    number_of_guests,
    total_amount,
    status,
    payment_status,
    payment_method,
    qr_code
  ) VALUES (
    p_ticket_number,
    p_session_id,
    v_session.module_id,
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_ticket_date,
    p_number_of_guests,
    ROUND(v_total, 2),
    'valid',
    'pending',
    p_payment_method,
    p_qr_code
  )
  RETURNING id INTO v_new_ticket_id;

  RETURN QUERY SELECT
    true,
    v_new_ticket_id,
    ROUND(v_total, 2),
    GREATEST(0, v_session.max_capacity - v_sold_guests - p_number_of_guests),
    NULL::TEXT;
END;
$$;