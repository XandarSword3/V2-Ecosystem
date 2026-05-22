-- Fix for Bug 3: Pool booking error "record 'new' has no field 'date'"
-- The trigger references NEW.date but the table uses ticket_date

-- Drop ALL problematic triggers on pool_tickets
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

-- Drop legacy functions that reference wrong column names
DROP FUNCTION IF EXISTS sync_pool_date() CASCADE;
DROP FUNCTION IF EXISTS sync_date() CASCADE;
DROP FUNCTION IF EXISTS pool_date_sync() CASCADE;
DROP FUNCTION IF EXISTS update_pool_date() CASCADE;
DROP FUNCTION IF EXISTS update_pool_capacity() CASCADE;
DROP FUNCTION IF EXISTS sync_ticket_date_legacy() CASCADE;

-- Create a CORRECT capacity tracking function using ticket_date (the actual column)
CREATE OR REPLACE FUNCTION update_pool_capacity_v2()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pool_daily_capacity (date, current_count)
        VALUES (NEW.ticket_date::date, 1)
        ON CONFLICT (date) DO UPDATE SET current_count = pool_daily_capacity.current_count + 1;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE pool_daily_capacity 
        SET current_count = GREATEST(current_count - 1, 0)
        WHERE date = OLD.ticket_date::date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if pool_daily_capacity table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pool_daily_capacity') THEN
        DROP TRIGGER IF EXISTS pool_capacity_trigger ON pool_tickets;
        CREATE TRIGGER pool_capacity_trigger
        AFTER INSERT OR DELETE ON pool_tickets
        FOR EACH ROW EXECUTE FUNCTION update_pool_capacity_v2();
    END IF;
END $$;

-- Verify the fix
DO $$
BEGIN
    RAISE NOTICE 'Pool trigger fix applied successfully!';
END $$;
