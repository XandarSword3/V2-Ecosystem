-- =============================================
-- Properties Table Creation
-- Base table for multi-property support
-- =============================================

-- Create the base properties table if it doesn't exist
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'US',
    postal_code VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    website TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    logo_url TEXT,
    cover_image_url TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on name for searching
CREATE INDEX IF NOT EXISTS idx_properties_name ON properties(name);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view active properties
CREATE POLICY "properties_select_policy" ON properties
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Admin-only insert, update, delete
CREATE POLICY "properties_admin_all" ON properties
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

-- Insert a default property if none exists
INSERT INTO properties (id, name, description, city, country, timezone, currency)
SELECT 
    '00000000-0000-0000-0000-000000000001'::UUID,
    'Default Property',
    'The default property for this installation',
    'Default City',
    'US',
    'UTC',
    'USD'
WHERE NOT EXISTS (SELECT 1 FROM properties LIMIT 1);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_properties_timestamp ON properties;
CREATE TRIGGER update_properties_timestamp
    BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_properties_updated_at();
