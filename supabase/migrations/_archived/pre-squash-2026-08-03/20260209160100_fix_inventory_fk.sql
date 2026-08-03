-- Drop the foreign key constraint on created_by that references auth.users
-- The user UUID is in public.users, not auth.users
DO $$
BEGIN
  -- Find and drop the FK constraint on created_by
  EXECUTE (
    SELECT 'ALTER TABLE inventory_items DROP CONSTRAINT ' || conname
    FROM pg_constraint
    WHERE conrelid = 'inventory_items'::regclass
      AND contype = 'f'
      AND array_to_string(conkey, ',') = (
        SELECT attnum::text FROM pg_attribute 
        WHERE attrelid = 'inventory_items'::regclass 
        AND attname = 'created_by'
      )
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  -- Constraint might not exist, that's OK
  RAISE NOTICE 'No FK constraint found on created_by, skipping';
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
