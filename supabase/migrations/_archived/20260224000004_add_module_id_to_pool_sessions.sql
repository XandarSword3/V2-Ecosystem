DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pool_sessions' AND column_name = 'module_id'
  ) THEN
    ALTER TABLE pool_sessions ADD COLUMN module_id UUID;
  END IF;
END $$
