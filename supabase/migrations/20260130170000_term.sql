-- File: backend/src/database/migrations/20260130170000_create_terminology_system.sql
-- UP Migration
BEGIN;

CREATE TABLE IF NOT EXISTS terminology_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type VARCHAR(50) NOT NULL, -- scope key for terminology grouping
  term_key VARCHAR(100) NOT NULL,     -- 'unit_singular', 'unit_plural', etc.
  term_value VARCHAR(200) NOT NULL,   -- Actual display text
  language VARCHAR(5) NOT NULL DEFAULT 'en',       -- 'en', 'ar', 'fr'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_type, term_key, language)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_terminology_lookup ON terminology_overrides(business_type, language);

-- Default seed data removed: legacy business-type terminology (resort/hotel/restaurant/villa)
-- does not exist in the engine-based white-label architecture.

COMMIT;

-- DOWN Migration
-- BEGIN;
-- DROP TABLE IF EXISTS terminology_overrides;
-- COMMIT;
