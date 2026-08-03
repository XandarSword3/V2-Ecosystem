/*
-- Migration: Atomic Safety Functions
-- Date: 2026-02-24
-- Purpose: Fix race conditions and transactional gaps identified in Phase 1 audit
-- Covers: H2 (pool capacity), H4/M3 (chalet booking+addons), M4 (coupon reversal)

-- ============================================================================
-- 1. PURCHASE_POOL_TICKET_ATOMIC (H2 Fix)
-- Prevents pool capacity over-sell via FOR UPDATE row lock on session.
-- Atomically: locks session -> counts existing guests -> validates capacity -> inserts ticket
-- ============================================================================

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

  -- Count currently sold guests for this session + date (only valid/used tickets)
  SELECT COALESCE(SUM(number_of_guests), 0) INTO v_sold_guests
  FROM pool_tickets
  WHERE session_id = p_session_id
    AND ticket_date::date = v_target_date
    AND status IN ('valid', 'used');

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

  -- Insert the ticket (same transaction, capacity is guaranteed)
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


-- ============================================================================
-- 2. CREATE_CHALET_BOOKING_WITH_ADDONS (H4/M3 Fix)
-- Atomically inserts booking + all add-ons in a single transaction.
-- If either insert fails, the entire transaction rolls back — no orphan bookings.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_chalet_booking_with_addons(
  p_booking JSONB,
  p_add_ons JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(booking_id UUID)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking_id UUID;
  v_add_on JSONB;
BEGIN
  -- Insert the booking
  INSERT INTO chalet_bookings (
    booking_number,
    chalet_id,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    check_in_date,
    check_out_date,
    number_of_guests,
    number_of_nights,
    base_amount,
    add_ons_amount,
    deposit_amount,
    total_amount,
    status,
    payment_status,
    payment_method,
    special_requests
  ) VALUES (
    p_booking->>'booking_number',
    (p_booking->>'chalet_id')::UUID,
    CASE WHEN p_booking->>'customer_id' IS NOT NULL AND p_booking->>'customer_id' != 'null'
      THEN (p_booking->>'customer_id')::UUID ELSE NULL END,
    p_booking->>'customer_name',
    p_booking->>'customer_email',
    p_booking->>'customer_phone',
    (p_booking->>'check_in_date')::TIMESTAMPTZ,
    (p_booking->>'check_out_date')::TIMESTAMPTZ,
    (p_booking->>'number_of_guests')::INTEGER,
    (p_booking->>'number_of_nights')::INTEGER,
    (p_booking->>'base_amount')::DECIMAL,
    COALESCE((p_booking->>'add_ons_amount')::DECIMAL, 0),
    COALESCE((p_booking->>'deposit_amount')::DECIMAL, 0),
    (p_booking->>'total_amount')::DECIMAL,
    COALESCE(p_booking->>'status', 'pending'),
    COALESCE(p_booking->>'payment_status', 'pending'),
    p_booking->>'payment_method',
    p_booking->>'special_requests'
  )
  RETURNING id INTO v_booking_id;

  -- Insert all add-ons (if any) in the same transaction
  IF jsonb_array_length(p_add_ons) > 0 THEN
    INSERT INTO chalet_booking_add_ons (booking_id, add_on_id, quantity, unit_price, subtotal)
    SELECT
      v_booking_id,
      (elem->>'add_on_id')::UUID,
      (elem->>'quantity')::INTEGER,
      (elem->>'unit_price')::DECIMAL,
      (elem->>'subtotal')::DECIMAL
    FROM jsonb_array_elements(p_add_ons) AS elem;
  END IF;

  RETURN QUERY SELECT v_booking_id;
END;
$$;


-- ============================================================================
-- 3. REVERSE_COUPON_USAGE (M4 Fix)
-- Compensation function: if coupon was atomically consumed but the subsequent
-- order update failed, this reverses the coupon usage so the coupon isn't
-- "phantom consumed".
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_coupon_usage(
  p_coupon_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Decrement usage count on the coupon (minimum 0)
  UPDATE coupons
  SET usage_count = GREATEST(0, usage_count - 1),
      updated_at = NOW()
  WHERE id = p_coupon_id;

  -- Remove the coupon_usage record for this specific order
  IF p_order_id IS NOT NULL THEN
    DELETE FROM coupon_usage
    WHERE coupon_id = p_coupon_id
      AND order_id = p_order_id;
  ELSIF p_user_id IS NOT NULL THEN
    -- Fallback: delete the most recent usage for this user + coupon
    DELETE FROM coupon_usage
    WHERE id = (
      SELECT id FROM coupon_usage
      WHERE coupon_id = p_coupon_id
        AND user_id = p_user_id
      ORDER BY used_at DESC
      LIMIT 1
    );
  END IF;
END;
$$;


-- ============================================================================
-- 4. Add module_id column to pool_sessions if not exists
-- (Required for the purchase_pool_ticket_atomic function)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pool_sessions' AND column_name = 'module_id'
  ) THEN
    ALTER TABLE pool_sessions ADD COLUMN module_id UUID;
  END IF;
END $$;


-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Atomic safety functions created successfully:';
  RAISE NOTICE '  - purchase_pool_ticket_atomic (H2 fix)';
  RAISE NOTICE '  - create_chalet_booking_with_addons (H4/M3 fix)';
  RAISE NOTICE '  - reverse_coupon_usage (M4 fix)';
END $$;
*/

DO $$
BEGIN
  RAISE NOTICE 'Atomic safety functions moved to split migrations (20260224000010-40).';
END $$;
