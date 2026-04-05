-- Advanced Inventory Tables
-- Adds wastage tracking, physical count variance, purchase orders, suppliers, batches, and recipes

-- Suppliers
CREATE TABLE IF NOT EXISTS inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms TEXT,
  lead_time_days INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wastage tracking
CREATE TABLE IF NOT EXISTS inventory_wastage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_id UUID,
  quantity NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  photo_url TEXT,
  cost_impact NUMERIC DEFAULT 0,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  reported_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Physical count variance
CREATE TABLE IF NOT EXISTS inventory_variance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  count_date DATE NOT NULL,
  system_quantity NUMERIC NOT NULL,
  actual_quantity NUMERIC NOT NULL,
  variance_quantity NUMERIC NOT NULL,
  variance_percentage NUMERIC,
  variance_cost NUMERIC DEFAULT 0,
  reason TEXT,
  counted_by UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES inventory_suppliers(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'received', 'cancelled')),
  total_amount NUMERIC DEFAULT 0,
  expected_delivery TEXT,
  received_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS inventory_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity_ordered NUMERIC NOT NULL,
  quantity_received NUMERIC DEFAULT 0,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory Batches (FIFO tracking)
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_number TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  remaining_quantity NUMERIC NOT NULL,
  cost_per_unit NUMERIC,
  purchase_order_id UUID REFERENCES inventory_purchase_orders(id),
  expiry_date DATE,
  received_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipes / Bill of Materials
CREATE TABLE IF NOT EXISTS inventory_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID,
  name TEXT,
  yields INTEGER DEFAULT 1,
  prep_time_minutes INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Recipe Ingredients
CREATE TABLE IF NOT EXISTS inventory_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES inventory_recipes(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity NUMERIC NOT NULL,
  unit TEXT,
  is_optional BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FIFO stock deduction function
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_item_id UUID,
  p_quantity NUMERIC,
  p_reason TEXT DEFAULT 'sale',
  p_user_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_remaining NUMERIC := p_quantity;
  v_batch RECORD;
  v_deduct NUMERIC;
BEGIN
  -- If negative quantity (receiving stock), skip FIFO
  IF p_quantity <= 0 THEN
    RETURN;
  END IF;

  -- Iterate batches in FIFO order
  FOR v_batch IN
    SELECT id, remaining_quantity
    FROM inventory_batches
    WHERE item_id = p_item_id
      AND status = 'active'
      AND remaining_quantity > 0
    ORDER BY received_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_deduct := LEAST(v_batch.remaining_quantity, v_remaining);

    UPDATE inventory_batches
    SET remaining_quantity = remaining_quantity - v_deduct,
        status = CASE WHEN remaining_quantity - v_deduct <= 0 THEN 'depleted' ELSE 'active' END
    WHERE id = v_batch.id;

    v_remaining := v_remaining - v_deduct;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_wastage_item ON inventory_wastage(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variance_item ON inventory_variance(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_item ON inventory_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_recipes_menu_item ON inventory_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_recipe_ingredients_recipe ON inventory_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_inventory_po_items_po ON inventory_purchase_order_items(purchase_order_id);
