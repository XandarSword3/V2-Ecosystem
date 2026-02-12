-- Drop the problematic trigger that references non-existent 'date' column
DROP TRIGGER IF EXISTS sync_pool_date_trigger ON pool_tickets;
DROP FUNCTION IF EXISTS sync_pool_date() CASCADE;
