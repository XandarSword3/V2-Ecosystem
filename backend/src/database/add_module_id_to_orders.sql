
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Update existing orders to link to 'restaurant' module
DO $$
DECLARE
  restaurant_id UUID;
BEGIN
  SELECT id INTO restaurant_id FROM modules WHERE slug = 'restaurant';
  UPDATE restaurant_orders SET module_id = restaurant_id WHERE module_id IS NULL;
END $$;
