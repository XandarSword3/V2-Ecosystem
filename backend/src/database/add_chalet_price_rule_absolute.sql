-- Add price column to chalet_price_rules
-- This allows for absolute price overrides in addition to multipliers

ALTER TABLE chalet_price_rules ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);

-- Update existing rules if any (logic depends on business preference, but typically price_multiplier was used)
-- We'll keep price_multiplier as well for flexibility.
