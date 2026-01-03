-- Create snack_categories table
CREATE TABLE IF NOT EXISTS snack_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  name_fr VARCHAR(100),
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add category_id to snack_items
ALTER TABLE snack_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES snack_categories(id);

-- Insert default categories
INSERT INTO snack_categories (name, display_order) VALUES 
('Sandwiches', 1),
('Drinks', 2),
('Snacks', 3),
('Ice Cream', 4)
ON CONFLICT DO NOTHING;

-- Migrate existing data (best effort)
UPDATE snack_items SET category_id = (SELECT id FROM snack_categories WHERE name = 'Sandwiches') WHERE category = 'sandwich';
UPDATE snack_items SET category_id = (SELECT id FROM snack_categories WHERE name = 'Drinks') WHERE category = 'drink';
UPDATE snack_items SET category_id = (SELECT id FROM snack_categories WHERE name = 'Snacks') WHERE category = 'snack';
UPDATE snack_items SET category_id = (SELECT id FROM snack_categories WHERE name = 'Ice Cream') WHERE category = 'ice_cream';
