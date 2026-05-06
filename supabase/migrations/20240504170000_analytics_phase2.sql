-- Phase 2 Analytics Upgrade Migration
-- Creates tables for governed metrics layer, alerts, and guest segmentation

-- =============================================
-- ALERT SYSTEM
-- =============================================

CREATE TABLE IF NOT EXISTS alert_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'deviation', 'anomaly', 'trend')),
    kpi_code TEXT NOT NULL,
    condition JSONB NOT NULL DEFAULT '{"operator": ">", "value": 0}',
    schedule JSONB NOT NULL DEFAULT '{"frequency": "realtime"}',
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    notification_channels JSONB NOT NULL DEFAULT '[{"type": "in_app", "target": ""}]',
    cooldown_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE alert_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see alerts for their property
CREATE POLICY alert_definitions_property_isolation ON alert_definitions
    FOR ALL
    USING (property_id IN (
        SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    ));

-- Create index for performance
CREATE INDEX idx_alert_definitions_property ON alert_definitions(property_id);
CREATE INDEX idx_alert_definitions_active ON alert_definitions(property_id, is_active);

-- Alert history table
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_definition_id UUID NOT NULL REFERENCES alert_definitions(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    metric_value DECIMAL NOT NULL,
    threshold_value DECIMAL NOT NULL,
    context JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    notifications_sent JSONB DEFAULT '[]'
);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_history_property_isolation ON alert_history
    FOR ALL
    USING (property_id IN (
        SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    ));

CREATE INDEX idx_alert_history_property ON alert_history(property_id);
CREATE INDEX idx_alert_history_active ON alert_history(property_id, status) WHERE status = 'active';
CREATE INDEX idx_alert_history_triggered ON alert_history(triggered_at DESC);

-- =============================================
-- GOVERNED METRICS LAYER
-- =============================================

CREATE TABLE IF NOT EXISTS metric_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('financial', 'operational', 'guest', 'marketing')),
    data_type TEXT NOT NULL CHECK (data_type IN ('currency', 'number', 'percent', 'duration', 'count')),
    calculation JSONB NOT NULL,
    targets JSONB,
    alert_thresholds JSONB,
    format JSONB NOT NULL DEFAULT '{"decimals": 0}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed canonical metrics
INSERT INTO metric_definitions (code, name, description, category, data_type, calculation, targets, alert_thresholds, format) VALUES
('revenue', 'Revenue', 'Total confirmed booking revenue', 'financial', 'currency', 
 '{"type": "aggregated", "source_table": "bookings", "source_field": "total_amount", "aggregation": "sum", "filters": [{"field": "status", "operator": "in", "value": ["confirmed", "checked_in", "checked_out"]}]}',
 '{"daily": 15000, "monthly": 450000}',
 NULL,
 '{"prefix": "$", "decimals": 0, "use_kmb": true}'),

('adr', 'Average Daily Rate', 'Revenue per occupied room night', 'financial', 'currency',
 '{"type": "calculated", "formula": "SUM(room_rate * nights) / SUM(nights)", "source_table": "bookings"}',
 NULL, NULL,
 '{"prefix": "$", "decimals": 2}'),

('occupancy_rate', 'Occupancy Rate', 'Percentage of rooms occupied', 'operational', 'percent',
 '{"type": "calculated", "formula": "(occupied_rooms / total_rooms) * 100", "source_table": "bookings"}',
 '{"daily": 75, "monthly": 78}',
 '{"warning": {"max": 60}, "critical": {"max": 50}}',
 '{"suffix": "%", "decimals": 1}'),

('active_guests', 'Active Guests', 'Currently checked-in guests', 'operational', 'count',
 '{"type": "aggregated", "source_table": "bookings", "aggregation": "count", "filters": [{"field": "status", "operator": "eq", "value": "checked_in"}]}',
 NULL, NULL,
 '{"decimals": 0}'),

('customer_satisfaction', 'Guest Satisfaction', 'Average rating from guest feedback', 'guest', 'number',
 '{"type": "aggregated", "source_table": "reviews", "source_field": "rating", "aggregation": "avg"}',
 '{"daily": 4.5, "monthly": 4.6}',
 '{"warning": {"max": 4.0}, "critical": {"max": 3.5}}',
 '{"decimals": 1}')

ON CONFLICT (code) DO NOTHING;

-- =============================================
-- GUEST SEGMENTATION (RFM)
-- =============================================

CREATE TABLE IF NOT EXISTS guest_rfm_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    r_score INTEGER NOT NULL CHECK (r_score BETWEEN 1 AND 5),
    f_score INTEGER NOT NULL CHECK (f_score BETWEEN 1 AND 5),
    m_score INTEGER NOT NULL CHECK (m_score BETWEEN 1 AND 5),
    segment TEXT NOT NULL,
    lifetime_value DECIMAL NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(property_id, user_id)
);

ALTER TABLE guest_rfm_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY guest_rfm_property_isolation ON guest_rfm_scores
    FOR ALL
    USING (property_id IN (
        SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    ));

CREATE INDEX idx_guest_rfm_property ON guest_rfm_scores(property_id);
CREATE INDEX idx_guest_rfm_segment ON guest_rfm_scores(property_id, segment);
CREATE INDEX idx_guest_rfm_scores ON guest_rfm_scores(property_id, r_score, f_score, m_score);

-- =============================================
-- SAVED QUERIES (Query Builder)
-- =============================================

CREATE TABLE IF NOT EXISTS saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    query_config JSONB NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_executed_at TIMESTAMPTZ,
    execution_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_queries_property_isolation ON saved_queries
    FOR ALL
    USING (property_id IN (
        SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    ) OR created_by = auth.uid() OR is_public = true);

CREATE INDEX idx_saved_queries_property ON saved_queries(property_id);
CREATE INDEX idx_saved_queries_user ON saved_queries(created_by);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_alert_definitions_updated_at BEFORE UPDATE ON alert_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metric_definitions_updated_at BEFORE UPDATE ON metric_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE alert_definitions IS 'Alert threshold definitions for KPI monitoring';
COMMENT ON TABLE alert_history IS 'Historical record of triggered alerts';
COMMENT ON TABLE metric_definitions IS 'Canonical metric definitions for governed analytics';
COMMENT ON TABLE guest_rfm_scores IS 'RFM segmentation scores for guest analytics';
COMMENT ON TABLE saved_queries IS 'User-saved query builder configurations';
