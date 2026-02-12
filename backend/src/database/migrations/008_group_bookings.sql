-- =============================================
-- MIGRATION: 008_group_bookings.sql
-- PHASE 3.3: Group Bookings System
-- Created: 2025-01-XX
-- =============================================

-- =============================================
-- GROUP RESERVATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS group_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Group Info
    group_name VARCHAR(300) NOT NULL,
    group_code VARCHAR(50) UNIQUE,
    group_type VARCHAR(50) NOT NULL CHECK (group_type IN (
        'corporate', 'tour', 'wedding', 'conference', 'sports_team',
        'family_reunion', 'social', 'government', 'airline_crew', 'other'
    )),
    
    -- Primary Contact
    contact_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(254),
    contact_phone VARCHAR(30),
    company_name VARCHAR(200),
    
    -- Dates
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    
    -- Room Block
    total_rooms_blocked INTEGER NOT NULL DEFAULT 0,
    rooms_picked_up INTEGER NOT NULL DEFAULT 0,
    
    -- Financial
    contracted_rate DECIMAL(10, 2), -- Negotiated group rate
    rate_type VARCHAR(50) DEFAULT 'per_night', -- per_night, flat, package
    deposit_amount DECIMAL(10, 2),
    deposit_paid DECIMAL(10, 2) DEFAULT 0,
    deposit_due_date DATE,
    
    total_estimated_value DECIMAL(15, 2),
    total_invoiced DECIMAL(15, 2) DEFAULT 0,
    total_paid DECIMAL(15, 2) DEFAULT 0,
    
    -- Payment Terms
    payment_terms TEXT,
    billing_address JSONB DEFAULT '{}',
    tax_exempt BOOLEAN DEFAULT false,
    tax_exempt_number VARCHAR(100),
    
    -- Cutoff
    cutoff_date DATE, -- Date when unbooked rooms release
    cutoff_days_before INTEGER DEFAULT 14,
    
    -- Services/Amenities
    included_services JSONB DEFAULT '[]', -- ['breakfast', 'parking', 'wifi']
    special_requests TEXT,
    
    -- Rooming List
    rooming_list_due_date DATE,
    rooming_list_received BOOLEAN DEFAULT false,
    
    -- Contract
    contract_id UUID,
    contract_signed BOOLEAN DEFAULT false,
    contract_signed_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'inquiry' CHECK (status IN (
        'inquiry', 'tentative', 'definite', 'contracted', 
        'in_house', 'completed', 'cancelled', 'lost'
    )),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    
    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(10, 2),
    
    -- Notes
    internal_notes TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GROUP ROOM BLOCKS
-- =============================================
CREATE TABLE IF NOT EXISTS group_room_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    
    -- Block Details
    date DATE NOT NULL,
    rooms_blocked INTEGER NOT NULL,
    rooms_picked_up INTEGER NOT NULL DEFAULT 0,
    rooms_available INTEGER GENERATED ALWAYS AS (rooms_blocked - rooms_picked_up) STORED,
    
    -- Rate
    rate DECIMAL(10, 2) NOT NULL,
    
    -- Release
    is_released BOOLEAN DEFAULT false,
    released_at TIMESTAMPTZ,
    released_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(group_id, room_type_id, date)
);

-- =============================================
-- GROUP BOOKINGS (Individual reservations within group)
-- =============================================
CREATE TABLE IF NOT EXISTS group_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Guest Info
    guest_name VARCHAR(200) NOT NULL,
    guest_email VARCHAR(254),
    guest_phone VARCHAR(30),
    
    -- Room Assignment
    room_type_id UUID REFERENCES room_types(id),
    room_id UUID REFERENCES rooms(id),
    
    -- Dates
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    
    -- Billing
    billing_method VARCHAR(30) DEFAULT 'group' CHECK (billing_method IN (
        'group', -- Master folio
        'individual', -- Guest pays
        'split' -- Split billing
    )),
    billing_notes TEXT,
    
    -- Status
    status VARCHAR(30) DEFAULT 'confirmed' CHECK (status IN (
        'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'
    )),
    
    -- Special Requests
    special_requests TEXT,
    amenity_requests JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(group_id, booking_id)
);

-- =============================================
-- GROUP CONTRACTS
-- =============================================
CREATE TABLE IF NOT EXISTS group_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Contract Details
    contract_number VARCHAR(50) UNIQUE,
    contract_type VARCHAR(50) DEFAULT 'standard',
    
    -- Terms
    terms_and_conditions TEXT,
    cancellation_policy TEXT,
    attrition_policy TEXT, -- Allowed percentage reduction
    attrition_percentage DECIMAL(5, 2) DEFAULT 20.00,
    
    -- Dates
    valid_from DATE,
    valid_until DATE,
    
    -- Signatures
    hotel_signatory VARCHAR(200),
    hotel_signed_at TIMESTAMPTZ,
    client_signatory VARCHAR(200),
    client_signed_at TIMESTAMPTZ,
    
    -- Document
    document_url TEXT,
    document_type VARCHAR(20) DEFAULT 'pdf',
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'signed', 'expired', 'cancelled'
    )),
    
    sent_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GROUP EVENTS/FUNCTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Event Details
    name VARCHAR(200) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'meeting', 'banquet', 'reception', 'cocktail', 'breakfast',
        'lunch', 'dinner', 'conference', 'workshop', 'other'
    )),
    
    -- Timing
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    setup_time TIME,
    teardown_time TIME,
    
    -- Venue
    venue_id UUID, -- Reference to meeting rooms/venues table
    venue_name VARCHAR(200),
    room_setup VARCHAR(50), -- theater, classroom, banquet, u-shape, etc.
    
    -- Attendance
    expected_attendance INTEGER,
    guaranteed_attendance INTEGER,
    actual_attendance INTEGER,
    
    -- Pricing
    room_rental DECIMAL(10, 2),
    per_person_rate DECIMAL(10, 2),
    minimum_spend DECIMAL(10, 2),
    
    -- Services
    catering_details JSONB DEFAULT '{}',
    av_requirements JSONB DEFAULT '[]',
    setup_requirements TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'tentative' CHECK (status IN (
        'tentative', 'confirmed', 'in_progress', 'completed', 'cancelled'
    )),
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GROUP INVOICES
-- =============================================
CREATE TABLE IF NOT EXISTS group_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Invoice Details
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    
    -- Type
    invoice_type VARCHAR(30) DEFAULT 'standard' CHECK (invoice_type IN (
        'deposit', 'interim', 'standard', 'final', 'credit_note'
    )),
    
    -- Line Items (stored as JSONB for flexibility)
    line_items JSONB NOT NULL DEFAULT '[]',
    -- [{description, quantity, unit_price, total, tax_rate, tax_amount}]
    
    -- Totals
    subtotal DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL,
    
    -- Payment
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    balance_due DECIMAL(15, 2) GENERATED ALWAYS AS (total - amount_paid) STORED,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled', 'void'
    )),
    
    -- Sending
    sent_at TIMESTAMPTZ,
    sent_to TEXT,
    
    -- Notes
    notes TEXT,
    internal_notes TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GROUP PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS group_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES group_invoices(id) ON DELETE SET NULL,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Payment Details
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15, 2) NOT NULL,
    
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN (
        'credit_card', 'bank_transfer', 'check', 'cash', 'wire', 'ach', 'other'
    )),
    
    -- Reference
    reference_number VARCHAR(100),
    transaction_id VARCHAR(200),
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'pending', 'completed', 'failed', 'refunded', 'partial_refund'
    )),
    
    -- Refund Info (if applicable)
    refund_amount DECIMAL(15, 2),
    refund_date DATE,
    refund_reason TEXT,
    
    notes TEXT,
    
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GROUP ACTIVITY LOG
-- =============================================
CREATE TABLE IF NOT EXISTS group_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES group_reservations(id) ON DELETE CASCADE,
    
    -- Activity
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'created', 'status_change', 'block_added', 'block_modified',
        'booking_added', 'booking_cancelled', 'contract_sent', 'contract_signed',
        'invoice_created', 'payment_received', 'rooming_list', 'note_added',
        'assigned', 'cutoff_reminder', 'other'
    )),
    
    description TEXT NOT NULL,
    
    -- Changes (for status changes)
    old_value JSONB,
    new_value JSONB,
    
    -- Attribution
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(200),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_group_reservations_property ON group_reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_group_reservations_status ON group_reservations(status);
CREATE INDEX IF NOT EXISTS idx_group_reservations_dates ON group_reservations(arrival_date, departure_date);
CREATE INDEX IF NOT EXISTS idx_group_reservations_cutoff ON group_reservations(cutoff_date) WHERE status NOT IN ('cancelled', 'completed', 'lost');
CREATE INDEX IF NOT EXISTS idx_group_room_blocks_group ON group_room_blocks(group_id);
CREATE INDEX IF NOT EXISTS idx_group_room_blocks_date ON group_room_blocks(date);
CREATE INDEX IF NOT EXISTS idx_group_bookings_group ON group_bookings(group_id);
CREATE INDEX IF NOT EXISTS idx_group_bookings_booking ON group_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_group_contracts_group ON group_contracts(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_group ON group_events(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_date ON group_events(event_date);
CREATE INDEX IF NOT EXISTS idx_group_invoices_group ON group_invoices(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invoices_status ON group_invoices(status);
CREATE INDEX IF NOT EXISTS idx_group_payments_group ON group_payments(group_id);
CREATE INDEX IF NOT EXISTS idx_group_activity_log_group ON group_activity_log(group_id);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE group_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_reservations_access ON group_reservations
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY group_room_blocks_access ON group_room_blocks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM group_reservations gr 
            WHERE gr.id = group_id 
            AND user_has_property_access(auth.uid(), gr.property_id)
        )
    );

CREATE POLICY group_bookings_access ON group_bookings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM group_reservations gr 
            WHERE gr.id = group_id 
            AND user_has_property_access(auth.uid(), gr.property_id)
        )
    );

CREATE POLICY group_contracts_access ON group_contracts
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY group_events_access ON group_events
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY group_invoices_access ON group_invoices
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY group_payments_access ON group_payments
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY group_activity_log_access ON group_activity_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM group_reservations gr 
            WHERE gr.id = group_id 
            AND user_has_property_access(auth.uid(), gr.property_id)
        )
    );

-- =============================================
-- FUNCTIONS
-- =============================================

-- Generate group code
CREATE OR REPLACE FUNCTION generate_group_code(p_group_name VARCHAR, p_arrival_date DATE)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_date_part VARCHAR(8);
    v_random VARCHAR(4);
BEGIN
    -- First 3 chars of group name (uppercase, no spaces)
    v_prefix := UPPER(LEFT(REGEXP_REPLACE(p_group_name, '[^a-zA-Z]', '', 'g'), 3));
    IF LENGTH(v_prefix) < 3 THEN
        v_prefix := v_prefix || REPEAT('X', 3 - LENGTH(v_prefix));
    END IF;
    
    -- Date in MMDDYY format
    v_date_part := TO_CHAR(p_arrival_date, 'MMDDYY');
    
    -- Random 4-char alphanumeric
    v_random := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    
    RETURN v_prefix || v_date_part || v_random;
END;
$$ LANGUAGE plpgsql;

-- Update group pickup counts
CREATE OR REPLACE FUNCTION update_group_pickup_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update block pickup count
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE group_room_blocks
        SET rooms_picked_up = (
            SELECT COUNT(*) FROM group_bookings gb
            JOIN bookings b ON gb.booking_id = b.id
            WHERE gb.group_id = NEW.group_id
            AND gb.room_type_id = group_room_blocks.room_type_id
            AND b.check_in <= group_room_blocks.date
            AND b.check_out > group_room_blocks.date
            AND gb.status NOT IN ('cancelled', 'no_show')
        ),
        updated_at = NOW()
        WHERE group_id = NEW.group_id;
        
        -- Update total group pickup
        UPDATE group_reservations
        SET rooms_picked_up = (
            SELECT COALESCE(SUM(rooms_picked_up), 0) 
            FROM group_room_blocks 
            WHERE group_id = NEW.group_id
        ),
        updated_at = NOW()
        WHERE id = NEW.group_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE group_room_blocks
        SET rooms_picked_up = rooms_picked_up - 1,
            updated_at = NOW()
        WHERE group_id = OLD.group_id
        AND room_type_id = OLD.room_type_id;
        
        UPDATE group_reservations
        SET rooms_picked_up = rooms_picked_up - 1,
            updated_at = NOW()
        WHERE id = OLD.group_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_group_pickup
    AFTER INSERT OR UPDATE OR DELETE ON group_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_group_pickup_counts();

-- Auto-release blocks after cutoff
CREATE OR REPLACE FUNCTION release_cutoff_blocks()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE group_room_blocks grb
    SET is_released = true,
        released_at = NOW(),
        released_reason = 'Automatic release after cutoff date'
    FROM group_reservations gr
    WHERE grb.group_id = gr.id
    AND gr.cutoff_date < CURRENT_DATE
    AND grb.is_released = false
    AND grb.rooms_available > 0
    AND gr.status IN ('tentative', 'definite', 'contracted');
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_property_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get next sequence for this property/year
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM group_invoices
    WHERE property_id = p_property_id
    AND invoice_number LIKE 'INV-' || v_year || '-%';
    
    RETURN 'INV-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
