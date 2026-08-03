-- Ensure modules has property scope for multi-property features.
BEGIN;

ALTER TABLE IF EXISTS modules
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Backfill to the default property when present.
UPDATE modules
SET property_id = COALESCE(property_id, '00000000-0000-0000-0000-000000000001'::uuid)
WHERE property_id IS NULL
  AND EXISTS (SELECT 1 FROM properties WHERE id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX IF NOT EXISTS idx_modules_property_id ON modules(property_id);

COMMIT;

