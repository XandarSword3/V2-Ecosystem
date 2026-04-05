CREATE OR REPLACE FUNCTION reverse_coupon_usage(
  p_coupon_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $func$
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
$func$
