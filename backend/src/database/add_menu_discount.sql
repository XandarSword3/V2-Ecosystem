-- Add discount_price to menu_items
-- Run this in Supabase SQL Editor

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS discount_price DECIMAL(10,2);
