-- First, create a function to list all triggers on pool_tickets
CREATE OR REPLACE FUNCTION list_pool_triggers()
RETURNS TABLE (
  trigger_name text,
  function_name text,
  trigger_timing text,
  trigger_event text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tgname::text as trigger_name,
    p.proname::text as function_name,
    CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END::text as trigger_timing,
    CASE 
      WHEN t.tgtype & 4 = 4 THEN 'INSERT'
      WHEN t.tgtype & 8 = 8 THEN 'DELETE'  
      WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
      ELSE 'MULTIPLE'
    END::text as trigger_event
  FROM pg_trigger t
  JOIN pg_proc p ON t.tgfoid = p.oid
  WHERE t.tgrelid = 'pool_tickets'::regclass
    AND NOT t.tgisinternal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now get the list
SELECT * FROM list_pool_triggers();

-- Drop ALL triggers on pool_tickets table that could be causing issues
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN 
    SELECT t.tgname 
    FROM pg_trigger t
    WHERE t.tgrelid = 'pool_tickets'::regclass
      AND NOT t.tgisinternal
  LOOP
    RAISE NOTICE 'Dropping trigger: %', trigger_rec.tgname;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON pool_tickets', trigger_rec.tgname);
  END LOOP;
END $$;

-- Also drop any functions that might be related
DROP FUNCTION IF EXISTS sync_pool_date() CASCADE;
DROP FUNCTION IF EXISTS sync_date() CASCADE;
DROP FUNCTION IF EXISTS pool_date_sync() CASCADE;
DROP FUNCTION IF EXISTS update_pool_date() CASCADE;
