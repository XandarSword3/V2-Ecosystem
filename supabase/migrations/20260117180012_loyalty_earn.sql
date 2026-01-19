-- Migration: Loyalty Earn Function
-- Date: 2026-01-17

CREATE OR REPLACE FUNCTION earn_loyalty_points_atomic(p_user_id UUID, p_order_total DECIMAL, p_order_id UUID, p_points_per_dollar INTEGER DEFAULT 1)
RETURNS TABLE(success BOOLEAN, points_earned INTEGER, new_balance INTEGER, tier_multiplier DECIMAL, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_member RECORD;
    v_tier RECORD;
    v_base_points INTEGER;
    v_final_points INTEGER;
BEGIN
    SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO loyalty_members(user_id, tier_id, total_points, available_points, lifetime_points)
        SELECT p_user_id, id, 0, 0, 0 FROM loyalty_tiers WHERE min_points = 0 ORDER BY sort_order LIMIT 1
        RETURNING * INTO v_member;
    END IF;
    SELECT * INTO v_tier FROM loyalty_tiers WHERE id = v_member.tier_id;
    v_base_points := FLOOR(p_order_total * p_points_per_dollar);
    v_final_points := FLOOR(v_base_points * COALESCE(v_tier.points_multiplier, 1));
    UPDATE loyalty_members SET available_points = available_points + v_final_points, total_points = total_points + v_final_points, lifetime_points = lifetime_points + v_final_points, last_activity = NOW(), updated_at = NOW() WHERE id = v_member.id;
    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description, reference_type, reference_id) VALUES (v_member.id, 'earn', v_final_points, v_member.available_points + v_final_points, 'Earned ' || v_final_points || ' points from order', 'order', p_order_id);
    RETURN QUERY SELECT true, v_final_points, (v_member.available_points + v_final_points)::INTEGER, COALESCE(v_tier.points_multiplier, 1)::DECIMAL, NULL::TEXT;
END;
$func$;
