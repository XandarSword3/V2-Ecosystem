-- Migration: Fixes and New Features for V2 Ecosystem
-- Includes Inventory, Housekeeping, POS, Coupons, Gift Cards, Loyalty

-- 1. Inventory Extensions
ALTER TABLE IF EXISTS inventory_items
ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS supplier VARCHAR(255),
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS inventory_bom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL, -- Links to menu item
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity DECIMAL(10,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Housekeeping System
CREATE TYPE housekeeping_status AS ENUM ('pending', 'assigned', 'in_progress', 'cleaned', 'inspected', 'approved');
CREATE TYPE unit_clean_state AS ENUM ('clean', 'dirty', 'cleaning', 'inspected', 'out_of_service');

ALTER TABLE IF EXISTS chalet_bookings ADD COLUMN IF NOT EXISTS housekeeping_status housekeeping_status DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL, -- Could be chalet_id or other unit
    unit_type VARCHAR(50) NOT NULL DEFAULT 'chalet',
    task_type VARCHAR(50) NOT NULL, -- 'cleaning', 'deep_clean', 'linen'
    status housekeeping_status DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    scheduled_date DATE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    inspected_at TIMESTAMP WITH TIME ZONE,
    inspected_by UUID REFERENCES users(id),
    inspection_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES housekeeping_tasks(id),
    inventory_item_id UUID REFERENCES inventory_items(id),
    quantity DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Coupons
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_spend DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2), -- For percentage caps
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    usage_limit INT,
    usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Gift Cards
CREATE TABLE IF NOT EXISTS gift_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    initial_balance DECIMAL(10,2) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    purchaser_id UUID REFERENCES users(id),
    recipient_email VARCHAR(255),
    message TEXT,
    expiry_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id UUID REFERENCES gift_cards(id),
    amount DECIMAL(10,2) NOT NULL, -- Negative for spend, Positive for refund/load
    transaction_type VARCHAR(50) NOT NULL,
    order_id UUID, -- Reference to order if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Loyalty
CREATE TABLE IF NOT EXISTS loyalty_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    points_balance INT DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'bronze',
    lifetime_points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    points INT NOT NULL, -- Positive earn, Negative burn
    type VARCHAR(50) NOT NULL, -- 'earn_order', 'redeem_reward'
    reference_id UUID, -- Order ID etc
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. POS / Orders Extensions
ALTER TABLE IF EXISTS table_orders
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id),
ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES users(id);

-- Ensure RLS is appropriate (simplified for this iteration)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
-- Add policies as needed, assuming existing setup or 'authenticated' role access
