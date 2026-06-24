-- Reload PostgREST schema cache after column changes
NOTIFY pgrst, 'reload schema';

-- Also ensure the capacity column doesn't cause confusion
-- If both capacity and max_capacity exist, drop the old capacity column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pool_sessions' AND column_name = 'capacity'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pool_sessions' AND column_name = 'max_capacity'
  ) THEN
    -- Copy data from capacity to max_capacity where max_capacity is null
    UPDATE pool_sessions SET max_capacity = capacity WHERE max_capacity IS NULL OR max_capacity = 0;
    -- Drop old column
    ALTER TABLE pool_sessions DROP COLUMN capacity;
  END IF;
END $$;

-- Reload again after drop
NOTIFY pgrst, 'reload schema';
