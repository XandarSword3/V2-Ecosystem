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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'translations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'translations' AND column_name = 'translation_key'
    ) THEN
      ALTER TABLE translations ADD COLUMN translation_key VARCHAR(255);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'translations' AND column_name = 'language'
    ) THEN
      ALTER TABLE translations ADD COLUMN language VARCHAR(10);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'translations' AND column_name = 'key'
    ) THEN
      EXECUTE 'UPDATE translations SET translation_key = COALESCE(translation_key, "key") WHERE translation_key IS NULL';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'translations' AND column_name = 'locale'
    ) THEN
      EXECUTE 'UPDATE translations SET language = COALESCE(language, locale) WHERE language IS NULL';
    END IF;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(language, namespace);
CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(translation_key);

-- Create translation_keys table for i18n key management
CREATE TABLE IF NOT EXISTS translation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_path TEXT NOT NULL UNIQUE,
  context TEXT NOT NULL,
  default_value TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_translation_keys_key_path ON translation_keys(key_path);
CREATE INDEX IF NOT EXISTS idx_translation_keys_context ON translation_keys(context);
CREATE INDEX IF NOT EXISTS idx_translation_keys_is_active ON translation_keys(is_active);

COMMIT;

-- DOWN Migration
-- BEGIN;
-- DROP TABLE IF EXISTS translations;
-- COMMIT;
