-- User Credits Table
-- Migration for Sprint 2: Booking modifications with credit system

-- Create user credits table
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    type VARCHAR(50) NOT NULL,
    source_booking_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user credits
CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_expires ON user_credits(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_credits_available ON user_credits(user_id, used_at) WHERE used_at IS NULL;

-- Cancellation/refund fields are stored in transactions.metadata for all engine types.
-- These ALTER TABLE blocks are no-ops.
DO $$ BEGIN NULL; END $$; -- unit reservation bookings: handled via transactions (no standalone table)

-- Cancellation fields for capacity access tickets also live in transactions.metadata.
DO $$ BEGIN NULL; END $$; -- capacity access tickets: handled via transactions (no standalone table)

-- Cancellation policies table
CREATE TABLE IF NOT EXISTS cancellation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_type VARCHAR(50) NOT NULL, -- 'accommodation_unit', 'capacity_window'
    days_before_checkin INTEGER NOT NULL,
    refund_percentage INTEGER NOT NULL,
    refund_type VARCHAR(20) NOT NULL DEFAULT 'FULL', -- FULL, PARTIAL, CREDIT, NONE
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cancellation policies
CREATE INDEX IF NOT EXISTS idx_cancellation_policies_type ON cancellation_policies(booking_type, days_before_checkin DESC);

-- Insert default cancellation policies for accommodation units
INSERT INTO cancellation_policies (booking_type, days_before_checkin, refund_percentage, refund_type)
VALUES 
    ('accommodation_unit', 14, 100, 'FULL'),
    ('accommodation_unit', 7, 50, 'PARTIAL'),
    ('accommodation_unit', 3, 25, 'PARTIAL'),
    ('accommodation_unit', 0, 0, 'NONE')
ON CONFLICT DO NOTHING;

-- Insert default cancellation policies for capacity windows
INSERT INTO cancellation_policies (booking_type, days_before_checkin, refund_percentage, refund_type)
VALUES 
    ('capacity_window', 1, 100, 'FULL'),
    ('capacity_window', 0, 100, 'CREDIT')
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE user_credits IS 'User account credits from cancellations and promotions';
COMMENT ON TABLE cancellation_policies IS 'Configurable cancellation and refund policies';
