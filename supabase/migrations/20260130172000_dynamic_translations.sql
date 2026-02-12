-- File: backend/src/database/migrations/20260130172000_dynamic_translations.sql
-- UP Migration
BEGIN;

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_key VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  namespace VARCHAR(100) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(translation_key, language)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(language, namespace);
CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(translation_key);

COMMIT;

-- DOWN Migration
-- BEGIN;
-- DROP TABLE IF EXISTS translations;
-- COMMIT;
