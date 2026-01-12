-- Add supported languages table for language management
-- This table stores all available languages for the system

CREATE TABLE IF NOT EXISTS supported_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    direction VARCHAR(3) NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_supported_languages_code ON supported_languages(code);
CREATE INDEX IF NOT EXISTS idx_supported_languages_active ON supported_languages(is_active);

-- Insert default languages (English, Arabic, French)
INSERT INTO supported_languages (code, name, native_name, direction, is_default, is_active, sort_order)
VALUES 
    ('en', 'English', 'English', 'ltr', true, true, 1),
    ('ar', 'Arabic', 'العربية', 'rtl', false, true, 2),
    ('fr', 'French', 'Français', 'ltr', false, true, 3)
ON CONFLICT (code) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supported_languages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_supported_languages_updated_at ON supported_languages;
CREATE TRIGGER trigger_update_supported_languages_updated_at
    BEFORE UPDATE ON supported_languages
    FOR EACH ROW
    EXECUTE FUNCTION update_supported_languages_updated_at();

-- Ensure only one default language
CREATE OR REPLACE FUNCTION ensure_single_default_language()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE supported_languages SET is_default = false WHERE code != NEW.code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_language ON supported_languages;
CREATE TRIGGER trigger_ensure_single_default_language
    AFTER INSERT OR UPDATE OF is_default ON supported_languages
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_language();
