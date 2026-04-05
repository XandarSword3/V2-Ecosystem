-- Migration to fix schema drift in test environment (and potentially prod) for chalet_bookings

-- Ensure a compatibility chalet_bookings table exists before schema patches
CREATE TABLE IF NOT EXISTS chalet_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_number TEXT,
    chalet_id UUID,
    customer_id UUID,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    check_in_date TIMESTAMPTZ,
    check_out_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    number_of_guests INTEGER,
    number_of_nights INTEGER,
    base_amount DECIMAL(10, 2),
    add_ons_amount DECIMAL(10, 2) DEFAULT 0,
    deposit_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2),
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    pricing_rules_applied JSONB DEFAULT '[]'::jsonb,
    special_requests TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Add missing columns to chalet_bookings
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS booking_number TEXT;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10, 2);
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS add_ons_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS number_of_guests INTEGER;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS number_of_nights INTEGER;
ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS special_requests TEXT;

-- 2. Create chalet_price_rules table if not exists
CREATE TABLE IF NOT EXISTS chalet_price_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chalet_id UUID,
    name TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price DECIMAL(10, 2),
    price_multiplier DECIMAL(3, 2),
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create site_settings table if not exists
CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create chalet_add_ons table if not exists (referenced in controller)
CREATE TABLE IF NOT EXISTS chalet_add_ons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    price_type TEXT CHECK (price_type IN ('per_stay', 'per_night', 'per_person')) DEFAULT 'per_stay',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create chalet_booking_add_ons table if not exists
CREATE TABLE IF NOT EXISTS chalet_booking_add_ons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES chalet_bookings(id) ON DELETE CASCADE,
    add_on_id UUID REFERENCES chalet_add_ons(id),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
