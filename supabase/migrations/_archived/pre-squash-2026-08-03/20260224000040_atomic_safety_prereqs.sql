-- Split from 20260224000000_atomic_safety_functions.sql
-- Shared prerequisites and verification notices

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'capacity_windows'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'capacity_windows' AND column_name = 'module_id'
  ) THEN
    ALTER TABLE capacity_windows ADD COLUMN module_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  -- legacy function notices removed (names updated in atomic_safety_functions migration)
END $$;