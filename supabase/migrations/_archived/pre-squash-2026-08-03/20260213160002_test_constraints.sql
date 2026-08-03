-- Test constraints only
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_status_check;
ALTER TABLE gift_cards 
    ADD CONSTRAINT gift_cards_status_check 
    CHECK (status IN ('active', 'used', 'expired', 'disabled', 'pending', 'redeemed'));
