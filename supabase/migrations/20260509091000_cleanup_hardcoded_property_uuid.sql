BEGIN;

-- 1. Remove hardcoded UUID fallback from modules
UPDATE modules
SET property_id = (SELECT id FROM properties ORDER BY created_at ASC LIMIT 1)
WHERE property_id = '00000000-0000-0000-0000-000000000001'::UUID;

-- Note: The following updates will work via the views created in the establish_unified_engine_tables migration
-- We use DO blocks to handle cases where views might not be ready yet or tables are already renamed

-- 2. Remove hardcoded UUID fallback from restaurant_orders (view/table)
DO $$ BEGIN
  UPDATE restaurant_orders
  SET property_id = (SELECT id FROM properties ORDER BY created_at ASC LIMIT 1)
  WHERE property_id = '00000000-0000-0000-0000-000000000001'::UUID;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Remove hardcoded UUID fallback from chalet_bookings (view/table)
DO $$ BEGIN
  UPDATE chalet_bookings
  SET property_id = (SELECT id FROM properties ORDER BY created_at ASC LIMIT 1)
  WHERE property_id = '00000000-0000-0000-0000-000000000001'::UUID;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Remove hardcoded UUID fallback from pool_tickets (view/table)
DO $$ BEGIN
  UPDATE pool_tickets
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
