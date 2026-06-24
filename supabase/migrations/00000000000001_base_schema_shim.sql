-- File: supabase/migrations/00000000000001_base_schema_shim.sql
-- UP Migration
BEGIN;

-- Core Content Tables
CREATE TABLE IF NOT EXISTS accommodation_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    base_price DECIMAL(10,2),
    weekend_price DECIMAL(10,2),
    capacity INTEGER DEFAULT 2,
    size_sqm DECIMAL(10,2),
    amenities JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capacity Windows (formerly pool_sessions)
CREATE TABLE IF NOT EXISTS capacity_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    start_time TIME,
    end_time TIME,
    capacity INTEGER,
    price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true
);

-- Food & Bev (Generic)
CREATE TABLE IF NOT EXISTS catalog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES catalog_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    is_vegetarian BOOLEAN DEFAULT false,
    is_spicy BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS kiosk_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    description TEXT,
    category_id UUID,
    quantity DECIMAL(10,2) DEFAULT 0,
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

-- Order items (plain UUIDs — FKs to transactions/catalog_items added by later migrations)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID,
    catalog_item_id UUID,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) DEFAULT 0,
    special_instructions TEXT,
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credits (plain UUID for user_id — users table created by 00000000000000)
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(50),
    source_booking_id UUID,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (plain UUIDs — FKs to transactions added by later migrations)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    transaction_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
