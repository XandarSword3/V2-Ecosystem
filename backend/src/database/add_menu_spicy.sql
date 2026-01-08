-- Add is_spicy to menu_items
-- Run this in Supabase SQL Editor

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_spicy BOOLEAN DEFAULT false;
