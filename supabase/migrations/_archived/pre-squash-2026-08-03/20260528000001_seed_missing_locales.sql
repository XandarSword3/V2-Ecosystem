-- Migration: Seed missing locales into supported_languages
-- Adds 'de' (German) and 'it' (Italian) which are defined in code but absent from DB.
-- Uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe.

-- Ensure table exists (created in an earlier applied migration; guard for fresh replay)
CREATE TABLE IF NOT EXISTS supported_languages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(10) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    native_name VARCHAR(100),
    direction   VARCHAR(3)  NOT NULL DEFAULT 'ltr',
    is_default  BOOLEAN     NOT NULL DEFAULT false,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO supported_languages (code, name, native_name, direction, is_default, is_active, sort_order)
VALUES
  ('de', 'German',  'Deutsch',   'ltr', false, true, 4),
  ('it', 'Italian', 'Italiano',  'ltr', false, true, 5)
ON CONFLICT (code) DO NOTHING;
