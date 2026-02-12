-- Fix pool_sessions table to match backend controller expectations
-- Base schema has: capacity, price
-- Controller expects: max_capacity, adult_price, child_price, gender_restriction

-- Rename capacity to max_capacity if capacity exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pool_sessions' AND column_name = 'capacity'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pool_sessions' AND column_name = 'max_capacity'
  ) THEN
    ALTER TABLE pool_sessions RENAME COLUMN capacity TO max_capacity;
  END IF;
END $$;

-- Add max_capacity if it doesn't exist at all
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 50;

-- Add adult_price and child_price
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS adult_price DECIMAL(10,2);
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS child_price DECIMAL(10,2);

-- Add gender_restriction
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS gender_restriction VARCHAR(10) DEFAULT 'mixed';

-- Add timestamps if missing
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill adult_price and child_price from price where null
UPDATE pool_sessions SET adult_price = price WHERE adult_price IS NULL AND price IS NOT NULL;
UPDATE pool_sessions SET child_price = price WHERE child_price IS NULL AND price IS NOT NULL;
