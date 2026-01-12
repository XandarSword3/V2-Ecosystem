-- FIX: Add all missing columns to menu_items table
-- RUN THIS IN SUPABASE SQL EDITOR IMMEDIATELY
-- Date: January 11, 2026

-- Add discount_price column
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS discount_price DECIMAL(10,2);

-- Add is_spicy column
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_spicy BOOLEAN DEFAULT false;

-- Add module_id column (for multi-module support)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

-- Update existing items to have the restaurant module_id if not set
DO $$
DECLARE
    restaurant_id UUID;
BEGIN
    SELECT id INTO restaurant_id FROM modules WHERE slug = 'restaurant' LIMIT 1;
    IF restaurant_id IS NOT NULL THEN
        UPDATE menu_items SET module_id = restaurant_id WHERE module_id IS NULL;
    END IF;
END $$;

-- Verify the columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'menu_items' 
AND column_name IN ('discount_price', 'is_spicy', 'module_id');
