-- =============================================
-- Phase 3.4: Marketing Automation
-- Email Journeys, Triggered Campaigns, Segmentation
-- =============================================

-- Guest segments for targeted marketing
CREATE TABLE IF NOT EXISTS guest_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    segment_type VARCHAR(50) NOT NULL DEFAULT 'dynamic', -- dynamic, static
    rules JSONB DEFAULT '[]', -- Array of filter rules
    sql_query TEXT, -- Optional custom SQL for complex segments
    guest_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, name)
);

-- Static segment memberships
CREATE TABLE IF NOT EXISTS segment_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES guest_segments(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by VARCHAR(50) DEFAULT 'system', -- system, manual, import
    UNIQUE(segment_id, guest_id)
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'marketing', -- transactional, marketing, operational
    subject VARCHAR(255) NOT NULL,
    preview_text VARCHAR(255),
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables JSONB DEFAULT '[]', -- Available merge variables
    design_data JSONB, -- Drag-drop editor state
    thumbnail_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email journey definitions
CREATE TABLE IF NOT EXISTS email_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    journey_type VARCHAR(50) NOT NULL, -- welcome, pre_arrival, post_stay, birthday, re_engagement, abandoned_booking
    trigger_type VARCHAR(50) NOT NULL, -- event, schedule, segment_entry
    trigger_config JSONB DEFAULT '{}', -- Event type, schedule, etc
    entry_segment_id UUID REFERENCES guest_segments(id),
    exit_conditions JSONB DEFAULT '[]', -- Conditions to exit journey
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, archived
    priority INTEGER DEFAULT 5, -- Higher = more important
    allow_reentry BOOLEAN DEFAULT false,
    reentry_delay_days INTEGER,
    max_sends_per_guest INTEGER DEFAULT 10,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journey steps
CREATE TABLE IF NOT EXISTS journey_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES email_journeys(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL, -- send_email, wait, condition, split, update_profile, exit
    name VARCHAR(100),
    config JSONB NOT NULL DEFAULT '{}',
    -- For email steps
    template_id UUID REFERENCES email_templates(id),
    -- For wait steps
    wait_duration INTERVAL,
    wait_until_time TIME, -- Wait until specific time of day
    wait_for_event VARCHAR(100), -- Wait for specific event
    -- For condition steps
    condition_rules JSONB,
    true_next_step_id UUID,
    false_next_step_id UUID,
    -- Metrics
    sends_count INTEGER DEFAULT 0,
    opens_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    conversions_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guest journey enrollments
CREATE TABLE IF NOT EXISTS journey_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES email_journeys(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    current_step_id UUID REFERENCES journey_steps(id),
    status VARCHAR(20) DEFAULT 'active', -- active, completed, exited, error
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    exited_at TIMESTAMPTZ,
    exit_reason VARCHAR(100),
    next_action_at TIMESTAMPTZ,
    steps_completed INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(journey_id, guest_id, booking_id)
);

-- Campaign definitions (one-time sends)
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) DEFAULT 'promotional', -- promotional, announcement, newsletter, survey
    template_id UUID REFERENCES email_templates(id),
    segment_id UUID REFERENCES guest_segments(id),
    custom_audience JSONB, -- Direct list of guest IDs
    subject_line VARCHAR(255),
    preview_text VARCHAR(255),
    from_name VARCHAR(100),
    from_email VARCHAR(255),
    reply_to VARCHAR(255),
    schedule_type VARCHAR(20) DEFAULT 'immediate', -- immediate, scheduled
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'draft', -- draft, scheduled, sending, sent, cancelled
    -- A/B testing
    enable_ab_test BOOLEAN DEFAULT false,
    ab_variants JSONB DEFAULT '[]', -- Array of variant configs
    ab_test_percentage INTEGER DEFAULT 20,
    ab_winner_metric VARCHAR(50), -- open_rate, click_rate, conversion_rate
    ab_test_duration_hours INTEGER DEFAULT 4,
    -- Metrics
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    conversion_value DECIMAL(12,2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email send log
CREATE TABLE IF NOT EXISTS email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL, -- campaign, journey, transactional, triggered
    campaign_id UUID REFERENCES marketing_campaigns(id),
    journey_id UUID REFERENCES email_journeys(id),
    journey_step_id UUID REFERENCES journey_steps(id),
    template_id UUID REFERENCES email_templates(id),
    booking_id UUID REFERENCES bookings(id),
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    from_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'queued', -- queued, sent, delivered, bounced, failed
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    bounce_type VARCHAR(50), -- hard, soft, complaint
    bounce_reason TEXT,
    message_id VARCHAR(255), -- From email provider
    provider VARCHAR(50), -- sendgrid, mailgun, ses, smtp
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email engagement tracking
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_id UUID NOT NULL REFERENCES email_sends(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- open, click, unsubscribe, spam_report
    event_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(20), -- mobile, desktop, tablet
    link_url TEXT, -- For click events
    link_id VARCHAR(50), -- Tracking ID for the link
    metadata JSONB DEFAULT '{}'
);

-- Triggered automations (simpler than journeys)
CREATE TABLE IF NOT EXISTS triggered_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(100) NOT NULL, -- booking_created, booking_confirmed, check_in, check_out, review_submitted, etc
    trigger_delay INTERVAL DEFAULT '0 seconds',
    trigger_delay_time TIME, -- Send at specific time
    conditions JSONB DEFAULT '[]', -- Additional conditions to check
    template_id UUID NOT NULL REFERENCES email_templates(id),
    is_active BOOLEAN DEFAULT true,
    -- Suppression rules
    suppress_if_recent_send BOOLEAN DEFAULT true,
    suppress_hours INTEGER DEFAULT 24,
    -- Metrics
    trigger_count INTEGER DEFAULT 0,
    send_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggered automation execution log
CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES triggered_automations(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id),
    booking_id UUID REFERENCES bookings(id),
    trigger_event VARCHAR(100) NOT NULL,
    trigger_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, suppressed, failed
    suppression_reason TEXT,
    scheduled_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    send_id UUID REFERENCES email_sends(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guest preferences for communications
CREATE TABLE IF NOT EXISTS guest_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    email_marketing BOOLEAN DEFAULT true,
    email_transactional BOOLEAN DEFAULT true,
    sms_marketing BOOLEAN DEFAULT false,
    sms_transactional BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    preferred_language VARCHAR(10) DEFAULT 'en',
    preferred_contact_time VARCHAR(20), -- morning, afternoon, evening
    interests JSONB DEFAULT '[]',
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guest_id, property_id)
);

-- Unsubscribe log
CREATE TABLE IF NOT EXISTS unsubscribe_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    email VARCHAR(255) NOT NULL,
    unsubscribe_type VARCHAR(50) NOT NULL, -- all, marketing, specific_campaign
    campaign_id UUID REFERENCES marketing_campaigns(id),
    reason VARCHAR(255),
    feedback TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotional codes
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100),
    description TEXT,
    discount_type VARCHAR(20) NOT NULL, -- percentage, fixed, free_night
    discount_value DECIMAL(10,2) NOT NULL,
    minimum_nights INTEGER,
    minimum_amount DECIMAL(10,2),
    applicable_room_types UUID[], -- NULL = all
    valid_from DATE,
    valid_until DATE,
    usage_limit INTEGER,
    usage_per_guest INTEGER DEFAULT 1,
    times_used INTEGER DEFAULT 0,
    campaign_id UUID REFERENCES marketing_campaigns(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, code)
);

-- Promo code usage
CREATE TABLE IF NOT EXISTS promo_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
    guest_id UUID NOT NULL REFERENCES guests(id),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    discount_amount DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE guest_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggered_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_guest_segments_property ON guest_segments(property_id);
CREATE INDEX idx_segment_members_segment ON segment_members(segment_id);
CREATE INDEX idx_segment_members_guest ON segment_members(guest_id);
CREATE INDEX idx_email_templates_property ON email_templates(property_id);
CREATE INDEX idx_email_journeys_property ON email_journeys(property_id);
CREATE INDEX idx_email_journeys_status ON email_journeys(status);
CREATE INDEX idx_journey_steps_journey ON journey_steps(journey_id);
CREATE INDEX idx_journey_enrollments_journey ON journey_enrollments(journey_id);
CREATE INDEX idx_journey_enrollments_guest ON journey_enrollments(guest_id);
CREATE INDEX idx_journey_enrollments_status ON journey_enrollments(status);
CREATE INDEX idx_journey_enrollments_next_action ON journey_enrollments(next_action_at);
CREATE INDEX idx_marketing_campaigns_property ON marketing_campaigns(property_id);
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_email_sends_guest ON email_sends(guest_id);
CREATE INDEX idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX idx_email_sends_journey ON email_sends(journey_id);
CREATE INDEX idx_email_sends_status ON email_sends(status);
CREATE INDEX idx_email_events_send ON email_events(send_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_triggered_automations_property ON triggered_automations(property_id);
CREATE INDEX idx_triggered_automations_event ON triggered_automations(trigger_event);
CREATE INDEX idx_automation_executions_automation ON automation_executions(automation_id);
CREATE INDEX idx_automation_executions_status ON automation_executions(status);
CREATE INDEX idx_guest_preferences_guest ON guest_preferences(guest_id);
CREATE INDEX idx_promo_codes_property ON promo_codes(property_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);

-- Function to calculate segment membership
CREATE OR REPLACE FUNCTION calculate_segment_members(p_segment_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_segment RECORD;
    v_count INTEGER;
    v_property_id UUID;
BEGIN
    SELECT * INTO v_segment FROM guest_segments WHERE id = p_segment_id;
    
    IF v_segment IS NULL THEN
        RETURN 0;
    END IF;
    
    v_property_id := v_segment.property_id;
    
    -- For static segments, just count existing members
    IF v_segment.segment_type = 'static' THEN
        SELECT COUNT(*) INTO v_count FROM segment_members WHERE segment_id = p_segment_id;
    ELSE
        -- For dynamic segments, calculate based on rules
        -- This is a simplified version - real implementation would parse rules
        IF v_segment.sql_query IS NOT NULL THEN
            EXECUTE 'SELECT COUNT(*) FROM (' || v_segment.sql_query || ') sq' INTO v_count;
        ELSE
            -- Default: count all guests with bookings at property
            SELECT COUNT(DISTINCT g.id) INTO v_count
            FROM guests g
            JOIN bookings b ON g.id = b.guest_id
            WHERE b.property_id = v_property_id;
        END IF;
    END IF;
    
    -- Update segment
    UPDATE guest_segments 
    SET guest_count = v_count, last_calculated_at = NOW()
    WHERE id = p_segment_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if guest should receive marketing email
CREATE OR REPLACE FUNCTION can_send_marketing_email(
    p_guest_id UUID,
    p_property_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_prefs RECORD;
BEGIN
    SELECT * INTO v_prefs 
    FROM guest_preferences 
    WHERE guest_id = p_guest_id AND property_id = p_property_id;
    
    -- If no preferences, default to allowed
    IF v_prefs IS NULL THEN
        RETURN true;
    END IF;
    
    -- Check if unsubscribed
    IF v_prefs.unsubscribed_at IS NOT NULL THEN
        RETURN false;
    END IF;
    
    RETURN COALESCE(v_prefs.email_marketing, true);
END;
$$ LANGUAGE plpgsql;

-- Function to get next scheduled automations
CREATE OR REPLACE FUNCTION get_pending_automations(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    execution_id UUID,
    automation_id UUID,
    guest_id UUID,
    booking_id UUID,
    template_id UUID,
    scheduled_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ae.id as execution_id,
        ae.automation_id,
        ae.guest_id,
        ae.booking_id,
        ta.template_id,
        ae.scheduled_at
    FROM automation_executions ae
    JOIN triggered_automations ta ON ae.automation_id = ta.id
    WHERE ae.status = 'pending'
      AND ae.scheduled_at <= NOW()
      AND ta.is_active = true
    ORDER BY ae.scheduled_at
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get journey enrollments needing processing
CREATE OR REPLACE FUNCTION get_pending_journey_steps(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    enrollment_id UUID,
    journey_id UUID,
    guest_id UUID,
    current_step_id UUID,
    next_action_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        je.id as enrollment_id,
        je.journey_id,
        je.guest_id,
        je.current_step_id,
        je.next_action_at
    FROM journey_enrollments je
    JOIN email_journeys ej ON je.journey_id = ej.id
    WHERE je.status = 'active'
      AND je.next_action_at <= NOW()
      AND ej.status = 'active'
    ORDER BY je.next_action_at
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Insert default email templates
INSERT INTO email_templates (property_id, name, category, subject, html_content, variables) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, 'Booking Confirmation', 'transactional', 
 'Your Booking is Confirmed - {{confirmation_number}}',
 '<h1>Thank you for your booking!</h1><p>Dear {{guest_name}},</p><p>Your reservation has been confirmed.</p><p>Confirmation: {{confirmation_number}}<br>Check-in: {{check_in_date}}<br>Check-out: {{check_out_date}}</p>',
 '["guest_name", "confirmation_number", "check_in_date", "check_out_date", "room_type", "total_amount"]'),

('00000000-0000-0000-0000-000000000001'::uuid, 'Pre-Arrival Welcome', 'transactional',
 'Get Ready for Your Stay - {{days_until_arrival}} Days to Go!',
 '<h1>Your stay is approaching!</h1><p>Dear {{guest_name}},</p><p>We are looking forward to welcoming you in {{days_until_arrival}} days.</p><p>Here is everything you need to know before your arrival...</p>',
 '["guest_name", "days_until_arrival", "check_in_date", "property_name"]'),

('00000000-0000-0000-0000-000000000001'::uuid, 'Post-Stay Thank You', 'transactional',
 'Thank You for Staying with Us!',
 '<h1>Thank you for choosing {{property_name}}!</h1><p>Dear {{guest_name}},</p><p>We hope you enjoyed your stay. We would love to hear your feedback.</p><a href="{{review_link}}">Leave a Review</a>',
 '["guest_name", "property_name", "review_link", "check_out_date"]'),

('00000000-0000-0000-0000-000000000001'::uuid, 'Birthday Greeting', 'marketing',
 'Happy Birthday, {{guest_name}}! 🎂',
 '<h1>Happy Birthday!</h1><p>Dear {{guest_name}},</p><p>Wishing you a wonderful birthday! As a special gift, enjoy {{discount}}% off your next stay with code: {{promo_code}}</p>',
 '["guest_name", "discount", "promo_code", "valid_until"]'),

('00000000-0000-0000-0000-000000000001'::uuid, 'We Miss You', 'marketing',
 'It has been a while, {{guest_name}}...',
 '<h1>We miss you!</h1><p>Dear {{guest_name}},</p><p>It has been {{days_since_visit}} days since your last visit. Come back and enjoy our special returning guest offer.</p><p>Use code {{promo_code}} for {{discount}}% off!</p>',
 '["guest_name", "days_since_visit", "promo_code", "discount"]')
ON CONFLICT DO NOTHING;

-- Insert default journey templates
INSERT INTO email_journeys (property_id, name, description, journey_type, trigger_type, trigger_config, status) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, 'Pre-Arrival Journey', 
 'Send helpful information before guest arrival',
 'pre_arrival', 'event', '{"event": "booking_confirmed"}', 'active'),

('00000000-0000-0000-0000-000000000001'::uuid, 'Post-Stay Journey',
 'Thank guests and request reviews after checkout',
 'post_stay', 'event', '{"event": "check_out"}', 'active'),

('00000000-0000-0000-0000-000000000001'::uuid, 'Re-engagement Journey',
 'Reach out to guests who have not booked recently',
 're_engagement', 'schedule', '{"days_since_last_stay": 180}', 'draft')
ON CONFLICT DO NOTHING;

-- Insert default triggered automations
INSERT INTO triggered_automations (property_id, name, trigger_event, trigger_delay, template_id, is_active) 
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Booking Confirmation Email',
    'booking_confirmed',
    '0 seconds'::interval,
    id,
    true
FROM email_templates WHERE name = 'Booking Confirmation' LIMIT 1
ON CONFLICT DO NOTHING;
