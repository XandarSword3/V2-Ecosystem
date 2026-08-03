-- OTA Channel Integration Tables
-- Run this migration to add channel management support

-- Channel connections (Booking.com, Expedia, etc.)
CREATE TABLE IF NOT EXISTS channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    channel_code VARCHAR(50) NOT NULL, -- BOOKING, EXPEDIA, AGODA, etc.
    channel_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, active, paused, error
    api_key TEXT,
    api_secret TEXT,
    hotel_code VARCHAR(100), -- Property ID on the channel
    connection_type VARCHAR(20) DEFAULT 'siteminder', -- siteminder, direct
    siteminder_property_id VARCHAR(100),
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, channel_code)
);

-- Room type mappings between V2 and channels
-- Note: room_type_id is optional until room_types table is created
CREATE TABLE IF NOT EXISTS channel_room_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
    room_type_id UUID, -- References room_types(id) when available
    channel_room_code VARCHAR(100) NOT NULL,
    channel_room_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}', -- Extra beds, occupancy limits, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, room_type_id)
);

-- Rate plan mappings
-- Note: rate_plan_id is optional until rate_plans table is created
CREATE TABLE IF NOT EXISTS channel_rate_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
    rate_plan_id UUID, -- References rate_plans(id) when available
    channel_rate_code VARCHAR(100) NOT NULL,
    channel_rate_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    markup_type VARCHAR(20) DEFAULT 'percentage', -- percentage, fixed
    markup_value DECIMAL(10, 2) DEFAULT 0,
    commission_rate DECIMAL(5, 2), -- Channel commission %
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, rate_plan_id)
);

-- Availability updates (outbound)
CREATE TABLE IF NOT EXISTS channel_availability_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
    room_mapping_id UUID REFERENCES channel_room_mappings(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    available_units INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, confirmed, failed
    sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate updates (outbound)
CREATE TABLE IF NOT EXISTS channel_rate_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
    rate_mapping_id UUID REFERENCES channel_rate_mappings(id) ON DELETE CASCADE,
    room_mapping_id UUID REFERENCES channel_room_mappings(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    min_stay INTEGER,
    max_stay INTEGER,
    closed BOOLEAN DEFAULT false,
    closed_arrival BOOLEAN DEFAULT false,
    closed_departure BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations received from channels
-- Note: reservation_id is optional until reservations table is created
CREATE TABLE IF NOT EXISTS channel_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
    reservation_id UUID, -- References reservations(id) when available
    channel_booking_ref VARCHAR(100) NOT NULL,
    channel_guest_id VARCHAR(100),
    guest_name VARCHAR(255),
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    room_mapping_id UUID REFERENCES channel_room_mappings(id),
    rate_mapping_id UUID REFERENCES channel_rate_mappings(id),
    num_adults INTEGER DEFAULT 1,
    num_children INTEGER DEFAULT 0,
    total_amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    commission_amount DECIMAL(10, 2),
    payment_status VARCHAR(20), -- pending, partial, paid
    booking_status VARCHAR(20) NOT NULL, -- new, modified, cancelled
    special_requests TEXT,
    raw_data JSONB, -- Original channel payload
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync log for debugging and monitoring
CREATE TABLE IF NOT EXISTS channel_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- availability_push, rate_push, reservation_pull
    direction VARCHAR(10) NOT NULL, -- inbound, outbound
    status VARCHAR(20) NOT NULL, -- started, success, failed
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_channel_conn_property ON channel_connections(property_id);
CREATE INDEX IF NOT EXISTS idx_channel_conn_status ON channel_connections(status);
CREATE INDEX IF NOT EXISTS idx_channel_room_map_conn ON channel_room_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_channel_rate_map_conn ON channel_rate_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_channel_avail_date ON channel_availability_updates(date);
CREATE INDEX IF NOT EXISTS idx_channel_avail_status ON channel_availability_updates(status);
CREATE INDEX IF NOT EXISTS idx_channel_rate_date ON channel_rate_updates(date);
CREATE INDEX IF NOT EXISTS idx_channel_res_booking ON channel_reservations(channel_booking_ref);
CREATE INDEX IF NOT EXISTS idx_channel_res_checkin ON channel_reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_channel_sync_conn ON channel_sync_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_channel_sync_type ON channel_sync_log(sync_type);

-- RLS
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_room_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_rate_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_availability_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_rate_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_sync_log ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admin full access to channel_connections" ON channel_connections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to channel_room_mappings" ON channel_room_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to channel_rate_mappings" ON channel_rate_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to channel_availability_updates" ON channel_availability_updates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to channel_rate_updates" ON channel_rate_updates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to channel_reservations" ON channel_reservations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to channel_sync_log" ON channel_sync_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_channel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_channel_connections_timestamp
    BEFORE UPDATE ON channel_connections
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();

CREATE TRIGGER update_channel_room_mappings_timestamp
    BEFORE UPDATE ON channel_room_mappings
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();

CREATE TRIGGER update_channel_rate_mappings_timestamp
    BEFORE UPDATE ON channel_rate_mappings
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();
