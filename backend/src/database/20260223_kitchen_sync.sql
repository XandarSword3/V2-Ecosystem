-- Migration: Add source_order_id to kitchen_orders for restaurant→kitchen sync
-- Date: 2026-02-23

-- Add column to link kitchen orders back to their source restaurant order
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES restaurant_orders(id);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_kitchen_orders_source_order_id ON kitchen_orders(source_order_id);
