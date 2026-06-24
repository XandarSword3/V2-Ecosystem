-- Migration: kitchen_orders.source_order_id links to transactions
-- Date: 2026-02-23

-- source_order_id references the transactions table (instant_transaction engine)
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES transactions(id);

CREATE INDEX IF NOT EXISTS idx_kitchen_orders_source_order_id ON kitchen_orders(source_order_id);
