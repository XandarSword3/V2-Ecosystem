-- Fix coupons.applies_to constraint - the previous migration failed because
-- the original constraint was inline (auto-generated name), not named
-- This drops the column and re-adds it with the correct constraint

-- Drop the applies_to column (this will drop the inline constraint)
ALTER TABLE coupons DROP COLUMN IF EXISTS applies_to;

-- Re-add the column with the updated CHECK constraint
ALTER TABLE coupons ADD COLUMN applies_to VARCHAR(50) DEFAULT 'all' 
CHECK (applies_to IN ('all', 'instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement', 'platform_entitlement', 'specific_items'));

-- Set default value for existing rows
UPDATE coupons SET applies_to = 'all' WHERE applies_to IS NULL;
