-- Create terminology_overrides table for dynamic business terminology
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS terminology_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_type VARCHAR(50) NOT NULL DEFAULT 'resort',
    term_key VARCHAR(100) NOT NULL,
    term_value VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_type, term_key, language)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_terminology_lookup 
    ON terminology_overrides(business_type, language);

-- Enable RLS
ALTER TABLE terminology_overrides ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to terminology" ON terminology_overrides;
DROP POLICY IF EXISTS "Allow admin write access to terminology" ON terminology_overrides;

-- Allow all users to read terminology
CREATE POLICY "Allow public read access to terminology" 
    ON terminology_overrides FOR SELECT USING (true);

-- Allow authenticated admins to modify
CREATE POLICY "Allow admin write access to terminology" 
    ON terminology_overrides FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Insert some default terminology for reference
INSERT INTO terminology_overrides (business_type, term_key, term_value, language) VALUES
    ('resort', 'unit_singular', 'Chalet', 'en'),
    ('resort', 'unit_plural', 'Chalets', 'en'),
    ('resort', 'facility_singular', 'Pool', 'en'),
    ('resort', 'facility_plural', 'Pools', 'en'),
    ('resort', 'dining_singular', 'Restaurant', 'en'),
    ('resort', 'dining_plural', 'Restaurants', 'en'),
    ('hotel', 'unit_singular', 'Room', 'en'),
    ('hotel', 'unit_plural', 'Rooms', 'en'),
    ('hotel', 'facility_singular', 'Spa', 'en'),
    ('hotel', 'facility_plural', 'Amenities', 'en'),
    ('gym', 'unit_singular', 'Training Session', 'en'),
    ('gym', 'unit_plural', 'Training Sessions', 'en'),
    ('gym', 'facility_singular', 'Class', 'en'),
    ('gym', 'facility_plural', 'Classes', 'en')
ON CONFLICT (business_type, term_key, language) DO NOTHING;
