-- reserve_unit_exclusive_atomic
-- Atomic double-booking prevention for time_exclusive_reservation engine.
-- Uses pg_advisory_xact_lock to serialize concurrent requests for the same unit.
CREATE OR REPLACE FUNCTION reserve_unit_exclusive_atomic(
  p_unit_id        TEXT,
  p_module_id      UUID,
  p_check_in_date  DATE,
  p_check_out_date DATE,
  p_customer_id    UUID    DEFAULT NULL,
  p_amount         DECIMAL DEFAULT 0,
  p_metadata       JSONB   DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success        BOOLEAN,
  transaction_id UUID,
  error_message  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id        UUID;
  v_overlap_count INTEGER;
BEGIN
  IF p_check_in_date >= p_check_out_date THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Check-out must be after check-in'::TEXT;
    RETURN;
  END IF;

  IF p_check_in_date < CURRENT_DATE THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Check-in date must not be in the past'::TEXT;
    RETURN;
  END IF;

  -- Advisory lock scoped to this transaction: serialises concurrent requests for same unit
  PERFORM pg_advisory_xact_lock(
    hashtext(p_module_id::TEXT || '::' || p_unit_id)
  );

  -- Count overlapping active bookings for this unit
  SELECT COUNT(*) INTO v_overlap_count
  FROM transactions t
  WHERE t.engine_type = 'time_exclusive_reservation'
    AND t.module_id = p_module_id
    AND (t.metadata->>'unit_id') = p_unit_id
    AND t.status NOT IN ('cancelled', 'no_show')
    AND (t.metadata->>'check_in_date')::DATE  < p_check_out_date
    AND (t.metadata->>'check_out_date')::DATE > p_check_in_date;

  IF v_overlap_count > 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Unit is already booked for these dates'::TEXT;
    RETURN;
  END IF;

  INSERT INTO transactions (
    engine_type, module_id, customer_id,
    status, amount, net_amount, metadata
  ) VALUES (
    'time_exclusive_reservation',
    p_module_id, p_customer_id,
    'pending', p_amount, p_amount,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'unit_id',        p_unit_id,
      'check_in_date',  p_check_in_date::TEXT,
      'check_out_date', p_check_out_date::TEXT
    )
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT true, v_new_id, NULL::TEXT;
END;
$$
