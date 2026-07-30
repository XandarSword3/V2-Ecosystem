-- Update coupons.applies_to CHECK constraint to match new engine types
-- After the engine refact, the old template_type values are deprecated
-- This updates the constraint to use the canonical engine type names

-- Drop the old constraint
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_applies_to_check;

-- Add the updated constraint with new engine type values
ALTER TABLE coupons 
ADD CONSTRAINT coupons_applies_to_check 
CHECK (applies_to IN ('all', 'instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement', 'platform_entitlement', 'specific_items'));

-- Backfill existing coupons with old values to new engine types
UPDATE coupons SET applies_to = 'instant_transaction' WHERE applies_to = 'menu_service';
UPDATE coupons SET applies_to = 'time_exclusive_reservation' WHERE applies_to = 'accommodation';
UPDATE coupons SET applies_to = 'shared_capacity_access' WHERE applies_to = 'shared_capacity';
UPDATE coupons SET applies_to = 'instant_transaction' WHERE applies_to = 'kiosk';
