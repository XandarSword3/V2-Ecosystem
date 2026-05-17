-- Property Settings Inheritance System
-- Enables cascading settings resolution: property override → group default → system default

-- 1. Create property_settings table for per-property overrides
CREATE TABLE IF NOT EXISTS property_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_property_setting UNIQUE (property_id, setting_key)
);

-- 2. Create group_settings table for group-wide defaults
CREATE TABLE IF NOT EXISTS group_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES property_groups(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_group_setting UNIQUE (group_id, setting_key)
);

-- 3. Create system_defaults table for global fallbacks
CREATE TABLE IF NOT EXISTS system_defaults (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_property_settings_property ON property_settings(property_id);
CREATE INDEX IF NOT EXISTS idx_property_settings_key ON property_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_property_settings_category ON property_settings(category);
CREATE INDEX IF NOT EXISTS idx_group_settings_group ON group_settings(group_id);
CREATE INDEX IF NOT EXISTS idx_group_settings_key ON group_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_defaults_key ON system_defaults(setting_key);

-- 5. RLS
ALTER TABLE property_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_settings_read ON property_settings FOR SELECT USING (true);
CREATE POLICY property_settings_write ON property_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM user_property_access WHERE user_id = auth.uid() AND property_id = property_settings.property_id AND access_level IN ('admin', 'manage'))
);

CREATE POLICY group_settings_read ON group_settings FOR SELECT USING (true);
CREATE POLICY group_settings_write ON group_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM user_group_access WHERE user_id = auth.uid() AND group_id = group_settings.group_id AND access_level IN ('admin', 'manage'))
);

CREATE POLICY system_defaults_read ON system_defaults FOR SELECT USING (true);
CREATE POLICY system_defaults_write ON system_defaults FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'super_admin')
);

-- 6. Resolution function: property → group → system
CREATE OR REPLACE FUNCTION resolve_setting(
    p_property_id UUID,
    p_setting_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    result JSONB;
    v_group_id UUID;
BEGIN
    -- Level 1: Property override
    SELECT setting_value INTO result
    FROM property_settings
    WHERE property_id = p_property_id AND setting_key = p_setting_key;
    
    IF result IS NOT NULL THEN RETURN result; END IF;

    -- Level 2: Group default
    SELECT pg.group_id INTO v_group_id
    FROM property_group_members pg
    WHERE pg.property_id = p_property_id
    LIMIT 1;

    IF v_group_id IS NOT NULL THEN
        SELECT setting_value INTO result
        FROM group_settings
        WHERE group_id = v_group_id AND setting_key = p_setting_key;
        
        IF result IS NOT NULL THEN RETURN result; END IF;
    END IF;

    -- Level 3: System default
    SELECT setting_value INTO result
    FROM system_defaults
    WHERE setting_key = p_setting_key;

    RETURN result; -- NULL if no default exists
END;
$$;

-- 7. Seed some system defaults
INSERT INTO system_defaults (setting_key, setting_value, category, description) VALUES
    ('currency', '"USD"', 'general', 'Default currency'),
    ('timezone', '"UTC"', 'general', 'Default timezone'),
    ('tax_rate', '0', 'finance', 'Default tax rate percentage'),
    ('cancellation_policy_hours', '24', 'booking', 'Hours before check-in for free cancellation'),
    ('max_guests_per_booking', '10', 'booking', 'Maximum guests per booking'),
    ('auto_confirm_bookings', 'false', 'booking', 'Whether to auto-confirm bookings'),
    ('require_payment_upfront', 'true', 'finance', 'Require payment at booking time'),
    ('loyalty_enabled', 'true', 'loyalty', 'Whether loyalty program is active'),
    ('review_moderation', 'true', 'content', 'Whether reviews require admin approval')
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE property_settings IS 'Per-property setting overrides (highest priority)';
COMMENT ON TABLE group_settings IS 'Group-wide setting defaults (medium priority)';
COMMENT ON TABLE system_defaults IS 'System-wide setting fallbacks (lowest priority)';
COMMENT ON FUNCTION resolve_setting IS 'Cascading settings resolution: property → group → system';
