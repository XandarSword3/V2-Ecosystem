-- Rate Parity Monitoring Tables
-- Run this migration to add rate parity tracking

-- Rate parity checks
CREATE TABLE IF NOT EXISTS rate_parity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
    check_date DATE NOT NULL,
    our_rate DECIMAL(10, 2) NOT NULL,
    our_currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending', -- pending, compliant, violation, error
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate parity check results per channel
CREATE TABLE IF NOT EXISTS rate_parity_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID REFERENCES rate_parity_checks(id) ON DELETE CASCADE,
    channel_code VARCHAR(50) NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    channel_rate DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    rate_difference DECIMAL(10, 2),
    difference_percentage DECIMAL(5, 2),
    is_parity BOOLEAN DEFAULT true,
    violation_type VARCHAR(50), -- undercut, overpriced, null
    screenshot_url TEXT,
    raw_data JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate parity alerts
CREATE TABLE IF NOT EXISTS rate_parity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    check_id UUID REFERENCES rate_parity_checks(id) ON DELETE CASCADE,
    result_id UUID REFERENCES rate_parity_results(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- undercut, overpriced, missing_rate
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    channel_code VARCHAR(50) NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    room_type_id UUID REFERENCES room_types(id),
    check_date DATE NOT NULL,
    our_rate DECIMAL(10, 2),
    channel_rate DECIMAL(10, 2),
    difference_amount DECIMAL(10, 2),
    difference_percentage DECIMAL(5, 2),
    status VARCHAR(20) DEFAULT 'new', -- new, acknowledged, resolved, ignored
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate parity configuration
CREATE TABLE IF NOT EXISTS rate_parity_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE UNIQUE,
    is_enabled BOOLEAN DEFAULT true,
    check_frequency_hours INTEGER DEFAULT 24,
    tolerance_percentage DECIMAL(5, 2) DEFAULT 1.00, -- 1% tolerance
    tolerance_amount DECIMAL(10, 2) DEFAULT 5.00, -- $5 tolerance
    channels_to_monitor TEXT[] DEFAULT ARRAY['BOOKING', 'EXPEDIA', 'AGODA'],
    alert_on_undercut BOOLEAN DEFAULT true,
    alert_on_overpriced BOOLEAN DEFAULT true,
    undercut_threshold_percentage DECIMAL(5, 2) DEFAULT 2.00,
    notification_emails TEXT[],
    slack_webhook_url TEXT,
    last_check_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate scraping sources (for direct scraping if needed)
CREATE TABLE IF NOT EXISTS rate_scraping_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_code VARCHAR(50) NOT NULL UNIQUE,
    channel_name VARCHAR(100) NOT NULL,
    scraper_type VARCHAR(50) NOT NULL, -- api, playwright, rapidapi
    api_endpoint TEXT,
    api_key TEXT,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parity_check_property ON rate_parity_checks(property_id);
CREATE INDEX IF NOT EXISTS idx_parity_check_date ON rate_parity_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_parity_check_status ON rate_parity_checks(status);
CREATE INDEX IF NOT EXISTS idx_parity_results_check ON rate_parity_results(check_id);
CREATE INDEX IF NOT EXISTS idx_parity_results_channel ON rate_parity_results(channel_code);
CREATE INDEX IF NOT EXISTS idx_parity_alerts_property ON rate_parity_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_parity_alerts_status ON rate_parity_alerts(status);
CREATE INDEX IF NOT EXISTS idx_parity_alerts_severity ON rate_parity_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_parity_config_property ON rate_parity_config(property_id);

-- RLS
ALTER TABLE rate_parity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_parity_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_parity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_parity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_scraping_sources ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admin access to rate_parity_checks" ON rate_parity_checks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to rate_parity_results" ON rate_parity_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to rate_parity_alerts" ON rate_parity_alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to rate_parity_config" ON rate_parity_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to rate_scraping_sources" ON rate_scraping_sources
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

-- Insert default scraping sources
INSERT INTO rate_scraping_sources (channel_code, channel_name, scraper_type, config) VALUES
    ('BOOKING', 'Booking.com', 'rapidapi', '{"endpoint": "booking-com.p.rapidapi.com"}'),
    ('EXPEDIA', 'Expedia', 'rapidapi', '{"endpoint": "expedia4.p.rapidapi.com"}'),
    ('AGODA', 'Agoda', 'rapidapi', '{"endpoint": "agoda-com.p.rapidapi.com"}'),
    ('GOOGLE', 'Google Hotels', 'api', '{"use_hotel_api": true}')
ON CONFLICT (channel_code) DO NOTHING;

-- Triggers
CREATE TRIGGER update_rate_parity_alerts_timestamp
    BEFORE UPDATE ON rate_parity_alerts
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();

CREATE TRIGGER update_rate_parity_config_timestamp
    BEFORE UPDATE ON rate_parity_config
    FOR EACH ROW EXECUTE FUNCTION update_channel_updated_at();
