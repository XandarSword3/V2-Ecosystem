-- File: backend/src/database/migrations/20260130170000_create_terminology_system.sql
-- UP Migration
BEGIN;

CREATE TABLE IF NOT EXISTS terminology_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type VARCHAR(50) NOT NULL, -- 'resort', 'hotel', 'restaurant', etc.
  term_key VARCHAR(100) NOT NULL,     -- 'unit_singular', 'unit_plural', etc.
  term_value VARCHAR(200) NOT NULL,   -- Actual display text
  language VARCHAR(5) NOT NULL DEFAULT 'en',       -- 'en', 'ar', 'fr'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_type, term_key, language)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_terminology_lookup ON terminology_overrides(business_type, language);

-- Insert default terminology for different business types
INSERT INTO terminology_overrides (business_type, term_key, term_value, language) VALUES
-- Resort defaults (Current System)
('resort', 'unit_singular', 'Chalet', 'en'),
('resort', 'unit_plural', 'Chalets', 'en'),
('resort', 'facility_singular', 'Pool', 'en'),
('resort', 'facility_plural', 'Pools', 'en'),
('resort', 'dining_singular', 'Restaurant', 'en'),
('resort', 'dining_plural', 'Restaurants', 'en'),

-- Hotel defaults
('hotel', 'unit_singular', 'Room', 'en'),
('hotel', 'unit_plural', 'Rooms', 'en'),
('hotel', 'facility_singular', 'Gym', 'en'),
('hotel', 'facility_plural', 'Gyms', 'en'),
('hotel', 'dining_singular', 'Dining', 'en'),
('hotel', 'dining_plural', 'Dining', 'en'),

-- Restaurant defaults (No units)
('restaurant', 'unit_singular', 'Table', 'en'),
('restaurant', 'unit_plural', 'Tables', 'en'),
('restaurant', 'facility_singular', 'Bar', 'en'),
('restaurant', 'facility_plural', 'Bars', 'en'),
('restaurant', 'dining_singular', 'Dining Area', 'en'),
('restaurant', 'dining_plural', 'Dining Areas', 'en'),

-- Holiday Rental (Villa)
('villa', 'unit_singular', 'Villa', 'en'),
('villa', 'unit_plural', 'Villas', 'en'),
('villa', 'facility_singular', 'Private Pool', 'en'),
('villa', 'facility_plural', 'Private Pools', 'en'),
('villa', 'dining_singular', 'Kitchen', 'en'),
('villa', 'dining_plural', 'Kitchens', 'en')
ON CONFLICT (business_type, term_key, language) DO NOTHING;

COMMIT;

-- DOWN Migration
-- BEGIN;
-- DROP TABLE IF EXISTS terminology_overrides;
-- COMMIT;
