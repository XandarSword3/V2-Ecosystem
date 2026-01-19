-- Tier 1 Features Database Migration
-- Gift Cards, Coupons, Inventory, Housekeeping, Loyalty

-- =====================================================
-- GIFT CARDS
-- =====================================================

-- Gift Card Templates
CREATE TABLE IF NOT EXISTS gift_card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    background_color VARCHAR(7) DEFAULT '#4F46E5',
    text_color VARCHAR(7) DEFAULT '#FFFFFF',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gift Cards
CREATE TABLE IF NOT EXISTS gift_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    template_id UUID REFERENCES gift_card_templates(id) ON DELETE SET NULL,
    initial_value DECIMAL(10,2) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'disabled')),
    recipient_email VARCHAR(255),
    recipient_name VARCHAR(255),
    sender_name VARCHAR(255),
    personal_message TEXT,
    purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gift Card Transactions
CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'redemption', 'refund', 'adjustment')),
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    order_id UUID,
    notes TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- COUPONS
-- =====================================================

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_item')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount_amount DECIMAL(10,2),
    applies_to VARCHAR(50) DEFAULT 'all' CHECK (applies_to IN ('all', 'restaurant', 'chalets', 'pool', 'snack_bar', 'specific_items')),
    specific_items JSONB DEFAULT '[]',
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupon Usage Tracking
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id UUID,
    discount_applied DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INVENTORY
-- =====================================================

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6B7280',
    parent_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    description TEXT,
    category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'piece',
    current_stock DECIMAL(10,2) DEFAULT 0,
    min_stock_level DECIMAL(10,2) DEFAULT 0,
    max_stock_level DECIMAL(10,2),
    reorder_point DECIMAL(10,2) DEFAULT 10,
    cost_per_unit DECIMAL(10,2),
    supplier VARCHAR(255),
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'adjustment', 'transfer', 'waste', 'return')),
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    stock_before DECIMAL(10,2),
    stock_after DECIMAL(10,2),
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Alerts
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock', 'expiring')),
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- HOUSEKEEPING
-- =====================================================

-- Task Types
CREATE TABLE IF NOT EXISTS housekeeping_task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_priority VARCHAR(20) DEFAULT 'normal' CHECK (default_priority IN ('low', 'normal', 'high', 'urgent')),
    estimated_duration INTEGER DEFAULT 30, -- in minutes
    color VARCHAR(7) DEFAULT '#6B7280',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Housekeeping Tasks
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type_id UUID REFERENCES housekeeping_task_types(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    location_type VARCHAR(50) CHECK (location_type IN ('chalet', 'room', 'pool', 'restaurant', 'common_area', 'other')),
    location_id UUID,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    images JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Housekeeping Task Comments
CREATE TABLE IF NOT EXISTS housekeeping_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES housekeeping_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LOYALTY PROGRAM
-- =====================================================

-- Loyalty Tiers
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    min_points INTEGER NOT NULL DEFAULT 0,
    points_multiplier DECIMAL(3,2) DEFAULT 1.00,
    benefits JSONB DEFAULT '[]',
    color VARCHAR(7) DEFAULT '#6B7280',
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Members
CREATE TABLE IF NOT EXISTS loyalty_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tier_id UUID REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
    total_points INTEGER DEFAULT 0,
    available_points INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,
    member_since TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjustment', 'bonus')),
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id UUID,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Rewards
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points_required INTEGER NOT NULL,
    reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('discount', 'free_item', 'upgrade', 'experience', 'merchandise')),
    reward_value JSONB NOT NULL,
    image_url TEXT,
    stock INTEGER,
    min_tier_id UUID REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reward Redemptions
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES loyalty_rewards(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes TEXT
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card ON gift_card_transactions(gift_card_id);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock ON inventory_items(current_stock, min_stock_level);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_item ON inventory_alerts(item_id, is_resolved);

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_assigned ON housekeeping_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_due ON housekeeping_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_loyalty_members_user ON loyalty_members(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_tier ON loyalty_members(tier_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_member ON loyalty_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON loyalty_rewards(is_active, valid_from, valid_until);

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Default Loyalty Tiers
INSERT INTO loyalty_tiers (name, min_points, points_multiplier, benefits, color, icon, sort_order) VALUES
    ('Bronze', 0, 1.00, '["Welcome bonus: 100 points", "Birthday reward"]', '#CD7F32', 'bronze', 1),
    ('Silver', 1000, 1.25, '["1.25x points multiplier", "Priority support", "Early access to deals"]', '#C0C0C0', 'silver', 2),
    ('Gold', 5000, 1.50, '["1.5x points multiplier", "Free upgrades", "Exclusive events"]', '#FFD700', 'gold', 3),
    ('Platinum', 15000, 2.00, '["2x points multiplier", "Personal concierge", "VIP experiences", "Complimentary amenities"]', '#E5E4E2', 'platinum', 4)
ON CONFLICT DO NOTHING;

-- Default Inventory Categories
INSERT INTO inventory_categories (name, description, color) VALUES
    ('Food & Beverages', 'Food items and drinks', '#22C55E'),
    ('Cleaning Supplies', 'Cleaning and maintenance products', '#3B82F6'),
    ('Linens & Towels', 'Bedding, towels, and textiles', '#A855F7'),
    ('Kitchen Equipment', 'Kitchen tools and equipment', '#F59E0B'),
    ('Office Supplies', 'General office supplies', '#6B7280'),
    ('Pool Supplies', 'Pool maintenance and amenities', '#06B6D4')
ON CONFLICT DO NOTHING;

-- Default Housekeeping Task Types
INSERT INTO housekeeping_task_types (name, description, default_priority, estimated_duration, color) VALUES
    ('Room Cleaning', 'Standard room cleaning and turnover', 'normal', 45, '#22C55E'),
    ('Deep Cleaning', 'Thorough deep cleaning service', 'normal', 120, '#3B82F6'),
    ('Laundry Service', 'Washing and folding linens', 'normal', 60, '#A855F7'),
    ('Pool Maintenance', 'Pool cleaning and chemical balance', 'high', 90, '#06B6D4'),
    ('Repair Request', 'General repairs and maintenance', 'high', 60, '#F59E0B'),
    ('Guest Request', 'Special guest requests', 'high', 30, '#EC4899')
ON CONFLICT DO NOTHING;

-- Default Gift Card Template
INSERT INTO gift_card_templates (name, description, background_color, text_color) VALUES
    ('Classic', 'Standard gift card design', '#4F46E5', '#FFFFFF'),
    ('Celebration', 'For birthdays and special occasions', '#EC4899', '#FFFFFF'),
    ('Nature', 'Nature-themed design', '#22C55E', '#FFFFFF'),
    ('Premium', 'Elegant premium design', '#000000', '#FFD700')
ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- Public read for templates, tiers, rewards
CREATE POLICY "Public can view gift card templates" ON gift_card_templates FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view loyalty tiers" ON loyalty_tiers FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view loyalty rewards" ON loyalty_rewards FOR SELECT USING (is_active = true);

-- Authenticated users policies
CREATE POLICY "Users can view their own gift cards" ON gift_cards FOR SELECT USING (purchased_by = auth.uid() OR recipient_email = (SELECT email FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can view their loyalty membership" ON loyalty_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view their loyalty transactions" ON loyalty_transactions FOR SELECT USING (member_id IN (SELECT id FROM loyalty_members WHERE user_id = auth.uid()));

-- Admin/Staff full access policies (using user_roles junction table)
CREATE POLICY "Staff can manage gift cards" ON gift_cards FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can manage coupons" ON coupons FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can manage inventory" ON inventory_items FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can manage inventory categories" ON inventory_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can view inventory transactions" ON inventory_transactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can manage inventory alerts" ON inventory_alerts FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can manage housekeeping tasks" ON housekeeping_tasks FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can manage housekeeping task types" ON housekeeping_task_types FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
CREATE POLICY "Staff can manage loyalty members" ON loyalty_members FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);
