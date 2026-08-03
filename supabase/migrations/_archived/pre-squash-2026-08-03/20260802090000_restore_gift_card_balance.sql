-- Migration: Restore Gift Card Balance
-- Date: 2026-08-02
--
-- Compensation function for gift cards, mirroring reverse_coupon_usage()
-- (see 20260224000000_atomic_safety_functions.sql). Needed because
-- redeem_giftcard_atomic() deducts the balance and inserts a
-- gift_card_transactions row at PRICING time — before the order that
-- consumed it is known to have actually been created — with no existing way
-- to give the balance back if order creation then fails, or if the order is
-- later cancelled/refunded.
--
-- p_order_id: pass the real order id when known (cancel/refund path) so the
-- compensating transaction is traceable to it. Pass NULL for the
-- creation-failure path, same as redeem_giftcard_atomic itself does when the
-- order doesn't exist yet.

CREATE OR REPLACE FUNCTION restore_gift_card_balance(
  p_gift_card_id UUID,
  p_amount DECIMAL,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance DECIMAL, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card RECORD;
  v_new_balance DECIMAL;
BEGIN
  SELECT * INTO v_card FROM gift_cards WHERE id = p_gift_card_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::DECIMAL, 'Gift card not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_card.current_balance + p_amount;

  UPDATE gift_cards
  SET current_balance = v_new_balance,
      -- Flip a fully-redeemed card back to active now that it has balance
      -- again; leave any other status (e.g. a separately expired/cancelled
      -- card) alone rather than resurrecting it.
      status = CASE WHEN status = 'redeemed' THEN 'active' ELSE status END,
      redeemed_at = CASE WHEN status = 'redeemed' THEN NULL ELSE redeemed_at END,
      updated_at = NOW()
  WHERE id = p_gift_card_id;

  INSERT INTO gift_card_transactions(gift_card_id, transaction_type, amount, balance_after, order_id, notes)
  VALUES (p_gift_card_id, 'refund', p_amount, v_new_balance, p_order_id, 'Reversal: order creation failed, was cancelled, or was refunded');

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;
