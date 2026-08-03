-- =============================================
-- Phase 4.2: Self-Service Kiosk
-- Database Migration
-- =============================================

-- Kiosk Device Registry
CREATE TABLE IF NOT EXISTS kiosk_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  device_name VARCHAR(100) NOT NULL,
  device_code VARCHAR(20) NOT NULL UNIQUE, -- K001, K002
  location VARCHAR(255), -- Lobby, Entrance, etc.
  device_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, compact, outdoor
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  
  -- Hardware capabilities
  has_id_scanner BOOLEAN DEFAULT false,
  has_card_reader BOOLEAN DEFAULT false,
  has_key_encoder BOOLEAN DEFAULT false,
  has_receipt_printer BOOLEAN DEFAULT false,
  has_signature_pad BOOLEAN DEFAULT false,
  has_camera BOOLEAN DEFAULT false,
  has_cash_acceptor BOOLEAN DEFAULT false,
  has_card_dispenser BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'offline', -- online, offline, maintenance, error
  last_heartbeat TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  
  -- Configuration
  config JSONB DEFAULT '{}', -- timeout settings, default language, etc.
  operating_hours JSONB, -- {"monday": {"open": "06:00", "close": "23:00"}}
  
  -- Maintenance
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  maintenance_notes TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kiosk Sessions
CREATE TABLE IF NOT EXISTS kiosk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id UUID NOT NULL REFERENCES kiosk_devices(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  session_type VARCHAR(30) NOT NULL, -- checkin, checkout, key_replacement, info, payment
  
  -- Guest/Booking Info (references optional until those tables are created)
  booking_id UUID, -- References bookings(id) when available
  guest_id UUID, -- References guests(id) when available
  confirmation_number VARCHAR(50),
  
  -- Session Flow
  status VARCHAR(20) NOT NULL DEFAULT 'started', -- started, in_progress, completed, abandoned, timeout, error
  current_step VARCHAR(50),
  steps_completed JSONB DEFAULT '[]',
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Input Data
  input_data JSONB DEFAULT '{}', -- Collected during session
  
  -- Results
  result_status VARCHAR(20), -- success, partial, failed
  result_data JSONB, -- Room assigned, keys issued, etc.
  failure_reason TEXT,
  
  -- Transfer to desk
  transferred_to_desk BOOLEAN DEFAULT false,
  transfer_reason TEXT,
  desk_staff_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kiosk Transactions (payments, key encoding, etc.)
CREATE TABLE IF NOT EXISTS kiosk_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES kiosk_sessions(id) ON DELETE CASCADE,
  kiosk_id UUID NOT NULL REFERENCES kiosk_devices(id) ON DELETE CASCADE,
  transaction_type VARCHAR(30) NOT NULL, -- payment, key_encode, id_scan, receipt_print, card_dispense
  
  -- Details
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  request_data JSONB,
  response_data JSONB,
  
  -- For payments
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  payment_method VARCHAR(30),
  payment_reference VARCHAR(100),
  
  -- Error handling
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kiosk Hardware Events (for monitoring)
CREATE TABLE IF NOT EXISTS kiosk_hardware_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id UUID NOT NULL REFERENCES kiosk_devices(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL, -- paper_low, paper_out, key_stock_low, card_jam, scanner_error, etc.
  severity VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, error, critical
  
  component VARCHAR(50), -- printer, scanner, key_encoder, card_reader
  details JSONB,
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kiosk Key Stock (physical key cards)
CREATE TABLE IF NOT EXISTS kiosk_key_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id UUID NOT NULL REFERENCES kiosk_devices(id) ON DELETE CASCADE,
  
  -- Stock levels
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 20,
  maximum_stock INTEGER NOT NULL DEFAULT 200,
  
  -- Tracking
  last_refill_date TIMESTAMPTZ,
  last_refill_quantity INTEGER,
  last_refill_by UUID,
  
  -- Alerts
  low_stock_alert_sent BOOLEAN DEFAULT false,
  last_alert_at TIMESTAMPTZ,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kiosk Screen Flows (configurable UI flows)
CREATE TABLE IF NOT EXISTS kiosk_screen_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  flow_type VARCHAR(30) NOT NULL, -- checkin, checkout, key_replacement
  
  -- Flow definition
  name VARCHAR(100) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL, -- Ordered array of step definitions
  
  -- Localization
  default_language VARCHAR(5) DEFAULT 'en',
  available_languages VARCHAR(5)[] DEFAULT ARRAY['en'],
  
  -- Settings
  timeout_seconds INTEGER DEFAULT 120,
  enable_help_button BOOLEAN DEFAULT true,
  enable_cancel_button BOOLEAN DEFAULT true,
  enable_language_selector BOOLEAN DEFAULT true,
  
  -- Scheduling
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_until DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Kiosk Screen Content (localized content for screens)
CREATE TABLE IF NOT EXISTS kiosk_screen_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES kiosk_screen_flows(id) ON DELETE CASCADE,
  step_key VARCHAR(50) NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  
  -- Content
  title VARCHAR(200),
  subtitle VARCHAR(300),
  instructions TEXT,
  button_labels JSONB, -- {"next": "Continue", "back": "Go Back"}
  error_messages JSONB,
  
  -- Media
  image_url TEXT,
  video_url TEXT,
  animation_type VARCHAR(30),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(flow_id, step_key, language)
);

-- Kiosk Analytics
CREATE TABLE IF NOT EXISTS kiosk_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kiosk_id UUID REFERENCES kiosk_devices(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  
  -- Session metrics
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  abandoned_sessions INTEGER DEFAULT 0,
  timeout_sessions INTEGER DEFAULT 0,
  error_sessions INTEGER DEFAULT 0,
  transferred_sessions INTEGER DEFAULT 0,
  
  -- Operation metrics
  checkins_completed INTEGER DEFAULT 0,
  checkouts_completed INTEGER DEFAULT 0,
  keys_issued INTEGER DEFAULT 0,
  payments_processed INTEGER DEFAULT 0,
  
  -- Time metrics
  avg_session_duration_seconds INTEGER,
  avg_checkin_duration_seconds INTEGER,
  peak_hour INTEGER, -- 0-23
  
  -- Error metrics
  hardware_errors INTEGER DEFAULT 0,
  payment_failures INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, kiosk_id, date)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_kiosk_devices_property ON kiosk_devices(property_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_status ON kiosk_devices(status);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_kiosk ON kiosk_sessions(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_booking ON kiosk_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_status ON kiosk_sessions(status);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_started ON kiosk_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_kiosk_transactions_session ON kiosk_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_hardware_events_kiosk ON kiosk_hardware_events(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_hardware_events_resolved ON kiosk_hardware_events(resolved);
CREATE INDEX IF NOT EXISTS idx_kiosk_analytics_date ON kiosk_analytics(property_id, date);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_hardware_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_key_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_screen_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_screen_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_analytics ENABLE ROW LEVEL SECURITY;

-- Admin policies for kiosk tables
CREATE POLICY "Admin full access to kiosk_devices" ON kiosk_devices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin', 'staff')
        )
    );

CREATE POLICY "Admin full access to kiosk_sessions" ON kiosk_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin', 'staff')
        )
    );

CREATE POLICY "Admin full access to kiosk_transactions" ON kiosk_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin', 'staff')
        )
    );

CREATE POLICY "Admin full access to kiosk_hardware_events" ON kiosk_hardware_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin', 'staff')
        )
    );

CREATE POLICY "Admin full access to kiosk_key_stock" ON kiosk_key_stock
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin', 'staff')
        )
    );

CREATE POLICY "Admin full access to kiosk_screen_flows" ON kiosk_screen_flows
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to kiosk_screen_content" ON kiosk_screen_content
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin full access to kiosk_analytics" ON kiosk_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin', 'staff')
        )
    );

-- =============================================
-- FUNCTIONS
-- =============================================

-- Update kiosk heartbeat and detect issues
CREATE OR REPLACE FUNCTION update_kiosk_heartbeat(
  p_kiosk_id UUID,
  p_status VARCHAR DEFAULT 'online',
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE kiosk_devices
  SET 
    status = p_status,
    last_heartbeat = NOW(),
    last_error = COALESCE(p_error, last_error),
    error_count = CASE WHEN p_error IS NOT NULL THEN error_count + 1 ELSE error_count END,
    updated_at = NOW()
  WHERE id = p_kiosk_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-detect offline kiosks
CREATE OR REPLACE FUNCTION detect_offline_kiosks()
RETURNS TABLE(kiosk_id UUID, device_name VARCHAR, last_seen TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  UPDATE kiosk_devices
  SET status = 'offline', updated_at = NOW()
  WHERE status = 'online'
    AND last_heartbeat < NOW() - INTERVAL '5 minutes'
    AND is_active = true
  RETURNING id, device_name, last_heartbeat;
END;
$$ LANGUAGE plpgsql;

-- Calculate session duration on completion
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'abandoned', 'timeout', 'error') AND NEW.completed_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_kiosk_session_duration
  BEFORE UPDATE ON kiosk_sessions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_session_duration();

-- Aggregate daily kiosk analytics
CREATE OR REPLACE FUNCTION aggregate_kiosk_analytics(
  p_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT property_id, kiosk_id 
    FROM kiosk_sessions 
    WHERE DATE(started_at) = p_date
  LOOP
    INSERT INTO kiosk_analytics (
      property_id, kiosk_id, date,
      total_sessions, completed_sessions, abandoned_sessions,
      timeout_sessions, error_sessions, transferred_sessions,
      checkins_completed, checkouts_completed, keys_issued, payments_processed,
      avg_session_duration_seconds, avg_checkin_duration_seconds
    )
    SELECT
      r.property_id,
      r.kiosk_id,
      p_date,
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'abandoned'),
      COUNT(*) FILTER (WHERE status = 'timeout'),
      COUNT(*) FILTER (WHERE status = 'error'),
      COUNT(*) FILTER (WHERE transferred_to_desk = true),
      COUNT(*) FILTER (WHERE session_type = 'checkin' AND status = 'completed'),
      COUNT(*) FILTER (WHERE session_type = 'checkout' AND status = 'completed'),
      (SELECT COUNT(*) FROM kiosk_transactions t 
       JOIN kiosk_sessions s ON t.session_id = s.id
       WHERE s.kiosk_id = r.kiosk_id AND DATE(t.created_at) = p_date 
       AND t.transaction_type = 'key_encode' AND t.status = 'completed'),
      (SELECT COUNT(*) FROM kiosk_transactions t 
       JOIN kiosk_sessions s ON t.session_id = s.id
       WHERE s.kiosk_id = r.kiosk_id AND DATE(t.created_at) = p_date 
       AND t.transaction_type = 'payment' AND t.status = 'completed'),
      AVG(duration_seconds)::INTEGER,
      AVG(duration_seconds) FILTER (WHERE session_type = 'checkin')::INTEGER
    FROM kiosk_sessions
    WHERE property_id = r.property_id
      AND kiosk_id = r.kiosk_id
      AND DATE(started_at) = p_date
    ON CONFLICT (property_id, kiosk_id, date) 
    DO UPDATE SET
      total_sessions = EXCLUDED.total_sessions,
      completed_sessions = EXCLUDED.completed_sessions,
      abandoned_sessions = EXCLUDED.abandoned_sessions,
      timeout_sessions = EXCLUDED.timeout_sessions,
      error_sessions = EXCLUDED.error_sessions,
      transferred_sessions = EXCLUDED.transferred_sessions,
      checkins_completed = EXCLUDED.checkins_completed,
      checkouts_completed = EXCLUDED.checkouts_completed,
      keys_issued = EXCLUDED.keys_issued,
      payments_processed = EXCLUDED.payments_processed,
      avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
      avg_checkin_duration_seconds = EXCLUDED.avg_checkin_duration_seconds,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE kiosk_devices IS 'Registry of self-service kiosk hardware';
COMMENT ON TABLE kiosk_sessions IS 'Guest interactions with kiosks';
COMMENT ON TABLE kiosk_transactions IS 'Individual operations during kiosk sessions';
COMMENT ON TABLE kiosk_hardware_events IS 'Hardware status and error events';
COMMENT ON TABLE kiosk_key_stock IS 'Physical key card inventory per kiosk';
COMMENT ON TABLE kiosk_screen_flows IS 'Configurable UI flows for kiosk operations';
COMMENT ON TABLE kiosk_screen_content IS 'Localized content for kiosk screens';
COMMENT ON TABLE kiosk_analytics IS 'Aggregated kiosk performance metrics';
