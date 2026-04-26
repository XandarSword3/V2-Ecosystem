-- Fix waitlist_entries to match controller schema
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'restaurant';
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS quoted_wait_time INTEGER;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Rename customer_name to match if needed (controller uses customer_name already, so this should be fine)
-- The standalone_repair.sql already has customer_name. 

-- Ensure RLS policy exists
DROP POLICY IF EXISTS "gap_rem_waitlist_all" ON waitlist_entries;
CREATE POLICY "gap_rem_waitlist_all" ON waitlist_entries FOR ALL USING (true);
