CREATE OR REPLACE FUNCTION create_chalet_booking_with_addons(
  p_booking JSONB,
  p_add_ons JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(booking_id UUID)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
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
$func$
