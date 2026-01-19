-- Migration: 006_loyalty_giftcards_coupons.sql
-- Description: Add loyalty points, gift cards, and coupons system
-- Date: 2026-01-17

-- ============================================
-- LOYALTY POINTS SYSTEM
-- ============================================

-- Loyalty tiers (Bronze, Silver, Gold, Platinum)
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    min_points INTEGER NOT NULL DEFAULT 0,
    points_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    benefits JSONB DEFAULT '[]',
    color VARCHAR(20) DEFAULT '#CD7F32',
    icon VARCHAR(50) DEFAULT 'star',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty accounts (one per customer)
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_points INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    tier_id UUID REFERENCES loyalty_tiers(id),
    member_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Loyalty transactions (earn/redeem history)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust', 'bonus')),
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description VARCHAR(255),
    reference_type VARCHAR(50), -- 'order', 'booking', 'pool_ticket', 'manual'
    reference_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty settings
CREATE TABLE IF NOT EXISTS loyalty_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    points_per_dollar DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    redemption_rate DECIMAL(5,2) NOT NULL DEFAULT 0.01, -- $0.01 per point
    min_redemption INTEGER NOT NULL DEFAULT 100,
    points_expiry_days INTEGER DEFAULT 365,
    signup_bonus INTEGER DEFAULT 100,
    birthday_bonus INTEGER DEFAULT 50,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GIFT CARDS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS gift_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    initial_balance DECIMAL(10,2) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'disabled')),
    purchaser_id UUID REFERENCES users(id),
    purchaser_email VARCHAR(255),
    recipient_email VARCHAR(255),
    recipient_name VARCHAR(100),
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    activated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gift card transactions
CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'redeem', 'refund', 'expire')),
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    notes VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gift card templates (for admin to create preset amounts)
CREATE TABLE IF NOT EXISTS gift_card_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- COUPONS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_item')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount_amount DECIMAL(10,2),
    applies_to VARCHAR(50) DEFAULT 'all' CHECK (applies_to IN ('all', 'restaurant', 'chalets', 'pool', 'snack')),
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    requires_min_items INTEGER DEFAULT 1,
    first_order_only BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupon usage tracking
CREATE TABLE IF NOT EXISTS coupon_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    order_type VARCHAR(50) NOT NULL,
    order_id UUID NOT NULL,
    discount_applied DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_user ON loyalty_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created ON loyalty_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_card ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON coupon_usages(user_id);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default loyalty tiers
INSERT INTO loyalty_tiers (name, min_points, points_multiplier, benefits, color, icon) VALUES
    ('Bronze', 0, 1.00, '["Earn 1 point per $1", "Member-only offers"]', '#CD7F32', 'star'),
    ('Silver', 500, 1.25, '["Earn 1.25 points per $1", "Early access to promotions", "Birthday bonus"]', '#C0C0C0', 'star'),
    ('Gold', 2000, 1.50, '["Earn 1.5 points per $1", "Priority support", "Free upgrades when available"]', '#FFD700', 'crown'),
    ('Platinum', 5000, 2.00, '["Earn 2 points per $1", "VIP concierge", "Exclusive events", "Free cancellation"]', '#E5E4E2', 'gem')
ON CONFLICT DO NOTHING;

-- Insert default loyalty settings
INSERT INTO loyalty_settings (points_per_dollar, redemption_rate, min_redemption, points_expiry_days, signup_bonus, birthday_bonus, is_enabled)
VALUES (1.00, 0.01, 100, 365, 100, 50, true)
ON CONFLICT DO NOTHING;

-- Insert default gift card templates
INSERT INTO gift_card_templates (name, amount, description, sort_order) VALUES
    ('Small Gift', 25.00, 'Perfect for a meal', 1),
    ('Medium Gift', 50.00, 'Great for a day at the resort', 2),
    ('Large Gift', 100.00, 'A memorable experience', 3),
    ('Premium Gift', 250.00, 'The ultimate resort experience', 4)
ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

-- Policies for loyalty_accounts
CREATE POLICY "Users can view own loyalty account" ON loyalty_accounts
    FOR SELECT USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

CREATE POLICY "Staff can manage loyalty accounts" ON loyalty_accounts
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

-- Policies for gift_cards
CREATE POLICY "Users can view own gift cards" ON gift_cards
    FOR SELECT USING (purchaser_id = auth.uid() OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

CREATE POLICY "Staff can manage gift cards" ON gift_cards
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'staff')
    ));

-- Policies for coupons (public read for active coupons)
CREATE POLICY "Anyone can view active coupons" ON coupons
    FOR SELECT USING (is_active = true);

CREATE POLICY "Staff can manage coupons" ON coupons
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ));
