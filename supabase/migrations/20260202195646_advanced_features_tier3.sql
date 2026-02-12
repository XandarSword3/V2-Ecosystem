-- ============================================================================
-- ADVANCED FEATURES TIER 3 MIGRATION
-- Enables: GDPR, Marketing, Messaging, Reporting, Revenue, Groups, 
--          Mobile Check-in, Rate Parity
-- ============================================================================

-- ============================================================================
-- 1. GDPR COMPLIANCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS gdpr_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'expired', 'failed')),
    file_path TEXT,
    file_expires_at TIMESTAMPTZ,
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    downloaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
    reason TEXT,
    rejection_reason TEXT,
    data_categories TEXT[] DEFAULT '{}',
    retention_exceptions TEXT[] DEFAULT '{}',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gdpr_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    source TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, consent_type)
);

CREATE TABLE IF NOT EXISTS gdpr_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_category TEXT NOT NULL UNIQUE,
    retention_period_days INTEGER NOT NULL,
    legal_basis TEXT NOT NULL,
    description TEXT,
    auto_delete BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gdpr_processing_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    data_categories TEXT[] DEFAULT '{}',
    legal_basis TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. MARKETING AUTOMATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    vip_status TEXT DEFAULT 'standard',
    total_stays INTEGER DEFAULT 0,
    total_spend DECIMAL(12,2) DEFAULT 0,
    last_stay_date DATE,
    marketing_opt_in BOOLEAN DEFAULT true,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    segment_type TEXT NOT NULL DEFAULT 'dynamic' CHECK (segment_type IN ('dynamic', 'static')),
    rules JSONB DEFAULT '[]',
    member_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segment_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES guest_segments(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(segment_id, guest_id)
);

-- Marketing email templates (separate from system email_templates)
CREATE TABLE IF NOT EXISTS marketing_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    preview_text TEXT,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT DEFAULT 'one-time',
    template_id UUID REFERENCES marketing_email_templates(id),
    segment_id UUID REFERENCES guest_segments(id),
    custom_audience UUID[] DEFAULT '{}',
    subject_line TEXT NOT NULL,
    preview_text TEXT,
    from_name TEXT,
    from_email TEXT,
    schedule_type TEXT DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
    enable_ab_test BOOLEAN DEFAULT false,
    ab_variants JSONB DEFAULT '[]',
    stats JSONB DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "unsubscribed": 0}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    entry_segment_id UUID REFERENCES guest_segments(id),
    is_active BOOLEAN DEFAULT false,
    stats JSONB DEFAULT '{"enrolled": 0, "completed": 0, "exited": 0}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES email_journeys(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('send_email', 'wait', 'condition', 'split', 'update_profile', 'exit')),
    name TEXT,
    config JSONB DEFAULT '{}',
    template_id UUID REFERENCES marketing_email_templates(id),
    wait_duration TEXT,
    wait_until_time TEXT,
    condition_rules JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES email_journeys(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    booking_id UUID,
    current_step INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'exited')),
    entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_step_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    exited_at TIMESTAMPTZ,
    exit_reason TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS campaign_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    journey_id UUID REFERENCES email_journeys(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES journey_enrollments(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    template_id UUID REFERENCES marketing_email_templates(id),
    email_address TEXT NOT NULL,
    subject TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    bounce_reason TEXT,
    external_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. MESSAGING SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS messaging_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('sms', 'whatsapp', 'email', 'push', 'in_app')),
    provider TEXT DEFAULT 'internal',
    api_key_encrypted TEXT,
    from_number TEXT,
    webhook_url TEXT,
    enabled BOOLEAN DEFAULT true,
    chatbot_enabled BOOLEAN DEFAULT false,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(property_id, channel_type)
);

CREATE TABLE IF NOT EXISTS guest_messaging_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    sms_opt_in BOOLEAN DEFAULT false,
    whatsapp_opt_in BOOLEAN DEFAULT false,
    email_opt_in BOOLEAN DEFAULT true,
    push_opt_in BOOLEAN DEFAULT true,
    preferred_channel TEXT DEFAULT 'email',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(guest_id, property_id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    booking_id UUID,
    channel_type TEXT NOT NULL,
    external_id TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID REFERENCES auth.users(id),
    subject TEXT,
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('guest', 'staff', 'system', 'bot')),
    sender_id UUID,
    sender_name TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'location', 'template')),
    content TEXT NOT NULL,
    media_url TEXT,
    template_id UUID,
    template_data JSONB,
    status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    external_id TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    category TEXT,
    content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_approved BOOLEAN DEFAULT false,
    external_template_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chatbot_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_phrases TEXT[] DEFAULT '{}',
    response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'template', 'handoff', 'action')),
    response_content TEXT,
    template_id UUID REFERENCES message_templates(id),
    action_type TEXT,
    action_config JSONB,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. REPORTING & ANALYTICS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    query_config JSONB NOT NULL,
    default_params JSONB DEFAULT '{}',
    column_config JSONB DEFAULT '[]',
    chart_config JSONB,
    allowed_roles TEXT[] DEFAULT '{"admin", "manager"}',
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    parameters JSONB DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    is_favorite BOOLEAN DEFAULT false,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_scheduled (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    report_id UUID REFERENCES saved_reports(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    schedule_config JSONB DEFAULT '{}',
    recipients TEXT[] DEFAULT '{}',
    format TEXT DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel', 'csv')),
    include_charts BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id),
    saved_report_id UUID REFERENCES saved_reports(id),
    scheduled_report_id UUID REFERENCES report_scheduled(id),
    parameters JSONB DEFAULT '{}',
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    row_count INTEGER,
    execution_time_ms INTEGER,
    file_path TEXT,
    file_format TEXT,
    error_message TEXT,
    executed_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    widget_type TEXT NOT NULL,
    data_source TEXT NOT NULL,
    query_config JSONB DEFAULT '{}',
    display_config JSONB DEFAULT '{}',
    position JSONB DEFAULT '{"x": 0, "y": 0, "w": 4, "h": 3}',
    refresh_interval_seconds INTEGER DEFAULT 300,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. REVENUE MANAGEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID,
    forecast_date DATE NOT NULL,
    forecasted_demand DECIMAL(10,2) NOT NULL,
    forecasted_occupancy DECIMAL(5,2),
    forecasted_adr DECIMAL(10,2),
    forecasted_revenue DECIMAL(12,2),
    demand_low DECIMAL(10,2),
    demand_high DECIMAL(10,2),
    factors JSONB DEFAULT '{}',
    model_version TEXT,
    actual_demand INTEGER,
    actual_occupancy DECIMAL(5,2),
    actual_adr DECIMAL(10,2),
    actual_revenue DECIMAL(12,2),
    forecast_accuracy DECIMAL(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(property_id, room_type_id, forecast_date)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL,
    room_type_ids UUID[] DEFAULT '{}',
    rate_plan_ids UUID[] DEFAULT '{}',
    conditions JSONB DEFAULT '{}',
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('percentage', 'fixed', 'multiplier', 'absolute')),
    adjustment_value DECIMAL(10,2) NOT NULL,
    min_rate DECIMAL(10,2),
    max_rate DECIMAL(10,2),
    priority INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID,
    recommendation_date DATE NOT NULL,
    current_rate DECIMAL(10,2) NOT NULL,
    recommended_rate DECIMAL(10,2) NOT NULL,
    reason_code TEXT NOT NULL,
    reasoning TEXT,
    supporting_data JSONB DEFAULT '{}',
    estimated_revenue_impact DECIMAL(12,2),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id),
    applied_rate DECIMAL(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS market_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    expected_demand_impact DECIMAL(5,2),
    expected_rate_impact DECIMAL(5,2),
    location TEXT,
    distance_km DECIMAL(10,2),
    expected_attendance INTEGER,
    source TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    competitor_id TEXT,
    rate_date DATE NOT NULL,
    room_type TEXT,
    rate DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    source TEXT,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. GROUP BOOKINGS & EVENTS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    group_code TEXT NOT NULL UNIQUE,
    group_type TEXT NOT NULL,
    status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'tentative', 'definite', 'cancelled', 'completed')),
    organizer_name TEXT,
    organizer_email TEXT,
    organizer_phone TEXT,
    company_name TEXT,
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    total_rooms INTEGER NOT NULL,
    confirmed_rooms INTEGER DEFAULT 0,
    cutoff_date DATE,
    negotiated_rate DECIMAL(10,2),
    contract_terms JSONB DEFAULT '{}',
    special_requests TEXT,
    notes TEXT,
    assigned_to UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_room_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL,
    block_date DATE NOT NULL,
    blocked_count INTEGER NOT NULL,
    picked_up INTEGER DEFAULT 0,
    released INTEGER DEFAULT 0,
    rate DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'held' CHECK (status IN ('held', 'released', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, room_type_id, block_date)
);

CREATE TABLE IF NOT EXISTS group_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    reservation_id UUID,
    guest_name TEXT NOT NULL,
    guest_email TEXT,
    guest_phone TEXT,
    room_type_id UUID,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    special_requests TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    venue_id UUID,
    venue_name TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    attendees INTEGER,
    setup_requirements TEXT,
    equipment_needs TEXT[] DEFAULT '{}',
    catering_required BOOLEAN DEFAULT false,
    estimated_cost DECIMAL(12,2),
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL UNIQUE,
    terms JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'cancelled')),
    document_url TEXT,
    signed_at TIMESTAMPTZ,
    signed_by TEXT,
    signature_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('deposit', 'interim', 'final', 'adjustment')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    due_date DATE NOT NULL,
    line_items JSONB DEFAULT '[]',
    notes TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES group_invoices(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    reference_number TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    processed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. MOBILE CHECK-IN TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pre_arrival_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL,
    guest_id UUID,
    email TEXT,
    access_token TEXT NOT NULL UNIQUE,
    token_expires_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
    legal_first_name TEXT,
    legal_last_name TEXT,
    date_of_birth DATE,
    nationality TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country TEXT,
    mobile_phone TEXT,
    arrival_flight TEXT,
    arrival_time TIME,
    departure_flight TEXT,
    departure_time TIME,
    purpose_of_visit TEXT,
    has_vehicle BOOLEAN DEFAULT false,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_color TEXT,
    vehicle_plate TEXT,
    special_requests TEXT,
    accessibility_needs TEXT[] DEFAULT '{}',
    dietary_restrictions TEXT[] DEFAULT '{}',
    registration_completed_at TIMESTAMPTZ,
    id_verified BOOLEAN DEFAULT false,
    id_verified_at TIMESTAMPTZ,
    terms_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registration_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES pre_arrival_registrations(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_number TEXT,
    issuing_country TEXT,
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_notes TEXT,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES pre_arrival_registrations(id) ON DELETE CASCADE,
    booking_id UUID,
    guest_id UUID,
    signature_type TEXT NOT NULL,
    signature_data TEXT NOT NULL,
    signature_format TEXT DEFAULT 'base64',
    document_hash TEXT,
    document_version TEXT,
    ip_address TEXT,
    user_agent TEXT,
    device_info JSONB,
    geolocation JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobile_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL,
    guest_id UUID,
    provider TEXT NOT NULL,
    device_id TEXT NOT NULL,
    device_type TEXT NOT NULL,
    device_model TEXT,
    push_token TEXT,
    key_data TEXT,
    access_areas TEXT[] DEFAULT '{}',
    pin_hash TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'expired', 'revoked')),
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobile_key_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID NOT NULL REFERENCES mobile_keys(id) ON DELETE CASCADE,
    access_point TEXT NOT NULL,
    access_result TEXT NOT NULL CHECK (access_result IN ('granted', 'denied')),
    denial_reason TEXT,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. RATE PARITY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_parity_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE UNIQUE,
    is_enabled BOOLEAN DEFAULT true,
    check_frequency_hours INTEGER DEFAULT 24,
    tolerance_percentage DECIMAL(5,2) DEFAULT 2.00,
    tolerance_amount DECIMAL(10,2) DEFAULT 5.00,
    channels_to_monitor TEXT[] DEFAULT '{"booking.com", "expedia", "hotels.com"}',
    alert_on_undercut BOOLEAN DEFAULT true,
    alert_on_overpriced BOOLEAN DEFAULT true,
    undercut_threshold_percentage DECIMAL(5,2) DEFAULT 5.00,
    notification_emails TEXT[] DEFAULT '{}',
    slack_webhook_url TEXT,
    last_check_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_parity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID,
    check_date DATE NOT NULL,
    our_rate DECIMAL(10,2) NOT NULL,
    our_currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'compliant', 'violation', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rate_parity_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES rate_parity_checks(id) ON DELETE CASCADE,
    channel_code TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    channel_rate DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    rate_difference DECIMAL(10,2),
    difference_percentage DECIMAL(5,2),
    is_parity BOOLEAN DEFAULT true,
    violation_type TEXT CHECK (violation_type IN ('undercut', 'overpriced', NULL)),
    raw_data JSONB,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_parity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    check_id UUID REFERENCES rate_parity_checks(id),
    result_id UUID REFERENCES rate_parity_results(id),
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    channel_code TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    room_type_id UUID,
    check_date DATE NOT NULL,
    our_rate DECIMAL(10,2),
    channel_rate DECIMAL(10,2),
    difference_amount DECIMAL(10,2),
    difference_percentage DECIMAL(5,2),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved', 'ignored')),
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- GDPR indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_export_user ON gdpr_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_status ON gdpr_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_user ON gdpr_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user ON gdpr_consents(user_id);

-- Marketing indexes
CREATE INDEX IF NOT EXISTS idx_guests_property ON guests(property_id);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
CREATE INDEX IF NOT EXISTS idx_segments_property ON guest_segments(property_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_property ON marketing_campaigns(property_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_journeys_property ON email_journeys(property_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_journey ON journey_enrollments(journey_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_guest ON journey_enrollments(guest_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_guest ON campaign_sends(guest_id);

-- Messaging indexes
CREATE INDEX IF NOT EXISTS idx_conversations_property ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_guest ON conversations(guest_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- Reporting indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_property ON report_templates(property_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_property ON saved_reports(property_id);
CREATE INDEX IF NOT EXISTS idx_report_scheduled_property ON report_scheduled(property_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_property ON report_executions(property_id);

-- Revenue indexes
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_property_date ON demand_forecasts(property_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_property ON pricing_rules(property_id);
CREATE INDEX IF NOT EXISTS idx_rate_recommendations_property_date ON rate_recommendations(property_id, recommendation_date);
CREATE INDEX IF NOT EXISTS idx_market_events_property_dates ON market_events(property_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_competitor_rates_property_date ON competitor_rates(property_id, rate_date);

-- Groups indexes
CREATE INDEX IF NOT EXISTS idx_group_reservations_property ON group_reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_group_reservations_dates ON group_reservations(arrival_date, departure_date);
CREATE INDEX IF NOT EXISTS idx_group_room_blocks_group ON group_room_blocks(group_id);
CREATE INDEX IF NOT EXISTS idx_group_bookings_group ON group_bookings(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_group ON group_events(group_id);

-- Mobile check-in indexes
CREATE INDEX IF NOT EXISTS idx_registrations_property ON pre_arrival_registrations(property_id);
CREATE INDEX IF NOT EXISTS idx_registrations_booking ON pre_arrival_registrations(booking_id);
CREATE INDEX IF NOT EXISTS idx_registrations_token ON pre_arrival_registrations(access_token);
CREATE INDEX IF NOT EXISTS idx_mobile_keys_property ON mobile_keys(property_id);
CREATE INDEX IF NOT EXISTS idx_mobile_keys_booking ON mobile_keys(booking_id);

-- Rate parity indexes
CREATE INDEX IF NOT EXISTS idx_parity_config_property ON rate_parity_config(property_id);
CREATE INDEX IF NOT EXISTS idx_parity_checks_property ON rate_parity_checks(property_id);
CREATE INDEX IF NOT EXISTS idx_parity_checks_date ON rate_parity_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_parity_alerts_property ON rate_parity_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_parity_alerts_status ON rate_parity_alerts(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE gdpr_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_processing_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_messaging_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_scheduled ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_arrival_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_key_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_parity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_parity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_parity_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_parity_alerts ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (service role bypasses RLS)
-- Users can read their own GDPR data
CREATE POLICY gdpr_export_own ON gdpr_export_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY gdpr_deletion_own ON gdpr_deletion_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY gdpr_consents_own ON gdpr_consents FOR ALL USING (auth.uid() = user_id);

-- Admin-only policies for other tables (service role will bypass)
CREATE POLICY retention_policies_admin ON gdpr_retention_policies FOR ALL USING (true);
CREATE POLICY processing_activities_admin ON gdpr_processing_activities FOR ALL USING (true);
CREATE POLICY guests_admin ON guests FOR ALL USING (true);
CREATE POLICY segments_admin ON guest_segments FOR ALL USING (true);
CREATE POLICY segment_members_admin ON segment_members FOR ALL USING (true);
CREATE POLICY marketing_email_templates_admin ON marketing_email_templates FOR ALL USING (true);
CREATE POLICY campaigns_admin ON marketing_campaigns FOR ALL USING (true);
CREATE POLICY journeys_admin ON email_journeys FOR ALL USING (true);
CREATE POLICY journey_steps_admin ON journey_steps FOR ALL USING (true);
CREATE POLICY enrollments_admin ON journey_enrollments FOR ALL USING (true);
CREATE POLICY campaign_sends_admin ON campaign_sends FOR ALL USING (true);
CREATE POLICY messaging_channels_admin ON messaging_channels FOR ALL USING (true);
CREATE POLICY guest_prefs_admin ON guest_messaging_preferences FOR ALL USING (true);
CREATE POLICY conversations_admin ON conversations FOR ALL USING (true);
CREATE POLICY messages_admin ON messages FOR ALL USING (true);
CREATE POLICY message_templates_admin ON message_templates FOR ALL USING (true);
CREATE POLICY chatbot_intents_admin ON chatbot_intents FOR ALL USING (true);
CREATE POLICY report_templates_admin ON report_templates FOR ALL USING (true);
CREATE POLICY saved_reports_admin ON saved_reports FOR ALL USING (true);
CREATE POLICY report_scheduled_admin ON report_scheduled FOR ALL USING (true);
CREATE POLICY report_executions_admin ON report_executions FOR ALL USING (true);
CREATE POLICY dashboard_widgets_admin ON dashboard_widgets FOR ALL USING (true);
CREATE POLICY demand_forecasts_admin ON demand_forecasts FOR ALL USING (true);
CREATE POLICY pricing_rules_admin ON pricing_rules FOR ALL USING (true);
CREATE POLICY rate_recommendations_admin ON rate_recommendations FOR ALL USING (true);
CREATE POLICY market_events_admin ON market_events FOR ALL USING (true);
CREATE POLICY competitor_rates_admin ON competitor_rates FOR ALL USING (true);
CREATE POLICY group_reservations_admin ON group_reservations FOR ALL USING (true);
CREATE POLICY group_room_blocks_admin ON group_room_blocks FOR ALL USING (true);
CREATE POLICY group_bookings_admin ON group_bookings FOR ALL USING (true);
CREATE POLICY group_events_admin ON group_events FOR ALL USING (true);
CREATE POLICY group_contracts_admin ON group_contracts FOR ALL USING (true);
CREATE POLICY group_invoices_admin ON group_invoices FOR ALL USING (true);
CREATE POLICY group_payments_admin ON group_payments FOR ALL USING (true);
CREATE POLICY group_activities_admin ON group_activities FOR ALL USING (true);
CREATE POLICY registrations_admin ON pre_arrival_registrations FOR ALL USING (true);
CREATE POLICY reg_documents_admin ON registration_documents FOR ALL USING (true);
CREATE POLICY digital_signatures_admin ON digital_signatures FOR ALL USING (true);
CREATE POLICY mobile_keys_admin ON mobile_keys FOR ALL USING (true);
CREATE POLICY mobile_key_log_admin ON mobile_key_access_log FOR ALL USING (true);
CREATE POLICY parity_config_admin ON rate_parity_config FOR ALL USING (true);
CREATE POLICY parity_checks_admin ON rate_parity_checks FOR ALL USING (true);
CREATE POLICY parity_results_admin ON rate_parity_results FOR ALL USING (true);
CREATE POLICY parity_alerts_admin ON rate_parity_alerts FOR ALL USING (true);

-- ============================================================================
-- SEED SOME DEFAULT DATA
-- ============================================================================

-- Default GDPR retention policies
INSERT INTO gdpr_retention_policies (data_category, retention_period_days, legal_basis, description, auto_delete) VALUES
    ('booking_data', 2555, 'contract', 'Booking and reservation data retained for 7 years for tax/legal compliance', false),
    ('payment_data', 2555, 'legal_obligation', 'Payment records retained for 7 years per financial regulations', false),
    ('marketing_preferences', 1095, 'consent', 'Marketing consent data retained for 3 years or until withdrawn', true),
    ('guest_profiles', 1825, 'legitimate_interest', 'Guest profile data retained for 5 years for service improvement', false),
    ('support_tickets', 730, 'legitimate_interest', 'Support conversation history retained for 2 years', true),
    ('website_analytics', 365, 'consent', 'Website analytics data retained for 1 year', true),
    ('security_logs', 365, 'legal_obligation', 'Security audit logs retained for 1 year', false)
ON CONFLICT (data_category) DO NOTHING;

-- Default system report templates (if properties exist)
INSERT INTO report_templates (property_id, name, description, category, query_config, is_system, allowed_roles)
SELECT 
    NULL,
    'Daily Revenue Summary',
    'Overview of daily revenue by department',
    'finance',
    '{"type": "revenue_summary", "groupBy": "department", "period": "daily"}'::jsonb,
    true,
    ARRAY['admin', 'manager', 'accountant']
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Daily Revenue Summary' AND is_system = true);

INSERT INTO report_templates (property_id, name, description, category, query_config, is_system, allowed_roles)
SELECT 
    NULL,
    'Occupancy Report',
    'Room occupancy rates and trends',
    'operations',
    '{"type": "occupancy", "includeForecasts": true}'::jsonb,
    true,
    ARRAY['admin', 'manager', 'front_desk']
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Occupancy Report' AND is_system = true);

INSERT INTO report_templates (property_id, name, description, category, query_config, is_system, allowed_roles)
SELECT 
    NULL,
    'Guest Acquisition Report',
    'New vs returning guests analysis',
    'marketing',
    '{"type": "guest_acquisition", "includeSources": true}'::jsonb,
    true,
    ARRAY['admin', 'manager', 'marketing']
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Guest Acquisition Report' AND is_system = true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate segment members (used by marketing service)
CREATE OR REPLACE FUNCTION calculate_segment_members(p_segment_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
    v_segment RECORD;
BEGIN
    SELECT * INTO v_segment FROM guest_segments WHERE id = p_segment_id;
    
    IF v_segment IS NULL THEN
        RETURN 0;
    END IF;
    
    IF v_segment.segment_type = 'static' THEN
        SELECT COUNT(*) INTO v_count FROM segment_members WHERE segment_id = p_segment_id;
    ELSE
        -- For dynamic segments, count guests matching rules (simplified)
        SELECT COUNT(*) INTO v_count FROM guests WHERE property_id = v_segment.property_id;
    END IF;
    
    -- Update the member count
    UPDATE guest_segments SET member_count = v_count, updated_at = now() WHERE id = p_segment_id;
    
    RETURN v_count;
END;
$$;

-- Function to query guests by rules (simplified version)
CREATE OR REPLACE FUNCTION query_guests_by_rules(
    p_property_id UUID,
    p_rules JSONB,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS SETOF guests
LANGUAGE plpgsql
AS $$
BEGIN
    -- Simplified: return all guests for property
    -- In production, would parse and apply rules dynamically
    RETURN QUERY
    SELECT * FROM guests 
    WHERE property_id = p_property_id
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON TABLE gdpr_export_requests IS 'GDPR data export requests from users';
COMMENT ON TABLE marketing_campaigns IS 'Email marketing campaigns with segmentation';
COMMENT ON TABLE messaging_channels IS 'SMS/WhatsApp/Email messaging channel configuration';
COMMENT ON TABLE report_templates IS 'Customizable report templates';
COMMENT ON TABLE demand_forecasts IS 'Revenue management demand forecasting';
COMMENT ON TABLE group_reservations IS 'Group booking and event management';
COMMENT ON TABLE pre_arrival_registrations IS 'Mobile check-in pre-arrival registration';
COMMENT ON TABLE rate_parity_config IS 'OTA rate parity monitoring configuration';
