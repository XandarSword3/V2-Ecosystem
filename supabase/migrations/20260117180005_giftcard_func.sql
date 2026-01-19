-- Migration: Gift Card Function
-- Date: 2026-01-17

CREATE OR REPLACE FUNCTION redeem_giftcard_atomic(p_code TEXT, p_amount DECIMAL, p_order_id UUID)
RETURNS TABLE(success BOOLEAN, amount_redeemed DECIMAL, new_balance DECIMAL, gift_card_id UUID, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_card RECORD;
    v_redeem_amount DECIMAL;
BEGIN
    SELECT * INTO v_card FROM gift_cards WHERE code = UPPER(p_code) AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 0::DECIMAL, NULL::UUID, 'Gift card not found, inactive, or expired'::TEXT;
        RETURN;
    END IF;
    IF v_card.current_balance <= 0 THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_card.current_balance, v_card.id, 'Gift card has no balance'::TEXT;
        RETURN;
    END IF;
    v_redeem_amount := LEAST(p_amount, v_card.current_balance);
    UPDATE gift_cards SET current_balance = current_balance - v_redeem_amount, status = CASE WHEN current_balance - v_redeem_amount <= 0 THEN 'redeemed' ELSE 'active' END, redeemed_at = CASE WHEN current_balance - v_redeem_amount <= 0 THEN NOW() ELSE redeemed_at END, updated_at = NOW() WHERE id = v_card.id;
    INSERT INTO gift_card_transactions(gift_card_id, transaction_type, amount, balance_after, order_id, notes) VALUES (v_card.id, 'redemption', -v_redeem_amount, v_card.current_balance - v_redeem_amount, p_order_id, 'Order redemption');
    IF p_order_id IS NOT NULL THEN
        INSERT INTO order_gift_card_usage(order_id, gift_card_id, amount_used, balance_before, balance_after) VALUES (p_order_id, v_card.id, v_redeem_amount, v_card.current_balance, v_card.current_balance - v_redeem_amount);
    END IF;
    RETURN QUERY SELECT true, v_redeem_amount, v_card.current_balance - v_redeem_amount, v_card.id, NULL::TEXT;
END;
$func$;
