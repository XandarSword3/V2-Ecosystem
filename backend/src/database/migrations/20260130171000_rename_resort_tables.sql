-- File: backend/src/database/migrations/20260130171000_rename_resort_tables.sql
-- UP Migration
BEGIN;

-- 1. Rename Tables
ALTER TABLE IF EXISTS chalets RENAME TO accommodation_units;
ALTER TABLE IF EXISTS chalet_bookings RENAME TO accommodation_bookings;
ALTER TABLE IF EXISTS chalet_add_ons RENAME TO accommodation_add_ons;
ALTER TABLE IF EXISTS chalet_price_rules RENAME TO accommodation_price_rules;
ALTER TABLE IF EXISTS chalet_booking_add_ons RENAME TO accommodation_booking_add_ons;

-- Keep legacy chalet table available for downstream migrations and legacy modules.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accommodation_units'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chalets'
  ) THEN
    CREATE TABLE chalets (LIKE accommodation_units INCLUDING ALL);
    INSERT INTO chalets SELECT * FROM accommodation_units;
  END IF;
END $$;

-- 2. Rename Columns
-- accommodation_bookings
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name = 'accommodation_bookings' AND column_name = 'chalet_id') THEN
    ALTER TABLE accommodation_bookings RENAME COLUMN chalet_id TO unit_id;
  END IF;
END $$;

-- accommodation_price_rules
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name = 'accommodation_price_rules' AND column_name = 'chalet_id') THEN
    ALTER TABLE accommodation_price_rules RENAME COLUMN chalet_id TO unit_id;
  END IF;
END $$;

-- accommodation_booking_add_ons
-- No specific chalet_id column here usually, but check just in case

-- 3. Update Foreign Key Constraints (This is tricky as names are auto-generated usually)
-- We attempt to rename them for clarity, but Postgres handles the link automatically after table rename.
-- We might want to rename constraints to be clean.

-- 4. Update Enums if they exist and are mutable (Postgres Enums are hard to change)
-- If 'business_unit' enum exists, adding 'accommodation' might be needed if replacing 'chalets'
ALTER TYPE business_unit ADD VALUE IF NOT EXISTS 'accommodation';
-- Note: We can't easily remove 'chalets' from enum without recreating it.

-- 5. Rename Index (Optional but good practice)
-- ALTER INDEX idx_chalet_bookings_chalet_id RENAME TO idx_accommodation_bookings_unit_id;

COMMIT;

-- DOWN Migration
-- BEGIN;
-- ALTER TABLE accommodation_booking_add_ons RENAME TO chalet_booking_add_ons;
-- ALTER TABLE accommodation_price_rules RENAME COLUMN unit_id TO chalet_id;
-- ALTER TABLE accommodation_price_rules RENAME TO chalet_price_rules;
-- ALTER TABLE accommodation_add_ons RENAME TO chalet_add_ons;
-- ALTER TABLE accommodation_bookings RENAME COLUMN unit_id TO chalet_id;
-- ALTER TABLE accommodation_bookings RENAME TO chalet_bookings;
-- ALTER TABLE accommodation_units RENAME TO chalets;
-- COMMIT;
