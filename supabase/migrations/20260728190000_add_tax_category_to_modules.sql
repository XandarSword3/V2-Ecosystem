-- Add tax_category column to modules table for tax scoping
-- This allows each module to have a default tax category (e.g., 'accommodation', 'food_beverage', 'all')

ALTER TABLE modules 
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(50) DEFAULT 'all';

-- Add comment for documentation
COMMENT ON COLUMN modules.tax_category IS 'Default tax category for items in this module. Used for tax rate scoping.';
