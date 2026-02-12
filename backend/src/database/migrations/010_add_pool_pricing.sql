
-- Fixes for pool_sessions
ALTER TABLE pool_sessions
ADD COLUMN IF NOT EXISTS adult_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS child_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS gender_restriction VARCHAR(20) DEFAULT 'mixed',
ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 20;

-- Fixes for pool_tickets
ALTER TABLE pool_tickets
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES pool_sessions(id),
ADD COLUMN IF NOT EXISTS ticket_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS number_of_guests INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'valid',
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
ADD COLUMN IF NOT EXISTS qr_code TEXT,
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id),
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS exit_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Legacy trigger compat: 'date' column required
ALTER TABLE pool_tickets ADD COLUMN IF NOT EXISTS date TIMESTAMP;

-- Try to handle the user_id column if it exists and causes issues
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pool_tickets' AND column_name = 'user_id') THEN
        ALTER TABLE pool_tickets ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END $$;

-- Sync ticket_date to date for legacy triggers
CREATE OR REPLACE FUNCTION sync_ticket_date_legacy()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date = NEW.ticket_date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_pool_date_trigger ON pool_tickets;
CREATE TRIGGER sync_pool_date_trigger
BEFORE INSERT ON pool_tickets
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_date_legacy();

-- Force schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
