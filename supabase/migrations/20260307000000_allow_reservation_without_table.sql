-- Allow creating reservations without a pre-assigned table
-- Table can be assigned later via the admin "Assign Table" workflow
-- Guard: table_reservations is a legacy restaurant-module table; skip if absent
DO $guard$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'table_reservations'
  ) THEN
    ALTER TABLE table_reservations ALTER COLUMN table_id DROP NOT NULL;
  END IF;
END $guard$;
