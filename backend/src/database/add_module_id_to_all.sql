
-- Add module_id to menu_categories
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Add module_id to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Add module_id to chalets
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Add module_id to pool_sessions
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Add module_id to pool_tickets
ALTER TABLE pool_tickets ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Update existing records to link to their respective modules
DO $$
DECLARE
  restaurant_id UUID;
  chalets_id UUID;
  pool_id UUID;
BEGIN
  -- Get Module IDs
  SELECT id INTO restaurant_id FROM modules WHERE slug = 'restaurant';
  SELECT id INTO chalets_id FROM modules WHERE slug = 'chalets';
  SELECT id INTO pool_id FROM modules WHERE slug = 'pool';

  -- Update Menu Categories
  IF restaurant_id IS NOT NULL THEN
    UPDATE menu_categories SET module_id = restaurant_id WHERE module_id IS NULL;
    UPDATE menu_items SET module_id = restaurant_id WHERE module_id IS NULL;
  END IF;

  -- Update Chalets
  IF chalets_id IS NOT NULL THEN
    UPDATE chalets SET module_id = chalets_id WHERE module_id IS NULL;
  END IF;

  -- Update Pool Sessions/Tickets
  IF pool_id IS NOT NULL THEN
    UPDATE pool_sessions SET module_id = pool_id WHERE module_id IS NULL;
    UPDATE pool_tickets SET module_id = pool_id WHERE module_id IS NULL;
  END IF;
END $$;
