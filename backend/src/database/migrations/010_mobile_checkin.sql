-- =============================================
-- Phase 4.1: Mobile Check-in
-- Pre-arrival Registration, Digital Signatures, Mobile Keys
-- =============================================

-- Pre-arrival registration records
CREATE TABLE IF NOT EXISTS pre_arrival_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    
    -- Registration Status
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'started', 'documents_uploaded', 'review_required', 
        'approved', 'rejected', 'completed'
    )),
    
    -- Personal Information (collected via mobile)
    legal_first_name VARCHAR(100),
    legal_last_name VARCHAR(100),
    date_of_birth DATE,
    nationality VARCHAR(100),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    
    -- Contact
    mobile_phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Travel Information
    arrival_flight VARCHAR(50),
    arrival_time TIME,
    departure_flight VARCHAR(50),
    departure_time TIME,
    purpose_of_visit VARCHAR(50), -- business, leisure, conference
    
    -- Vehicle (if applicable)
    has_vehicle BOOLEAN DEFAULT false,
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_color VARCHAR(30),
    vehicle_plate VARCHAR(20),
    
    -- Special Requests
    special_requests TEXT,
    accessibility_needs JSONB DEFAULT '[]',
    dietary_restrictions JSONB DEFAULT '[]',
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Review
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    rejection_reason TEXT,
    
    -- Token for secure access
    access_token VARCHAR(100) UNIQUE,
    token_expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(booking_id)
);

-- Document uploads for ID verification
CREATE TABLE IF NOT EXISTS guest_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    registration_id UUID REFERENCES pre_arrival_registrations(id) ON DELETE SET NULL,
    
    -- Document Type
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'passport', 'national_id', 'drivers_license', 'visa',
        'credit_card', 'registration_form', 'signature', 'other'
    )),
    
    -- Document Details
    document_number VARCHAR(100),
    issuing_country VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    
    -- File Storage
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_type VARCHAR(50), -- image/jpeg, application/pdf
    file_size INTEGER,
    thumbnail_url TEXT,
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    verification_method VARCHAR(50), -- manual, automated, ocr
    ocr_data JSONB, -- Extracted data from document
    
    -- Expiry Alert
    expiry_alert_sent BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Digital signatures
CREATE TABLE IF NOT EXISTS digital_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    registration_id UUID REFERENCES pre_arrival_registrations(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    
    -- Signature Type
    signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
        'registration_form', 'terms_conditions', 'credit_card_authorization',
        'liability_waiver', 'privacy_consent', 'group_contract', 'other'
    )),
    
    -- Signature Data
    signature_data TEXT NOT NULL, -- Base64 encoded signature image or SVG path
    signature_format VARCHAR(20) DEFAULT 'image/png', -- image/png, image/svg+xml
    
    -- Legal
    document_hash VARCHAR(64), -- SHA-256 of the document signed
    document_version VARCHAR(20),
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB,
    geolocation JSONB, -- {lat, lng, accuracy}
    
    -- Timestamps
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Verification
    is_valid BOOLEAN DEFAULT true,
    invalidated_at TIMESTAMPTZ,
    invalidation_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mobile key credentials
CREATE TABLE IF NOT EXISTS mobile_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id),
    
    -- Key Status
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'issued', 'active', 'suspended', 'revoked', 'expired'
    )),
    
    -- Key Provider
    provider VARCHAR(50) NOT NULL, -- assa_abloy, salto, dormakaba, openkey
    provider_key_id VARCHAR(255), -- ID from the lock provider
    provider_credential JSONB, -- Encrypted credential data
    
    -- Access Scope
    access_areas JSONB DEFAULT '[]', -- ['room', 'gym', 'pool', 'parking']
    room_access_starts TIMESTAMPTZ,
    room_access_ends TIMESTAMPTZ,
    
    -- Device Binding
    device_id VARCHAR(255),
    device_type VARCHAR(50), -- ios, android
    device_model VARCHAR(100),
    push_token TEXT,
    
    -- Usage Tracking
    first_used_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,
    
    -- Security
    pin_hash VARCHAR(255), -- Optional PIN for additional security
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    issued_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT,
    
    UNIQUE(booking_id, device_id)
);

-- Mobile key access logs
CREATE TABLE IF NOT EXISTS mobile_key_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile_key_id UUID NOT NULL REFERENCES mobile_keys(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Access Details
    access_point VARCHAR(100) NOT NULL, -- Room number, door name
    access_point_type VARCHAR(50), -- room_door, common_area, elevator, parking
    lock_id VARCHAR(255), -- Physical lock ID
    
    -- Result
    access_granted BOOLEAN NOT NULL,
    failure_reason TEXT,
    
    -- Context
    access_method VARCHAR(50) NOT NULL, -- mobile_key, pin, override
    device_id VARCHAR(255),
    device_battery_level INTEGER,
    signal_strength INTEGER,
    
    -- Location
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push notification registrations
CREATE TABLE IF NOT EXISTS push_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Device Info
    device_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    device_id VARCHAR(255),
    device_name VARCHAR(100),
    app_version VARCHAR(20),
    os_version VARCHAR(20),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ,
    
    -- Preferences
    enabled_notifications JSONB DEFAULT '["booking", "check_in", "messages", "offers"]',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(guest_id, device_token)
);

-- Push notifications sent
CREATE TABLE IF NOT EXISTS push_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    
    -- Notification Content
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    image_url TEXT,
    
    -- Type
    notification_type VARCHAR(50) NOT NULL, -- check_in_reminder, room_ready, key_issued, message, offer
    
    -- Deep Link
    action_type VARCHAR(50), -- open_app, open_url, open_screen
    action_data JSONB, -- {screen: 'check_in', params: {...}}
    
    -- Delivery
    sent_at TIMESTAMPTZ,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    
    -- Targeting (for bulk)
    target_type VARCHAR(30) DEFAULT 'individual', -- individual, segment, all
    segment_id UUID,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check-in/out sessions
CREATE TABLE IF NOT EXISTS checkin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    registration_id UUID REFERENCES pre_arrival_registrations(id),
    
    -- Session Type
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('check_in', 'check_out')),
    channel VARCHAR(30) NOT NULL, -- mobile_app, kiosk, front_desk, online
    
    -- Status
    status VARCHAR(30) DEFAULT 'started' CHECK (status IN (
        'started', 'documents_verified', 'payment_collected', 
        'key_issued', 'completed', 'abandoned', 'failed'
    )),
    
    -- Steps Completed
    steps_completed JSONB DEFAULT '[]',
    current_step VARCHAR(50),
    
    -- Room Assignment
    assigned_room_id UUID REFERENCES rooms(id),
    room_preferences JSONB,
    
    -- Payment
    payment_method_id VARCHAR(255), -- Stripe payment method
    authorization_amount DECIMAL(10, 2),
    authorization_id VARCHAR(255),
    
    -- Key Issuance
    key_type VARCHAR(30), -- mobile, physical, both
    mobile_key_id UUID REFERENCES mobile_keys(id),
    physical_key_number VARCHAR(50),
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    abandoned_at TIMESTAMPTZ,
    
    -- Agent (for assisted check-in)
    assisted_by UUID REFERENCES users(id),
    
    -- Device/Location
    device_type VARCHAR(50),
    device_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terms and conditions versions
CREATE TABLE IF NOT EXISTS terms_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Version Info
    version VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL,
    
    -- Content
    terms_type VARCHAR(50) NOT NULL, -- hotel_rules, privacy_policy, cancellation_policy, liability_waiver
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256
    
    -- Localization
    language VARCHAR(10) DEFAULT 'en',
    
    -- Status
    is_current BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, terms_type, version)
);

-- Guest terms acceptance
CREATE TABLE IF NOT EXISTS terms_acceptance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    terms_id UUID NOT NULL REFERENCES terms_versions(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    
    -- Acceptance Details
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB,
    
    -- Optional Signature
    signature_id UUID REFERENCES digital_signatures(id),
    
    UNIQUE(guest_id, terms_id, booking_id)
);

-- RLS Policies
ALTER TABLE pre_arrival_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_key_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_pre_arrival_booking ON pre_arrival_registrations(booking_id);
CREATE INDEX idx_pre_arrival_guest ON pre_arrival_registrations(guest_id);
CREATE INDEX idx_pre_arrival_status ON pre_arrival_registrations(status);
CREATE INDEX idx_pre_arrival_token ON pre_arrival_registrations(access_token);

CREATE INDEX idx_guest_documents_guest ON guest_documents(guest_id);
CREATE INDEX idx_guest_documents_registration ON guest_documents(registration_id);
CREATE INDEX idx_guest_documents_expiry ON guest_documents(expiry_date);

CREATE INDEX idx_digital_signatures_guest ON digital_signatures(guest_id);
CREATE INDEX idx_digital_signatures_booking ON digital_signatures(booking_id);

CREATE INDEX idx_mobile_keys_booking ON mobile_keys(booking_id);
CREATE INDEX idx_mobile_keys_guest ON mobile_keys(guest_id);
CREATE INDEX idx_mobile_keys_status ON mobile_keys(status);
CREATE INDEX idx_mobile_keys_provider ON mobile_keys(provider, provider_key_id);

CREATE INDEX idx_mobile_key_access_key ON mobile_key_access_log(mobile_key_id);
CREATE INDEX idx_mobile_key_access_time ON mobile_key_access_log(accessed_at);

CREATE INDEX idx_push_registrations_guest ON push_registrations(guest_id);
CREATE INDEX idx_push_registrations_token ON push_registrations(device_token);

CREATE INDEX idx_push_notifications_guest ON push_notifications(guest_id);
CREATE INDEX idx_push_notifications_type ON push_notifications(notification_type);

CREATE INDEX idx_checkin_sessions_booking ON checkin_sessions(booking_id);
CREATE INDEX idx_checkin_sessions_status ON checkin_sessions(status);

-- Function to generate secure access token
CREATE OR REPLACE FUNCTION generate_registration_token()
RETURNS VARCHAR(100) AS $$
DECLARE
    v_token VARCHAR(100);
BEGIN
    -- Generate a secure random token
    v_token := encode(gen_random_bytes(48), 'base64');
    -- Make URL safe
    v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- Function to validate mobile key access
CREATE OR REPLACE FUNCTION validate_mobile_key_access(
    p_mobile_key_id UUID,
    p_access_point VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_key RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_key FROM mobile_keys WHERE id = p_mobile_key_id;
    
    IF v_key IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check status
    IF v_key.status != 'active' THEN
        RETURN false;
    END IF;
    
    -- Check time window
    IF v_key.room_access_starts > v_now OR v_key.room_access_ends < v_now THEN
        RETURN false;
    END IF;
    
    -- Check if locked out
    IF v_key.locked_until IS NOT NULL AND v_key.locked_until > v_now THEN
        RETURN false;
    END IF;
    
    -- Update usage
    UPDATE mobile_keys
    SET last_used_at = v_now,
        use_count = use_count + 1,
        first_used_at = COALESCE(first_used_at, v_now)
    WHERE id = p_mobile_key_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create registration when booking is confirmed
CREATE OR REPLACE FUNCTION create_pre_arrival_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- Only for confirmed bookings with check-in within next 7 days
    IF NEW.status = 'confirmed' AND NEW.check_in <= CURRENT_DATE + 7 THEN
        INSERT INTO pre_arrival_registrations (
            property_id, booking_id, guest_id,
            access_token, token_expires_at
        )
        SELECT 
            NEW.property_id, NEW.id, NEW.guest_id,
            generate_registration_token(),
            NEW.check_in + INTERVAL '1 day'
        WHERE NOT EXISTS (
            SELECT 1 FROM pre_arrival_registrations WHERE booking_id = NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_pre_arrival_registration
    AFTER INSERT OR UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION create_pre_arrival_registration();
