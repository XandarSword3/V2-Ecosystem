-- Inventory Recipes (Bill of Materials) System Migration

-- Recipes table - links menu items to inventory ingredients
CREATE TABLE IF NOT EXISTS inventory_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255),
  yields INTEGER DEFAULT 1, -- How many portions this recipe makes
  prep_time_minutes INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(menu_item_id)
);

-- Recipe ingredients - each ingredient required for a recipe
CREATE TABLE IF NOT EXISTS inventory_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES inventory_recipes(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 3) NOT NULL, -- Amount needed
  unit VARCHAR(50), -- Unit of measure for this recipe (can differ from inventory unit)
  is_optional BOOLEAN DEFAULT false, -- Optional ingredients don't cause unavailability
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON inventory_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON inventory_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON inventory_recipe_ingredients(inventory_item_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS inventory_recipes_updated_at ON inventory_recipes;
CREATE TRIGGER inventory_recipes_updated_at
  BEFORE UPDATE ON inventory_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- Add cost tracking columns to inventory_items if not exists
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10, 2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS last_purchase_price DECIMAL(10, 2);

-- Add wastage table if not exists
CREATE TABLE IF NOT EXISTS inventory_wastage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES inventory_batches(id),
  quantity DECIMAL(10, 3) NOT NULL,
  reason VARCHAR(50) NOT NULL, -- expired, spoiled, damaged, preparation_error, theft, other
  notes TEXT,
  photo_url TEXT,
  cost_impact DECIMAL(10, 2),
  reported_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approval_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add variance tracking table if not exists
CREATE TABLE IF NOT EXISTS inventory_variance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  count_date DATE NOT NULL,
  system_quantity DECIMAL(10, 3) NOT NULL,
  actual_quantity DECIMAL(10, 3) NOT NULL,
  variance_quantity DECIMAL(10, 3) NOT NULL,
  variance_percentage DECIMAL(5, 2),
  variance_cost DECIMAL(10, 2),
  reason TEXT,
  counted_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add suppliers table if not exists
CREATE TABLE IF NOT EXISTS inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  payment_terms VARCHAR(100),
  lead_time_days INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add purchase orders table if not exists  
CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES inventory_suppliers(id),
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, received, cancelled
  expected_delivery DATE,
  received_date DATE,
  total_amount DECIMAL(10, 2),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add purchase order items
CREATE TABLE IF NOT EXISTS inventory_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity DECIMAL(10, 3) NOT NULL,
  unit_cost DECIMAL(10, 2),
  quantity_received DECIMAL(10, 3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add batches table for FIFO tracking
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  batch_number VARCHAR(100),
  quantity DECIMAL(10, 3) NOT NULL,
  remaining_quantity DECIMAL(10, 3) NOT NULL,
  cost_per_unit DECIMAL(10, 2),
  purchase_order_id UUID REFERENCES inventory_purchase_orders(id),
  expiry_date DATE,
  received_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active', -- active, depleted, expired
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_wastage_item ON inventory_wastage(item_id);
CREATE INDEX IF NOT EXISTS idx_wastage_status ON inventory_wastage(approval_status);
CREATE INDEX IF NOT EXISTS idx_variance_item ON inventory_variance(item_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON inventory_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON inventory_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_batches_item ON inventory_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON inventory_batches(expiry_date);

-- Function to deduct stock using FIFO
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_item_id UUID,
  p_quantity DECIMAL,
  p_reason VARCHAR,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_remaining DECIMAL := p_quantity;
  v_batch RECORD;
BEGIN
  -- Only deduct if positive quantity (negative means adding stock)
  IF p_quantity <= 0 THEN
    RETURN;
  END IF;

  -- Loop through batches in FIFO order
  FOR v_batch IN 
    SELECT * FROM inventory_batches 
    WHERE item_id = p_item_id 
    AND status = 'active' 
    AND remaining_quantity > 0
    ORDER BY received_date ASC, created_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    IF v_batch.remaining_quantity >= v_remaining THEN
      -- This batch covers the remaining amount
      UPDATE inventory_batches 
      SET remaining_quantity = remaining_quantity - v_remaining,
          status = CASE WHEN remaining_quantity - v_remaining <= 0 THEN 'depleted' ELSE status END
      WHERE id = v_batch.id;
      v_remaining := 0;
    ELSE
      -- Use up this entire batch
      v_remaining := v_remaining - v_batch.remaining_quantity;
      UPDATE inventory_batches 
      SET remaining_quantity = 0, status = 'depleted'
      WHERE id = v_batch.id;
    END IF;
  END LOOP;

  -- Update main inventory item stock
  UPDATE inventory_items 
  SET current_stock = GREATEST(0, current_stock - p_quantity)
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_wastage ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_variance ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY inventory_recipes_read ON inventory_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_ingredients_read ON inventory_recipe_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_wastage_read ON inventory_wastage FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_variance_read ON inventory_variance FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_suppliers_read ON inventory_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_po_read ON inventory_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_batches_read ON inventory_batches FOR SELECT TO authenticated USING (true);

-- Allow staff/admin to modify
CREATE POLICY inventory_recipes_modify ON inventory_recipes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND roles && ARRAY['admin', 'staff']));
CREATE POLICY inventory_ingredients_modify ON inventory_recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND roles && ARRAY['admin', 'staff']));
CREATE POLICY inventory_wastage_modify ON inventory_wastage FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND roles && ARRAY['admin', 'staff']));
CREATE POLICY inventory_variance_modify ON inventory_variance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND roles && ARRAY['admin', 'staff']));
CREATE POLICY inventory_suppliers_modify ON inventory_suppliers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND roles && ARRAY['admin', 'staff']));
CREATE POLICY inventory_po_modify ON inventory_purchase_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND roles && ARRAY['admin', 'staff']));
CREATE POLICY inventory_batches_modify ON inventory_batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND roles && ARRAY['admin', 'staff']));
