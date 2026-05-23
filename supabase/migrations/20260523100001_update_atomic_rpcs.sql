-- Update atomic RPCs to use generic engine tables
-- purchase_shared_capacity_atomic: pool_sessions → capacity_windows, status confirmed → valid
-- reserve_unit_exclusive_atomic: new function for double-booking prevention

-- ─────────────────────────────────────────────────────────────
-- Updated purchase_shared_capacity_atomic
-- Uses capacity_windows instead of pool_sessions
-- Inserts with status 'valid' (correct initial state for shared_capacity_access engine)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION purchase_shared_capacity_atomic(
  p_session_id UUID,
  p_module_id  UUID,
  p_property_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_quantity   INTEGER  DEFAULT 1,
  p_ticket_date DATE    DEFAULT CURRENT_DATE,
  p_amount     DECIMAL  DEFAULT 0,
  p_metadata   JSONB    DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success          BOOLEAN,
  transaction_id   UUID,
  total_amount     DECIMAL,
  available_capacity INTEGER,
  error_message    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window      RECORD;
  v_sold        INTEGER;
  v_max_capacity INTEGER;
  v_new_id      UUID;
  v_meta        JSONB;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'quantity must be at least 1'::TEXT;
    RETURN;
  END IF;

  -- Lock the capacity window row to prevent concurrent over-booking
  SELECT * INTO v_window
  FROM capacity_windows
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session not found'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(v_window.is_active, true) = false THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session is not active'::TEXT;
    RETURN;
  END IF;

  v_max_capacity := COALESCE(v_window.max_capacity, 0);
  IF v_max_capacity <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session has no capacity configured'::TEXT;
    RETURN;
  END IF;

  -- Count already-sold slots for this date
  SELECT COALESCE(SUM(
    GREATEST(
      COALESCE(NULLIF(t.metadata->>'quantity','')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'number_of_guests','')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'adults','')::INTEGER, 0)
        + COALESCE(NULLIF(t.metadata->>'children','')::INTEGER, 0),
      1
    )
  ), 0)::INTEGER
  INTO v_sold
  FROM transactions t
  WHERE t.engine_type = 'shared_capacity_access'
    AND (t.reference_id = p_session_id OR (t.metadata->>'session_id')::UUID = p_session_id)
    AND COALESCE(t.metadata->>'ticket_date', t.metadata->>'date', '') = p_ticket_date::TEXT
    AND t.status NOT IN ('cancelled', 'expired', 'no_show');

  IF v_sold + p_quantity > v_max_capacity THEN
    RETURN QUERY SELECT
      false, NULL::UUID, 0::DECIMAL,
      GREATEST(0, v_max_capacity - v_sold),
      'Not enough capacity available'::TEXT;
    RETURN;
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'session_id',   p_session_id::TEXT,
      'quantity',     p_quantity,
      'ticket_date',  p_ticket_date::TEXT,
      'date',         p_ticket_date::TEXT
    );

  INSERT INTO transactions (
    engine_type, module_id, property_id, customer_id,
    status, amount, net_amount,
    reference_id, reference_table, metadata
  ) VALUES (
    'shared_capacity_access',
    COALESCE(p_module_id, v_window.module_id),
    p_property_id, p_customer_id,
    'valid',          -- correct initial state for shared_capacity_access engine
    p_amount, p_amount,
    p_session_id,
    'capacity_windows',
    v_meta
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT
    true, v_new_id, p_amount,
    GREATEST(0, v_max_capacity - v_sold - p_quantity),
    NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION purchase_shared_capacity_atomic IS
  'Atomically purchases shared-capacity access. Uses capacity_windows (generic) table.
   Inserts transaction with status=valid (correct initial state for shared_capacity_access engine).';

-- ─────────────────────────────────────────────────────────────
-- reserve_unit_exclusive_atomic
-- Atomic double-booking prevention for time_exclusive_reservation engine
-- Uses pg_advisory_xact_lock to serialize concurrent requests for same unit
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reserve_unit_exclusive_atomic(
  p_unit_id       TEXT,
  p_module_id     UUID,
  p_check_in_date  DATE,
  p_check_out_date DATE,
  p_customer_id   UUID    DEFAULT NULL,
  p_amount        DECIMAL DEFAULT 0,
  p_metadata      JSONB   DEFAULT '{}'::jsonb
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
  v_new_id       UUID;
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
$$;

COMMENT ON FUNCTION reserve_unit_exclusive_atomic IS
  'Atomically creates a time_exclusive_reservation booking with overlap check.
   Uses pg_advisory_xact_lock to prevent double-booking under concurrent load.';
