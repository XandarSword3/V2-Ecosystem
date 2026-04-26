-- DUPLICATE_DO_NOT_RUN
-- This migration duplicates functionality already provided by:
-- 20260224000003_reverse_coupon_usage.sql
-- Kept in repository for historical traceability only.
-- Do not execute on fresh installs.

CREATE OR REPLACE FUNCTION reverse_coupon_usage(
  p_coupon_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE coupons
  SET usage_count = GREATEST(0, usage_count - 1),
      updated_at = NOW()
  WHERE id = p_coupon_id;

  IF p_order_id IS NOT NULL THEN
    DELETE FROM coupon_usage
    WHERE coupon_id = p_coupon_id
      AND order_id = p_order_id;
  ELSIF p_user_id IS NOT NULL THEN
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
