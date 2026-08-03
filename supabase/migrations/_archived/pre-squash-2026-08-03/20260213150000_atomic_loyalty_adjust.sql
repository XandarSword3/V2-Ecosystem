-- Migration: Adjust Loyalty Points Atomically (by user_id and by account_id)
-- Date: 2026-02-13
-- Purpose: Atomic point adjustments to prevent lost updates under concurrency

CREATE OR REPLACE FUNCTION adjust_loyalty_points_atomic(
    p_user_id UUID,
    p_points INTEGER,
    p_reason TEXT DEFAULT 'Admin adjustment',
    p_admin_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, lifetime_points INTEGER, adjustment INTEGER, tier_name TEXT, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_member RECORD;
    v_new_balance INTEGER;
    v_new_lifetime INTEGER;
    v_new_tier RECORD;
BEGIN
    SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 0, NULL::TEXT, 'Loyalty account not found'::TEXT;
        RETURN;
    END IF;
    v_new_balance := GREATEST(0, v_member.available_points + p_points);
    v_new_lifetime := CASE WHEN p_points > 0 THEN v_member.lifetime_points + p_points ELSE v_member.lifetime_points END;
    UPDATE loyalty_members SET available_points = v_new_balance, total_points = v_new_balance, lifetime_points = v_new_lifetime, last_activity = NOW(), updated_at = NOW() WHERE id = v_member.id;
    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description) VALUES (v_member.id, 'adjust', p_points, v_new_balance, p_reason);
    SELECT * INTO v_new_tier FROM loyalty_tiers WHERE min_points <= v_new_lifetime ORDER BY min_points DESC LIMIT 1;
    IF v_new_tier IS NOT NULL AND v_new_tier.id != v_member.tier_id THEN
        UPDATE loyalty_members SET tier_id = v_new_tier.id WHERE id = v_member.id;
    END IF;
    RETURN QUERY SELECT true, v_new_balance, v_new_lifetime, p_points, v_new_tier.name, NULL::TEXT;
END;
$func$;
