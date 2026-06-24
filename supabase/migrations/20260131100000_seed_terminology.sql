-- File: supabase/migrations/20260131100000_seed_terminology.sql
BEGIN;

CREATE TABLE IF NOT EXISTS terminology_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_type VARCHAR(50) NOT NULL,
    term_key VARCHAR(100) NOT NULL,
    term_value VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_type, term_key, language)
);

-- Seed Hotel
INSERT INTO terminology_overrides (business_type, term_key, term_value) VALUES
('hotel', 'unit_singular', 'Room'),
('hotel', 'unit_plural', 'Rooms'),
('hotel', 'facility_singular', 'Gym'),
('hotel', 'facility_plural', 'Gyms'),
('hotel', 'dining_singular', 'Dining Venue'),
('hotel', 'dining_plural', 'Dining Venues')
ON CONFLICT (business_type, term_key, language) DO UPDATE SET term_value = EXCLUDED.term_value;

-- Seed Menu Service
INSERT INTO terminology_overrides (business_type, term_key, term_value) VALUES
('menu_service', 'unit_singular', 'Table'),
('menu_service', 'unit_plural', 'Tables'),
('menu_service', 'facility_singular', 'Counter'),
('menu_service', 'facility_plural', 'Counters'),
('menu_service', 'dining_singular', 'Dining Area'),
('menu_service', 'dining_plural', 'Dining Areas')
ON CONFLICT (business_type, term_key, language) DO UPDATE SET term_value = EXCLUDED.term_value;

COMMIT;
