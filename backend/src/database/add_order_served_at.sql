-- Add served_at to restaurant_orders
-- Run this in Supabase SQL Editor

ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;
