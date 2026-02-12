-- FIX: pool_tickets trigger error "record 'new' has no field 'date'"
-- Run this SQL in the Supabase Dashboard SQL Editor
-- Project: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn

-- Option 1: Add the missing 'date' column (recommended)
ALTER TABLE pool_tickets ADD COLUMN IF NOT EXISTS date TIMESTAMP;

-- Update the trigger function to not fail if column is missing
CREATE OR REPLACE FUNCTION sync_ticket_date_legacy()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set date if the column exists (handled by the ALTER above)
    NEW.date = NEW.ticket_date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS sync_pool_date_trigger ON pool_tickets;
CREATE TRIGGER sync_pool_date_trigger
BEFORE INSERT ON pool_tickets
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_date_legacy();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Alternative: Just drop the broken trigger entirely (if date column isn't needed)
-- DROP TRIGGER IF EXISTS sync_pool_date_trigger ON pool_tickets;
-- DROP FUNCTION IF EXISTS sync_ticket_date_legacy();
