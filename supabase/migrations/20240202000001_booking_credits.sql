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

-- Add cancellation fields to chalet_bookings if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalet_bookings' AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE chalet_bookings ADD COLUMN cancellation_reason TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalet_bookings' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE chalet_bookings ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalet_bookings' AND column_name = 'refund_amount'
    ) THEN
        ALTER TABLE chalet_bookings ADD COLUMN refund_amount DECIMAL(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalet_bookings' AND column_name = 'modified_at'
    ) THEN
        ALTER TABLE chalet_bookings ADD COLUMN modified_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add cancellation fields to pool_tickets if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pool_tickets' AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE pool_tickets ADD COLUMN cancellation_reason TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pool_tickets' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE pool_tickets ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pool_tickets' AND column_name = 'modified_at'
    ) THEN
        ALTER TABLE pool_tickets ADD COLUMN modified_at TIMESTAMPTZ;
    END IF;
END $$;

-- Cancellation policies table
CREATE TABLE IF NOT EXISTS cancellation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_type VARCHAR(50) NOT NULL, -- 'chalet', 'pool'
    days_before_checkin INTEGER NOT NULL,
    refund_percentage INTEGER NOT NULL,
    refund_type VARCHAR(20) NOT NULL DEFAULT 'FULL', -- FULL, PARTIAL, CREDIT, NONE
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cancellation policies
CREATE INDEX IF NOT EXISTS idx_cancellation_policies_type ON cancellation_policies(booking_type, days_before_checkin DESC);

-- Insert default cancellation policies for chalets
INSERT INTO cancellation_policies (booking_type, days_before_checkin, refund_percentage, refund_type)
VALUES 
    ('chalet', 14, 100, 'FULL'),
    ('chalet', 7, 50, 'PARTIAL'),
    ('chalet', 3, 25, 'PARTIAL'),
    ('chalet', 0, 0, 'NONE')
ON CONFLICT DO NOTHING;

-- Insert default cancellation policies for pool tickets
INSERT INTO cancellation_policies (booking_type, days_before_checkin, refund_percentage, refund_type)
VALUES 
    ('pool', 1, 100, 'FULL'),
    ('pool', 0, 100, 'CREDIT')
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE user_credits IS 'User account credits from cancellations and promotions';
COMMENT ON TABLE cancellation_policies IS 'Configurable cancellation and refund policies';
