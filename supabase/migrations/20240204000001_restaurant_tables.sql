-- Restaurant Tables and Reservations
-- Migration for Sprint 4: Restaurant features

-- Restaurant tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number INTEGER NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL,
    min_capacity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    section VARCHAR(100) NOT NULL DEFAULT 'Main',
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "rotation": 0, "width": 60, "height": 60, "shape": "rectangle"}',
    features JSONB DEFAULT '[]',
    last_status_change TIMESTAMPTZ,
    last_status_changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist (if table already existed with different schema)
DO $$ 
BEGIN
    -- Handle inconsistent column naming from legacy schemas
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_tables' AND column_name = 'table_number') THEN
        ALTER TABLE restaurant_tables RENAME COLUMN table_number TO number;
    END IF;

    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS number INTEGER DEFAULT 0;
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT 'Table';
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 4;
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS min_capacity INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE';
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS section VARCHAR(100) NOT NULL DEFAULT 'Main';
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "rotation": 0, "width": 60, "height": 60, "shape": "rectangle"}';
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMPTZ;
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS last_status_changed_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

-- Indexes for restaurant tables
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_section ON restaurant_tables(section);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_capacity ON restaurant_tables(capacity);

-- Table reservations
CREATE TABLE IF NOT EXISTS table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    end_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50) NOT NULL,
    guest_email VARCHAR(255),
    special_requests TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    seated_at TIMESTAMPTZ,
    seated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    no_show_marked_at TIMESTAMPTZ,
    no_show_marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_table ON table_reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON table_reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON table_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON table_reservations(date, time);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON table_reservations(user_id);

-- Kitchen display queue
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    table_name VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    priority VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
    items JSONB NOT NULL,
    notes TEXT,
    started_at TIMESTAMPTZ,
    started_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    estimated_time INTEGER, -- minutes
    actual_time INTEGER, -- minutes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fix priority column type if it was created as integer
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kitchen_orders' AND column_name = 'priority' AND data_type = 'integer') THEN
        ALTER TABLE kitchen_orders ALTER COLUMN priority TYPE VARCHAR(50) USING 'NORMAL';
        ALTER TABLE kitchen_orders ALTER COLUMN priority SET DEFAULT 'NORMAL';
    END IF;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

-- Indexes for kitchen orders
CREATE INDEX IF NOT EXISTS idx_kitchen_orders_status ON kitchen_orders(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_orders_table ON kitchen_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_orders_priority ON kitchen_orders(priority DESC, created_at ASC);

-- Insert default tables
INSERT INTO restaurant_tables (number, name, capacity, min_capacity, section, position, features)
SELECT v.number::text, v.name, v.capacity, v.min_capacity, v.section, v.position::jsonb, v.features::jsonb
FROM (VALUES 
    (1, 'Table 1', 2, 1, 'Main', '{"x": 50, "y": 50, "rotation": 0, "width": 50, "height": 50, "shape": "circle"}', '["window"]'),
    (2, 'Table 2', 2, 1, 'Main', '{"x": 150, "y": 50, "rotation": 0, "width": 50, "height": 50, "shape": "circle"}', '["window"]'),
    (3, 'Table 3', 4, 2, 'Main', '{"x": 250, "y": 50, "rotation": 0, "width": 80, "height": 60, "shape": "rectangle"}', '[]'),
    (4, 'Table 4', 4, 2, 'Main', '{"x": 350, "y": 50, "rotation": 0, "width": 80, "height": 60, "shape": "rectangle"}', '[]'),
    (5, 'Table 5', 6, 4, 'Main', '{"x": 50, "y": 150, "rotation": 0, "width": 120, "height": 60, "shape": "rectangle"}', '["large"]'),
    (6, 'Table 6', 6, 4, 'Main', '{"x": 200, "y": 150, "rotation": 0, "width": 120, "height": 60, "shape": "rectangle"}', '["large"]'),
    (7, 'Table 7', 8, 6, 'Private', '{"x": 50, "y": 300, "rotation": 0, "width": 150, "height": 80, "shape": "rectangle"}', '["private", "large"]'),
    (8, 'Table 8', 4, 2, 'Terrace', '{"x": 500, "y": 50, "rotation": 0, "width": 60, "height": 60, "shape": "square"}', '["outdoor"]'),
    (9, 'Table 9', 4, 2, 'Terrace', '{"x": 580, "y": 50, "rotation": 0, "width": 60, "height": 60, "shape": "square"}', '["outdoor"]'),
    (10, 'Table 10', 2, 1, 'Bar', '{"x": 500, "y": 200, "rotation": 0, "width": 40, "height": 40, "shape": "circle"}', '["bar"]')
) AS v(number, name, capacity, min_capacity, section, position, features)
WHERE NOT EXISTS (SELECT 1 FROM restaurant_tables WHERE number::text = v.number::text);

-- Insert restaurant settings
INSERT INTO system_settings (key, value, category, description)
VALUES 
    ('restaurant.floorPlan.width', '800', 'restaurant', 'Floor plan width in pixels'),
    ('restaurant.floorPlan.height', '600', 'restaurant', 'Floor plan height in pixels'),
    ('restaurant.reservationDuration', '120', 'restaurant', 'Default reservation duration in minutes'),
    ('restaurant.advanceBookingDays', '30', 'restaurant', 'Days in advance reservations can be made'),
    ('restaurant.noShowThreshold', '15', 'restaurant', 'Minutes after reservation to mark as no-show'),
    ('restaurant.openTime', '11:00', 'restaurant', 'Restaurant opening time'),
    ('restaurant.closeTime', '22:00', 'restaurant', 'Restaurant closing time'),
    ('restaurant.lastSeating', '21:30', 'restaurant', 'Last seating time')
ON CONFLICT (key) DO NOTHING;

-- Add comments
COMMENT ON TABLE restaurant_tables IS 'Restaurant table configuration with floor plan positions';
COMMENT ON TABLE table_reservations IS 'Table reservation system';
COMMENT ON TABLE kitchen_orders IS 'Kitchen display system order queue';
