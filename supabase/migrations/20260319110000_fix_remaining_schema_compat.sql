-- Fill remaining schema compatibility gaps used by current controllers.
BEGIN;

-- Ensure snack_orders exists with modern fields used by backend controllers.
CREATE TABLE IF NOT EXISTS snack_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT,
  module_id UUID REFERENCES modules(id),
  customer_id UUID REFERENCES users(id),
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending',
  total_amount NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  estimated_ready_time TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS snack_orders
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS estimated_ready_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE snack_orders
SET subtotal = COALESCE(subtotal, total_amount, 0)
WHERE subtotal IS NULL;

UPDATE snack_orders
SET tax_amount = COALESCE(tax_amount, 0)
WHERE tax_amount IS NULL;

UPDATE snack_orders
SET payment_status = COALESCE(payment_status, 'pending')
WHERE payment_status IS NULL;

UPDATE snack_orders
SET status = COALESCE(status, 'pending')
WHERE status IS NULL;

-- Ensure snack_order_items exists and supports fields used by controllers.
CREATE TABLE IF NOT EXISTS snack_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES snack_orders(id) ON DELETE CASCADE,
  snack_item_id UUID REFERENCES snack_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS snack_order_items
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES snack_orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS snack_item_id UUID REFERENCES snack_items(id),
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE snack_order_items
SET quantity = COALESCE(quantity, 1)
WHERE quantity IS NULL;

UPDATE snack_order_items
SET unit_price = COALESCE(unit_price, 0)
WHERE unit_price IS NULL;

UPDATE snack_order_items
SET subtotal = COALESCE(subtotal, unit_price * quantity, 0)
WHERE subtotal IS NULL;

-- Ensure chalet price rule columns exist for pricing logic.
ALTER TABLE IF EXISTS chalet_price_rules
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS weekend_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS holiday_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS per_guest_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS min_guests INTEGER,
  ADD COLUMN IF NOT EXISTS max_guests INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chalet_price_rules'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'chalet_price_rules' AND column_name = 'price'
    ) THEN
      UPDATE chalet_price_rules
      SET base_price = COALESCE(base_price, price)
      WHERE base_price IS NULL;
    END IF;

    UPDATE chalet_price_rules
    SET weekend_price = COALESCE(weekend_price, base_price, 0)
    WHERE weekend_price IS NULL;

    UPDATE chalet_price_rules
    SET min_guests = COALESCE(min_guests, 1)
    WHERE min_guests IS NULL;

    UPDATE chalet_price_rules
    SET max_guests = COALESCE(max_guests, 10)
    WHERE max_guests IS NULL;
  END IF;
END $$;

-- Multi-property create flow may send room count.
ALTER TABLE IF EXISTS properties
  ADD COLUMN IF NOT EXISTS total_rooms INTEGER;

CREATE INDEX IF NOT EXISTS idx_snack_orders_customer_id ON snack_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_snack_orders_created_at ON snack_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_snack_order_items_order_id ON snack_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_snack_order_items_item_id ON snack_order_items(snack_item_id);

COMMIT;
