-- Migration: keep redemption RPCs usable after tenant scoping (2026-11-19)
--
-- Batch 3, Task 5.
--
-- `gift_cards` / `gift_card_transactions` / `coupons` / `coupon_usage` /
-- `loyalty_transactions` are now tenant-scoped: `tenant_id` and
-- `property_id` are NOT NULL. The atomic redemption functions predate that
-- and insert only the business columns:
--
--   redeem_giftcard_atomic      -> gift_card_transactions (no tenant/property)
--   redeem_loyalty_points_atomic-> loyalty_transactions  (no tenant/property)
--   apply_coupon_atomic         -> coupon_usage          (no tenant/property)
--
-- On the current schema every redemption therefore aborts inside the function
-- (23502), rolling back the balance deduction / usage increment. The REST
-- controller returns 500, the pricing resolver treats the card/points as
-- unusable, and coupon application always fails. The row locks were already
-- correct; only the insert was incomplete.
--
-- This migration recreates both functions with the owning row's tenant_id /
-- property_id copied onto the ledger insert. Locking, clamping, and return
-- shapes are unchanged.

CREATE OR REPLACE FUNCTION public.redeem_giftcard_atomic(
  p_code text,
  p_amount numeric,
  p_order_id uuid
)
RETURNS TABLE(success boolean, amount_redeemed numeric, new_balance numeric, gift_card_id uuid, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_card RECORD;
    v_redeem_amount DECIMAL;
BEGIN
    SELECT * INTO v_card
      FROM gift_cards
     WHERE code = UPPER(p_code)
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 0::DECIMAL, NULL::UUID, 'Gift card not found, inactive, or expired'::TEXT;
        RETURN;
    END IF;

    IF v_card.current_balance <= 0 THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_card.current_balance, v_card.id, 'Gift card has no balance'::TEXT;
        RETURN;
    END IF;

    v_redeem_amount := LEAST(p_amount, v_card.current_balance);

    UPDATE gift_cards
       SET current_balance = current_balance - v_redeem_amount,
           status = CASE WHEN current_balance - v_redeem_amount <= 0 THEN 'redeemed' ELSE 'active' END,
           redeemed_at = CASE WHEN current_balance - v_redeem_amount <= 0 THEN NOW() ELSE redeemed_at END,
           updated_at = NOW()
     WHERE id = v_card.id;

    INSERT INTO gift_card_transactions(
      gift_card_id, transaction_type, amount, balance_after, order_id, notes,
      tenant_id, property_id
    ) VALUES (
      v_card.id, 'redemption', -v_redeem_amount, v_card.current_balance - v_redeem_amount,
      p_order_id, 'Order redemption', v_card.tenant_id, v_card.property_id
    );

    RETURN QUERY SELECT true, v_redeem_amount, v_card.current_balance - v_redeem_amount, v_card.id, NULL::TEXT;
END;
$$;

ALTER FUNCTION public.redeem_giftcard_atomic(text, numeric, uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points_atomic(
  p_user_id uuid,
  p_points integer,
  p_order_id uuid,
  p_dollar_value numeric
)
RETURNS TABLE(success boolean, points_redeemed integer, new_balance integer, member_id uuid, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_member RECORD;
BEGIN
    -- Same advisory lock as before: serialises redemptions per user.
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text));

    SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, NULL::UUID, 'User does not have a loyalty account'::TEXT;
        RETURN;
    END IF;

    IF v_member.available_points < p_points THEN
        RETURN QUERY SELECT false, 0, v_member.available_points::INTEGER, v_member.id, 'Insufficient points balance'::TEXT;
        RETURN;
    END IF;

    UPDATE loyalty_members
       SET available_points = available_points - p_points,
           last_activity = NOW(),
           updated_at = NOW()
     WHERE id = v_member.id
    RETURNING available_points INTO v_member.available_points;

    INSERT INTO loyalty_transactions(
      member_id, transaction_type, points, balance_after, description,
      reference_type, reference_id, tenant_id, property_id
    ) VALUES (
      v_member.id, 'redeem', -p_points, v_member.available_points,
      'Redeemed ' || p_points || ' points for $' || p_dollar_value || ' discount for order ' || p_order_id,
      CASE WHEN p_order_id IS NULL THEN NULL ELSE 'order' END,
      p_order_id,
      v_member.tenant_id, v_member.property_id
    );

    RETURN QUERY SELECT true, p_points, v_member.available_points::INTEGER, v_member.id, NULL::TEXT;
END;
$$;

ALTER FUNCTION public.redeem_loyalty_points_atomic(uuid, integer, uuid, numeric) OWNER TO postgres;

-- The coupon function has the same schema-drift problem: coupon_usage now has
-- NOT NULL tenant_id/property_id and the insert supplied neither, so every
-- application aborted after incrementing usage_count in the same transaction
-- (the abort rolls that back too, but the discount never applied).
CREATE OR REPLACE FUNCTION public.apply_coupon_atomic(
  p_code text,
  p_user_id uuid,
  p_order_total numeric,
  p_order_id uuid,
  p_module_type text DEFAULT 'all'::text
)
RETURNS TABLE(success boolean, discount_amount numeric, coupon_id uuid, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_coupon RECORD;
    v_user_usage_count INTEGER;
    v_calculated_discount DECIMAL;
BEGIN
    SELECT * INTO v_coupon
      FROM coupons
     WHERE code = UPPER(p_code)
       AND is_active = true
       AND (valid_from IS NULL OR valid_from <= NOW())
       AND (valid_until IS NULL OR valid_until > NOW())
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, NULL::UUID, 'Coupon not found, inactive, or expired'::TEXT;
        RETURN;
    END IF;
    IF v_coupon.applies_to != 'all' AND v_coupon.applies_to != p_module_type THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, 'Coupon not valid for this order type'::TEXT;
        RETURN;
    END IF;
    IF v_coupon.min_order_amount IS NOT NULL AND p_order_total < v_coupon.min_order_amount THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, ('Order total below minimum of $' || v_coupon.min_order_amount::TEXT)::TEXT;
        RETURN;
    END IF;
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, 'Coupon usage limit reached'::TEXT;
        RETURN;
    END IF;
    IF p_user_id IS NOT NULL AND v_coupon.per_user_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_user_usage_count
          FROM coupon_usage
         WHERE coupon_usage.coupon_id = v_coupon.id
           AND coupon_usage.user_id = p_user_id;
        IF v_user_usage_count >= v_coupon.per_user_limit THEN
            RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, 'You have already used this coupon the maximum number of times'::TEXT;
            RETURN;
        END IF;
    END IF;
    IF v_coupon.discount_type = 'percentage' THEN
        v_calculated_discount := p_order_total * (v_coupon.discount_value / 100);
        IF v_coupon.max_discount_amount IS NOT NULL THEN
            v_calculated_discount := LEAST(v_calculated_discount, v_coupon.max_discount_amount);
        END IF;
    ELSIF v_coupon.discount_type = 'fixed_amount' THEN
        v_calculated_discount := LEAST(v_coupon.discount_value, p_order_total);
    ELSE
        v_calculated_discount := 0;
    END IF;
    v_calculated_discount := ROUND(v_calculated_discount, 2);
    UPDATE coupons SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = v_coupon.id;
    INSERT INTO coupon_usage(
      coupon_id, user_id, order_id, discount_applied, tenant_id, property_id
    ) VALUES (
      v_coupon.id, p_user_id, p_order_id, v_calculated_discount,
      v_coupon.tenant_id, v_coupon.property_id
    );
    RETURN QUERY SELECT true, v_calculated_discount, v_coupon.id, NULL::TEXT;
END;
$function$;

ALTER FUNCTION public.apply_coupon_atomic(text, uuid, numeric, uuid, text) OWNER TO postgres;
