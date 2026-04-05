-- Test loyalty transactions constraints only
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_transaction_type_check;
ALTER TABLE loyalty_transactions 
    ADD CONSTRAINT loyalty_transactions_transaction_type_check 
    CHECK (transaction_type IN ('earning', 'redemption', 'earn', 'redeem', 'adjust', 'penalty', 'bonus', 'refund', 'initial'));
