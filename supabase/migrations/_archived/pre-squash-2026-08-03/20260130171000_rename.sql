-- Rename migration (Engine Refit edition)
-- Unit table renames already reflected in canonical DDL. This migration is a no-op.
-- accommodation_units, accommodation_add_ons, accommodation_price_rules all exist in current form.
BEGIN;

-- No-op: all unit table and column renames already applied in canonical DDL.

-- Extend enum if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_unit') THEN
    ALTER TYPE business_unit ADD VALUE IF NOT EXISTS 'accommodation';
  END IF;
END $$;

COMMIT;
