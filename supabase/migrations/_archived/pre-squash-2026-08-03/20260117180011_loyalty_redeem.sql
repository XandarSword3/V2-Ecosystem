-- Migration: Loyalty Redeem Function
-- Date: 2026-01-17

CREATE OR REPLACE FUNCTION redeem_loyalty_points_atomic(p_user_id UUID, p_points INTEGER, p_order_id UUID, p_dollar_value DECIMAL)
RETURNS TABLE(success BOOLEAN, points_redeemed INTEGER, new_balance INTEGER, member_id UUID, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_member RECORD;
BEGIN
    SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, NULL::UUID, 'User does not have a loyalty account'::TEXT;
        RETURN;
    END IF;
    IF v_member.available_points < p_points THEN
        RETURN QUERY SELECT false, 0, v_member.available_points::INTEGER, v_member.id, 'Insufficient points balance'::TEXT;
        RETURN;
    END IF;
    UPDATE loyalty_members SET available_points = available_points - p_points, last_activity = NOW(), updated_at = NOW() WHERE id = v_member.id;
    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description, reference_type, reference_id) VALUES (v_member.id, 'redeem', -p_points, v_member.available_points - p_points, 'Redeemed ' || p_points || ' points for $' || p_dollar_value || ' discount', 'order', p_order_id);
    RETURN QUERY SELECT true, p_points, (v_member.available_points - p_points)::INTEGER, v_member.id, NULL::TEXT;
END;
$func$;
