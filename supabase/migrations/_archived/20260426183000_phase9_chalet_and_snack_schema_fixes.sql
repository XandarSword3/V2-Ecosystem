-- Phase 9: Remaining schema alignment for chalet and snack data structures.
-- Safe/idempotent migration that introduces normalized tables expected by tooling.

BEGIN;

CREATE TABLE IF NOT EXISTS chalet_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chalet_id UUID NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
  amenity_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chalet_amenities_unique
  ON chalet_amenities (chalet_id, amenity_name);

CREATE TABLE IF NOT EXISTS chalet_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chalet_id UUID NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chalet_images_unique
  ON chalet_images (chalet_id, image_url);

-- NOTE: avoid naming collision with the existing enum type `snack_category`.
CREATE TABLE IF NOT EXISTS snack_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill normalized chalet amenities from JSON array field if present.
INSERT INTO chalet_amenities (chalet_id, amenity_name)
SELECT c.id, amenity.value::text
FROM chalets c
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.amenities::jsonb, '[]'::jsonb)) AS amenity(value)
ON CONFLICT (chalet_id, amenity_name) DO NOTHING;

-- Backfill normalized chalet images from JSON array field if present.
INSERT INTO chalet_images (chalet_id, image_url, sort_order)
SELECT c.id, img.value::text, img.ordinality - 1
FROM chalets c
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.images::jsonb, '[]'::jsonb)) WITH ORDINALITY AS img(value, ordinality)
ON CONFLICT (chalet_id, image_url) DO NOTHING;

-- Seed snack_categories from existing snack item category values.
INSERT INTO snack_categories (name)
SELECT DISTINCT TRIM(category)
FROM snack_items
WHERE category IS NOT NULL AND TRIM(category) <> ''
ON CONFLICT (name) DO NOTHING;

COMMIT;
