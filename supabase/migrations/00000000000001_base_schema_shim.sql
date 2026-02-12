-- File: supabase/migrations/00000000000001_base_schema_shim.sql
-- UP Migration
BEGIN;

-- Core Content Tables
CREATE TABLE IF NOT EXISTS chalets (
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

CREATE TABLE IF NOT EXISTS chalet_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    chalet_id UUID NOT NULL REFERENCES chalets(id),
    status VARCHAR(50) NOT NULL, -- PENDING, CONFIRMED, CANCELLED, etc.
    total_price DECIMAL(10,2),
    check_in_date TIMESTAMPTZ,
    check_out_date TIMESTAMPTZ,
    nights INTEGER,
    guest_count INTEGER DEFAULT 1,
    special_requests TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    modified_at TIMESTAMPTZ,
    refund_amount DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pool Tables
CREATE TABLE IF NOT EXISTS pool_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE,
    status VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 1,
    total_price DECIMAL(10,2),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    modified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    start_time TIME,
    end_time TIME,
    capacity INTEGER,
    price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true
);

-- Food & Bev (Generic)
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES menu_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    is_vegetarian BOOLEAN DEFAULT false,
    is_spicy BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS snack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50),
    quantity DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'unit',
    min_stock_level DECIMAL(10,2) DEFAULT 10
);

-- Credits
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(50),
    source_booking_id UUID,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    chalet_booking_id UUID REFERENCES chalet_bookings(id),
    pool_ticket_id UUID REFERENCES pool_tickets(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
