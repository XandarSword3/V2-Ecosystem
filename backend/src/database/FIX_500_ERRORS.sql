
-- ============================================================================
-- FIX FOR 500 ERRORS IN DYNAMIC MODULES
-- ============================================================================
-- The 500 errors are caused by missing 'module_id' columns in the menu tables.
-- The dynamic modules try to filter by 'module_id', but the columns don't exist.
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard.
-- 2. Open the SQL Editor.
-- 3. Copy and paste the code below and run it.
-- ============================================================================

-- 1. Add module_id to menu_categories
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- 2. Add module_id to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- 3. Add module_id to chalets (if missing)
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- 4. Add module_id to pool_sessions (if missing)
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- 5. Add module_id to pool_tickets (if missing)
ALTER TABLE pool_tickets ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- 6. Link existing data to the correct modules
DO $$
DECLARE
  restaurant_id UUID;
  chalets_id UUID;
  pool_id UUID;
BEGIN
  -- Get Module IDs based on slugs
  SELECT id INTO restaurant_id FROM modules WHERE slug = 'restaurant';
  SELECT id INTO chalets_id FROM modules WHERE slug = 'chalets';
  SELECT id INTO pool_id FROM modules WHERE slug = 'pool';

  -- Update Menu Categories & Items
  IF restaurant_id IS NOT NULL THEN
    UPDATE menu_categories SET module_id = restaurant_id WHERE module_id IS NULL;
    UPDATE menu_items SET module_id = restaurant_id WHERE module_id IS NULL;
  END IF;

  -- Update Chalets
  IF chalets_id IS NOT NULL THEN
    UPDATE chalets SET module_id = chalets_id WHERE module_id IS NULL;
  END IF;

  -- Update Pool Sessions & Tickets
  IF pool_id IS NOT NULL THEN
    UPDATE pool_sessions SET module_id = pool_id WHERE module_id IS NULL;
    UPDATE pool_tickets SET module_id = pool_id WHERE module_id IS NULL;
  END IF;
END $$;
