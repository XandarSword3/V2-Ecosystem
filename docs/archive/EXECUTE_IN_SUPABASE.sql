-- Run this in Supabase SQL Editor to reload PostgREST schema cache
-- and add missing waitlist columns

-- Step 1: Add missing columns to waitlist_entries
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'restaurant';
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS quoted_wait_time INTEGER;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Step 2: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Step 3: Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'waitlist_entries';
