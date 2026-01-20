-- Migration: Fix loyalty_tiers points_multiplier precision
-- Current DECIMAL(3,2) allows max 9.99, but admins may want multipliers like 10x or higher
-- Change to DECIMAL(5,2) to allow up to 999.99

-- Alter the column
ALTER TABLE loyalty_tiers 
ALTER COLUMN points_multiplier TYPE DECIMAL(5,2);

-- Add a comment for documentation
COMMENT ON COLUMN loyalty_tiers.points_multiplier IS 'Points multiplier for this tier (e.g., 1.5 = 150% points). Max value 999.99';
