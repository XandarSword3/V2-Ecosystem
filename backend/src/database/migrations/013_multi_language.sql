-- =============================================
-- Phase 4.4: Multi-Language Support (i18n)
-- Database Migration
-- =============================================

-- Supported Languages per Property
CREATE TABLE IF NOT EXISTS property_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  language_code VARCHAR(5) NOT NULL, -- en, es, fr, de, it, pt, zh, ja, ko, ar, ru
  language_name VARCHAR(50) NOT NULL, -- English, Español, Français
  native_name VARCHAR(50), -- English, Español, Français
  
  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  translation_progress INTEGER DEFAULT 0, -- Percentage complete
  
  -- Settings
  date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  time_format VARCHAR(10) DEFAULT '12h', -- 12h, 24h
  currency_format VARCHAR(20), -- $1,234.56 or 1.234,56€
  number_format VARCHAR(10), -- 1,234.56 or 1.234,56
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, language_code)
);

-- Translation Keys (master list)
CREATE TABLE IF NOT EXISTS translation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_path VARCHAR(255) NOT NULL UNIQUE, -- common.buttons.submit, booking.form.guest_name
  context VARCHAR(50), -- ui, email, sms, receipt, legal
  description TEXT,
  max_length INTEGER, -- Character limit for UI elements
  placeholders VARCHAR(50)[] DEFAULT '{}', -- {name}, {date}, etc.
  
  -- Categorization
  module VARCHAR(50), -- booking, housekeeping, pos, etc.
  component VARCHAR(100), -- BookingForm, ReceiptPrinter, etc.
  
  -- Source
  default_value TEXT NOT NULL, -- English default
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  needs_review BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Translations
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE, -- NULL = global
  language_code VARCHAR(5) NOT NULL,
  
  -- Translation
  value TEXT NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, auto
  is_custom BOOLEAN DEFAULT false, -- Property-specific override
  
  -- Review
  translated_by UUID, -- Staff or external translator
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  -- Quality
  quality_score DECIMAL(3,2), -- 0.00 - 1.00
  machine_translated BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(key_id, property_id, language_code)
);

-- Translation Bundles (cached JSON for frontend)
CREATE TABLE IF NOT EXISTS translation_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  language_code VARCHAR(5) NOT NULL,
  context VARCHAR(50) NOT NULL, -- ui, email, etc.
  
  -- Bundle content
  bundle JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL, -- SHA-256 for cache invalidation
  
  -- Stats
  key_count INTEGER DEFAULT 0,
  
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, language_code, context)
);

-- Content Translations (for dynamic content)
CREATE TABLE IF NOT EXISTS content_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to source content
  entity_type VARCHAR(50) NOT NULL, -- room_type, amenity, service, email_template
  entity_id UUID NOT NULL,
  field_name VARCHAR(50) NOT NULL, -- name, description, terms
  
  -- Translation
  language_code VARCHAR(5) NOT NULL,
  value TEXT NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, published
  
  -- Audit
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(entity_type, entity_id, field_name, language_code)
);

-- Translation Memory (for reuse)
CREATE TABLE IF NOT EXISTS translation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_language VARCHAR(5) NOT NULL,
  target_language VARCHAR(5) NOT NULL,
  
  -- Content
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  
  -- Context
  context VARCHAR(50),
  domain VARCHAR(50), -- hospitality, legal, etc.
  
  -- Quality
  usage_count INTEGER DEFAULT 1,
  quality_score DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guest Language Preferences
CREATE TABLE IF NOT EXISTS guest_language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  
  -- Preferences
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'en',
  secondary_language VARCHAR(5),
  
  -- Auto-detection
  detected_language VARCHAR(5),
  detection_source VARCHAR(30), -- browser, booking, explicit
  
  -- Communication
  email_language VARCHAR(5),
  sms_language VARCHAR(5),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(guest_id)
);

-- Localized Email Templates (extends email_templates)
CREATE TABLE IF NOT EXISTS email_template_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL, -- References email_templates
  language_code VARCHAR(5) NOT NULL,
  
  -- Content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, language_code)
);

-- Localized Receipt/Invoice Templates
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  template_type VARCHAR(30) NOT NULL, -- receipt, invoice, folio, contract
  language_code VARCHAR(5) NOT NULL,
  
  -- Content
  header_text TEXT,
  footer_text TEXT,
  terms_text TEXT,
  
  -- Labels
  labels JSONB NOT NULL, -- {"subtotal": "Subtotal", "tax": "Tax", "total": "Total"}
  
  -- Formatting
  date_format VARCHAR(20),
  number_format VARCHAR(20),
  currency_position VARCHAR(10), -- before, after
  
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, template_type, language_code)
);

-- Translation Audit Log
CREATE TABLE IF NOT EXISTS translation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID, -- Can be from translations or content_translations
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Change
  action VARCHAR(20) NOT NULL, -- created, updated, approved, rejected
  old_value TEXT,
  new_value TEXT,
  
  -- Actor
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_property_languages_property ON property_languages(property_id);
CREATE INDEX IF NOT EXISTS idx_translation_keys_module ON translation_keys(module);
CREATE INDEX IF NOT EXISTS idx_translation_keys_context ON translation_keys(context);
CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(key_id);
CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language_code);
CREATE INDEX IF NOT EXISTS idx_translations_property ON translations(property_id);
CREATE INDEX IF NOT EXISTS idx_content_translations_entity ON content_translations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_translation_memory_pair ON translation_memory(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_memory_source ON translation_memory USING gin(to_tsvector('english', source_text));
CREATE INDEX IF NOT EXISTS idx_guest_language_prefs_guest ON guest_language_preferences(guest_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Get translation with fallback
CREATE OR REPLACE FUNCTION get_translation(
  p_key_path VARCHAR,
  p_language_code VARCHAR,
  p_property_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_translation TEXT;
  v_key_id UUID;
BEGIN
  -- Get key ID
  SELECT id INTO v_key_id FROM translation_keys WHERE key_path = p_key_path AND is_active = true;
  IF v_key_id IS NULL THEN
    RETURN p_key_path; -- Return key if not found
  END IF;
  
  -- Try property-specific translation first
  IF p_property_id IS NOT NULL THEN
    SELECT value INTO v_translation 
    FROM translations 
    WHERE key_id = v_key_id 
      AND property_id = p_property_id 
      AND language_code = p_language_code
      AND status = 'approved';
    
    IF v_translation IS NOT NULL THEN
      RETURN v_translation;
    END IF;
  END IF;
  
  -- Try global translation
  SELECT value INTO v_translation 
  FROM translations 
  WHERE key_id = v_key_id 
    AND property_id IS NULL 
    AND language_code = p_language_code
    AND status = 'approved';
  
  IF v_translation IS NOT NULL THEN
    RETURN v_translation;
  END IF;
  
  -- Fall back to default (English)
  SELECT default_value INTO v_translation 
  FROM translation_keys 
  WHERE id = v_key_id;
  
  RETURN COALESCE(v_translation, p_key_path);
END;
$$ LANGUAGE plpgsql;

-- Get content translation with fallback
CREATE OR REPLACE FUNCTION get_content_translation(
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_field_name VARCHAR,
  p_language_code VARCHAR
)
RETURNS TEXT AS $$
DECLARE
  v_translation TEXT;
BEGIN
  -- Try requested language
  SELECT value INTO v_translation
  FROM content_translations
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND field_name = p_field_name
    AND language_code = p_language_code
    AND status = 'published';
  
  IF v_translation IS NOT NULL THEN
    RETURN v_translation;
  END IF;
  
  -- Fall back to English
  SELECT value INTO v_translation
  FROM content_translations
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND field_name = p_field_name
    AND language_code = 'en'
    AND status = 'published';
  
  RETURN v_translation;
END;
$$ LANGUAGE plpgsql;

-- Generate translation bundle
CREATE OR REPLACE FUNCTION generate_translation_bundle(
  p_property_id UUID,
  p_language_code VARCHAR,
  p_context VARCHAR DEFAULT 'ui'
)
RETURNS JSONB AS $$
DECLARE
  v_bundle JSONB := '{}';
  v_checksum VARCHAR(64);
  r RECORD;
BEGIN
  FOR r IN
    SELECT 
      tk.key_path,
      COALESCE(
        (SELECT value FROM translations WHERE key_id = tk.id AND property_id = p_property_id AND language_code = p_language_code AND status = 'approved'),
        (SELECT value FROM translations WHERE key_id = tk.id AND property_id IS NULL AND language_code = p_language_code AND status = 'approved'),
        tk.default_value
      ) as translation
    FROM translation_keys tk
    WHERE tk.context = p_context AND tk.is_active = true
  LOOP
    v_bundle := jsonb_set(
      v_bundle, 
      string_to_array(r.key_path, '.'),
      to_jsonb(r.translation),
      true
    );
  END LOOP;
  
  -- Calculate checksum
  v_checksum := encode(sha256(v_bundle::text::bytea), 'hex');
  
  -- Store bundle
  INSERT INTO translation_bundles (property_id, language_code, context, bundle, checksum, key_count)
  VALUES (p_property_id, p_language_code, p_context, v_bundle, v_checksum, (SELECT COUNT(*) FROM jsonb_object_keys(v_bundle)))
  ON CONFLICT (property_id, language_code, context) 
  DO UPDATE SET bundle = v_bundle, checksum = v_checksum, key_count = EXCLUDED.key_count, generated_at = NOW();
  
  RETURN v_bundle;
END;
$$ LANGUAGE plpgsql;

-- Calculate translation progress
CREATE OR REPLACE FUNCTION calculate_translation_progress(
  p_property_id UUID,
  p_language_code VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
  v_translated INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM translation_keys WHERE is_active = true;
  
  SELECT COUNT(DISTINCT tk.id) INTO v_translated
  FROM translation_keys tk
  JOIN translations t ON tk.id = t.key_id
  WHERE tk.is_active = true
    AND t.language_code = p_language_code
    AND (t.property_id = p_property_id OR t.property_id IS NULL)
    AND t.status = 'approved';
  
  IF v_total = 0 THEN RETURN 0; END IF;
  
  RETURN (v_translated * 100 / v_total);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DEFAULT DATA
-- =============================================

-- Insert common translation keys
INSERT INTO translation_keys (key_path, context, module, default_value, description) VALUES
-- Common
('common.buttons.submit', 'ui', 'common', 'Submit', 'Submit button text'),
('common.buttons.cancel', 'ui', 'common', 'Cancel', 'Cancel button text'),
('common.buttons.save', 'ui', 'common', 'Save', 'Save button text'),
('common.buttons.delete', 'ui', 'common', 'Delete', 'Delete button text'),
('common.buttons.edit', 'ui', 'common', 'Edit', 'Edit button text'),
('common.buttons.close', 'ui', 'common', 'Close', 'Close button text'),
('common.buttons.back', 'ui', 'common', 'Back', 'Back button text'),
('common.buttons.next', 'ui', 'common', 'Next', 'Next button text'),
('common.buttons.confirm', 'ui', 'common', 'Confirm', 'Confirm button text'),
('common.labels.search', 'ui', 'common', 'Search', 'Search label'),
('common.labels.filter', 'ui', 'common', 'Filter', 'Filter label'),
('common.labels.loading', 'ui', 'common', 'Loading...', 'Loading indicator'),
('common.labels.noResults', 'ui', 'common', 'No results found', 'Empty state message'),
('common.errors.required', 'ui', 'common', 'This field is required', 'Required field error'),
('common.errors.invalid', 'ui', 'common', 'Invalid value', 'Invalid value error'),

-- Booking
('booking.form.guestName', 'ui', 'booking', 'Guest Name', 'Guest name field label'),
('booking.form.email', 'ui', 'booking', 'Email', 'Email field label'),
('booking.form.phone', 'ui', 'booking', 'Phone', 'Phone field label'),
('booking.form.checkIn', 'ui', 'booking', 'Check-in Date', 'Check-in date label'),
('booking.form.checkOut', 'ui', 'booking', 'Check-out Date', 'Check-out date label'),
('booking.form.adults', 'ui', 'booking', 'Adults', 'Adults count label'),
('booking.form.children', 'ui', 'booking', 'Children', 'Children count label'),
('booking.form.roomType', 'ui', 'booking', 'Room Type', 'Room type label'),
('booking.form.specialRequests', 'ui', 'booking', 'Special Requests', 'Special requests label'),
('booking.status.confirmed', 'ui', 'booking', 'Confirmed', 'Booking confirmed status'),
('booking.status.pending', 'ui', 'booking', 'Pending', 'Booking pending status'),
('booking.status.cancelled', 'ui', 'booking', 'Cancelled', 'Booking cancelled status'),
('booking.status.checkedIn', 'ui', 'booking', 'Checked In', 'Checked in status'),
('booking.status.checkedOut', 'ui', 'booking', 'Checked Out', 'Checked out status'),

-- Front Desk
('frontDesk.checkin.title', 'ui', 'front_desk', 'Check In', 'Check-in page title'),
('frontDesk.checkout.title', 'ui', 'front_desk', 'Check Out', 'Check-out page title'),
('frontDesk.roomAssignment', 'ui', 'front_desk', 'Room Assignment', 'Room assignment label'),
('frontDesk.keyCard', 'ui', 'front_desk', 'Key Card', 'Key card label'),

-- Housekeeping
('housekeeping.status.clean', 'ui', 'housekeeping', 'Clean', 'Clean room status'),
('housekeeping.status.dirty', 'ui', 'housekeeping', 'Dirty', 'Dirty room status'),
('housekeeping.status.inspected', 'ui', 'housekeeping', 'Inspected', 'Inspected room status'),
('housekeeping.status.outOfOrder', 'ui', 'housekeeping', 'Out of Order', 'Out of order status'),

-- POS
('pos.receipt.subtotal', 'receipt', 'pos', 'Subtotal', 'Receipt subtotal label'),
('pos.receipt.tax', 'receipt', 'pos', 'Tax', 'Receipt tax label'),
('pos.receipt.total', 'receipt', 'pos', 'Total', 'Receipt total label'),
('pos.receipt.thankYou', 'receipt', 'pos', 'Thank you for your purchase!', 'Receipt thank you message'),

-- Email
('email.booking.subject', 'email', 'booking', 'Booking Confirmation - {{property_name}}', 'Booking confirmation email subject'),
('email.booking.greeting', 'email', 'booking', 'Dear {{guest_name}},', 'Email greeting'),
('email.booking.confirmed', 'email', 'booking', 'Your booking has been confirmed.', 'Booking confirmed message'),
('email.checkin.reminder', 'email', 'booking', 'Your check-in is tomorrow!', 'Check-in reminder')

ON CONFLICT (key_path) DO NOTHING;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE property_languages IS 'Languages enabled for each property';
COMMENT ON TABLE translation_keys IS 'Master list of all translatable strings';
COMMENT ON TABLE translations IS 'Translated values for each key/language';
COMMENT ON TABLE translation_bundles IS 'Pre-generated JSON bundles for frontend';
COMMENT ON TABLE content_translations IS 'Translations for dynamic content (room types, services)';
COMMENT ON TABLE translation_memory IS 'Reusable translation pairs for consistency';
COMMENT ON TABLE guest_language_preferences IS 'Per-guest language settings';
COMMENT ON TABLE document_templates IS 'Localized document templates (receipts, invoices)';
