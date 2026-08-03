-- Migration: Actually Create reverse_coupon_usage
-- Date: 2026-08-03
--
-- reverse_coupon_usage has been referenced by application code (originally
-- the dead coupon.controller.ts applyCoupon, now engines/discount-
-- reversal.ts) but never actually existed as a live function. Its only
-- previous definition was inside 20260224000000_atomic_safety_functions.sql,
-- which wraps its ENTIRE body in a /* ... */ block comment and, at the point
-- it would have created this function, instead only RAISE NOTICEs that it
-- was "moved to split migrations 20260224000010-40". Migrations 10/20/30
-- were never created; 40 (atomic_safety_prereqs.sql) contains no function
-- definitions at all. Confirmed by replaying the full migration history
-- against a scratch Postgres instance and checking pg_proc directly — the
-- function is simply not there.
--
-- Recreating verbatim from the commented-out source (the logic itself was
-- correct, it just never got deployed).

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
