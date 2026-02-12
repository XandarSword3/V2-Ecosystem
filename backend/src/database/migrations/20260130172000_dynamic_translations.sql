-- File: backend/src/database/migrations/20260130172000_dynamic_translations.sql
-- UP Migration
BEGIN;

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(50) NOT NULL DEFAULT 'common', -- 'nav', 'home', 'restaurant', etc.
  key VARCHAR(200) NOT NULL,                        -- 'welcome_message', 'book_now', etc.
  language VARCHAR(5) NOT NULL,                     -- 'en', 'ar', 'fr'
  value TEXT NOT NULL,                              -- The translated string
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(namespace, key, language)
);

-- Index for fast lookup by namespace and language
CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(namespace, language);

-- Import some initial translations from en.json (Sample)
INSERT INTO translations (namespace, key, language, value) VALUES
('common', 'welcome', 'en', 'Welcome to {business_name}'),
('nav', 'home', 'en', 'Home'),
('nav', 'dining', 'en', '{dining_plural}'),
('nav', 'units', 'en', '{unit_plural}'),
('accommodation', 'title', 'en', 'Our {unit_plural}'),
('accommodation', 'book_now', 'en', 'Book Now')
ON CONFLICT (namespace, key, language) DO NOTHING;

COMMIT;

-- DOWN Migration
-- BEGIN;
-- DROP TABLE IF EXISTS translations;
-- COMMIT;
