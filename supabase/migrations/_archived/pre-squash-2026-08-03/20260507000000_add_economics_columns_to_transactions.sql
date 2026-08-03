-- =============================================
-- Add Economics Report Columns to Transactions Table
-- Required for Phase 3: Admin Economics Reports
-- =============================================

BEGIN;

-- Add missing columns for economics reporting
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS promo_code_used VARCHAR(50),
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_transactions_promo_code ON transactions(promo_code_used);
CREATE INDEX IF NOT EXISTS idx_transactions_refund_amount ON transactions(refund_amount) WHERE refund_amount > 0;

-- Add comments for documentation
COMMENT ON COLUMN transactions.staff_id IS 'Staff member who processed the transaction (for performance tracking)';
COMMENT ON COLUMN transactions.cancellation_reason IS 'Reason for transaction cancellation (for cancellation analysis)';
COMMENT ON COLUMN transactions.promo_code_used IS 'Promotional code applied to transaction (for promo effectiveness tracking)';
COMMENT ON COLUMN transactions.refund_amount IS 'Amount refunded (for refund analysis)';
COMMENT ON COLUMN transactions.refund_reason IS 'Reason for refund (for refund analysis)';

COMMIT;
