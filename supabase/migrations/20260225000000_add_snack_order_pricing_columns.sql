-- Migration: Add subtotal and tax_amount columns to snack_orders
-- These columns were referenced by the engine-powered pricing in snack.controller.ts
-- but were never added to the table schema, causing:
--   "Could not find the 'subtotal' column of 'snack_orders' in the schema cache"

CREATE TABLE IF NOT EXISTS snack_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID,
  total_amount DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2),
  tax_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE snack_orders
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;

-- Backfill existing rows: set subtotal = total_amount and tax_amount = 0
UPDATE snack_orders
SET subtotal = total_amount,
    tax_amount = 0
WHERE subtotal IS NULL;
