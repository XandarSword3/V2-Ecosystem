-- Pool Membership Tables
-- Migration for Sprint 3: Pool system enhancements

-- Pool memberships table
CREATE TABLE IF NOT EXISTS pool_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- INDIVIDUAL, FAMILY, CORPORATE, VIP
    billing_cycle VARCHAR(20) NOT NULL, -- MONTHLY, QUARTERLY, ANNUALLY
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_PAYMENT',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    corporate_name VARCHAR(255),
    max_members INTEGER NOT NULL DEFAULT 1,
    remaining_guest_passes INTEGER NOT NULL DEFAULT 0,
    discount_percentage INTEGER NOT NULL DEFAULT 0,
    auto_renew BOOLEAN DEFAULT true,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    renewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pool memberships
CREATE INDEX IF NOT EXISTS idx_pool_memberships_user ON pool_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_memberships_status ON pool_memberships(status);
CREATE INDEX IF NOT EXISTS idx_pool_memberships_end_date ON pool_memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_pool_memberships_stripe ON pool_memberships(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_pool_memberships_active ON pool_memberships(user_id, status) WHERE status = 'ACTIVE';

-- Membership members table (for family/corporate memberships)
CREATE TABLE IF NOT EXISTS membership_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES pool_memberships(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_INVITATION',
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for membership members
CREATE INDEX IF NOT EXISTS idx_membership_members_membership ON membership_members(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_members_user ON membership_members(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_members_email ON membership_members(email);

-- Guest pass usage tracking
CREATE TABLE IF NOT EXISTS guest_pass_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES pool_memberships(id) ON DELETE CASCADE,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    used_at TIMESTAMPTZ DEFAULT NOW(),
    pool_ticket_id UUID REFERENCES pool_tickets(id) ON DELETE SET NULL
);

-- Indexes for guest pass usage
CREATE INDEX IF NOT EXISTS idx_guest_pass_membership ON guest_pass_usage(membership_id);
CREATE INDEX IF NOT EXISTS idx_guest_pass_date ON guest_pass_usage(used_at);

-- Pool capacity tracking
CREATE TABLE IF NOT EXISTS pool_daily_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    max_capacity INTEGER NOT NULL DEFAULT 100,
    current_count INTEGER NOT NULL DEFAULT 0,
    reserved_member_slots INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for capacity lookup
CREATE INDEX IF NOT EXISTS idx_pool_capacity_date ON pool_daily_capacity(date);

-- Add stripe_customer_id to users if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
    END IF;
END $$;

-- Insert default pool settings
INSERT INTO system_settings (key, value, category, description)
VALUES 
    ('pool.dailyCapacity', '100', 'pool', 'Maximum daily pool capacity'),
    ('pool.memberReservedSlots', '20', 'pool', 'Slots reserved for members'),
    ('pool.advanceBookingDays', '14', 'pool', 'Days in advance tickets can be booked'),
    ('pool.peakHours', '10:00-16:00', 'pool', 'Peak hours for pricing'),
    ('pool.peakPriceMultiplier', '1.5', 'pool', 'Price multiplier during peak hours')
ON CONFLICT (key) DO NOTHING;

-- Function to update pool capacity
CREATE OR REPLACE FUNCTION update_pool_capacity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pool_daily_capacity (date, current_count)
        VALUES (NEW.date::date, 1)
        ON CONFLICT (date) 
        DO UPDATE SET 
            current_count = pool_daily_capacity.current_count + NEW.quantity,
            updated_at = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'CANCELLED') THEN
        UPDATE pool_daily_capacity 
        SET current_count = GREATEST(0, current_count - OLD.quantity),
            updated_at = NOW()
        WHERE date = OLD.date::date;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for pool capacity updates
DROP TRIGGER IF EXISTS pool_ticket_capacity_trigger ON pool_tickets;
CREATE TRIGGER pool_ticket_capacity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON pool_tickets
    FOR EACH ROW EXECUTE FUNCTION update_pool_capacity();

-- Add comments for documentation
COMMENT ON TABLE pool_memberships IS 'Pool membership subscriptions with Stripe integration';
COMMENT ON TABLE membership_members IS 'Additional members for family/corporate memberships';
COMMENT ON TABLE guest_pass_usage IS 'Track usage of membership guest passes';
COMMENT ON TABLE pool_daily_capacity IS 'Track daily pool capacity for availability';
