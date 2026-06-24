BEGIN;

-- 1. Remove hardcoded UUID fallback from modules
UPDATE modules
SET property_id = (SELECT id FROM properties ORDER BY created_at ASC LIMIT 1)
WHERE property_id = '00000000-0000-0000-0000-000000000001'::UUID;

-- 2. Remove hardcoded UUID fallback from transactions (unified table)
-- restaurant_orders, chalet_bookings, pool_tickets no longer exist.
DO $$ BEGIN
  UPDATE transactions
  SET property_id = (SELECT id FROM properties ORDER BY created_at ASC LIMIT 1)
  WHERE property_id = '00000000-0000-0000-0000-000000000001'::UUID;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5. Update user_property_access to link authenticated users to a property
-- (Only for users who don't already have access)
INSERT INTO user_property_access (user_id, property_id, access_level, is_primary)
SELECT u.id, p.id, 'admin', true
FROM users u
CROSS JOIN (SELECT id FROM properties ORDER BY created_at ASC LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM user_property_access upa 
  WHERE upa.user_id = u.id
)
ON CONFLICT (user_id, property_id) DO NOTHING;

COMMIT;
