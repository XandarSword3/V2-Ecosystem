-- Add entry_time and exit_time to pool_tickets
ALTER TABLE pool_tickets ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP;
ALTER TABLE pool_tickets ADD COLUMN IF NOT EXISTS exit_time TIMESTAMP;

-- Add 'active' to ticket_status enum
-- Note: In PG, you cannot run this inside a transaction with other commands 
-- but Supabase SQL editor handles multiple statements well.
DO $$ BEGIN
  ALTER TYPE ticket_status ADD VALUE 'active' AFTER 'valid';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
