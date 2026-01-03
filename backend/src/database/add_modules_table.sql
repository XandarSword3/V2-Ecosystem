-- Create modules table
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('menu_service', 'multi_day_booking', 'session_access')),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed default modules
INSERT INTO modules (template_type, name, slug, sort_order) VALUES
('menu_service', 'Restaurant', 'restaurant', 1),
('menu_service', 'Snack Bar', 'snack-bar', 2),
('multi_day_booking', 'Chalets', 'chalets', 3),
('session_access', 'Pool', 'pool', 4)
ON CONFLICT (slug) DO NOTHING;

-- Add module_id to existing tables
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
ALTER TABLE snack_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);
ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Update existing records
DO $$
DECLARE
  restaurant_id UUID;
  snack_bar_id UUID;
  chalets_id UUID;
  pool_id UUID;
BEGIN
  SELECT id INTO restaurant_id FROM modules WHERE slug = 'restaurant';
  SELECT id INTO snack_bar_id FROM modules WHERE slug = 'snack-bar';
  SELECT id INTO chalets_id FROM modules WHERE slug = 'chalets';
  SELECT id INTO pool_id FROM modules WHERE slug = 'pool';

  UPDATE menu_items SET module_id = restaurant_id WHERE module_id IS NULL;
  UPDATE menu_categories SET module_id = restaurant_id WHERE module_id IS NULL;
  UPDATE snack_items SET module_id = snack_bar_id WHERE module_id IS NULL;
  UPDATE chalets SET module_id = chalets_id WHERE module_id IS NULL;
  UPDATE pool_sessions SET module_id = pool_id WHERE module_id IS NULL;
END $$;
