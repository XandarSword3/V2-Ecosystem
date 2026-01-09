-- Add adult_price and child_price columns to pool_sessions if not exists
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS adult_price DECIMAL(10,2);
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS child_price DECIMAL(10,2);

-- Optionally migrate old price data if needed
UPDATE pool_sessions SET adult_price = price WHERE adult_price IS NULL;
UPDATE pool_sessions SET child_price = price WHERE child_price IS NULL;

-- Remove old price column if not needed anymore (optional, comment out if you want to keep it)
-- ALTER TABLE pool_sessions DROP COLUMN IF EXISTS price;
