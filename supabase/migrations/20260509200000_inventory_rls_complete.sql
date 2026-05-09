-- =============================================
-- INVENTORY RLS COMPLETION
-- Adds property_id columns and RLS policies to 
-- all inventory tables for multi-property isolation
-- =============================================

-- 1. Add property_id to standalone tables
ALTER TABLE inventory_suppliers ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);
ALTER TABLE inventory_purchase_orders ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);
ALTER TABLE inventory_recipes ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);

-- 2. Backfill with first property (deterministic fallback)
DO $$
DECLARE
    default_prop_id UUID;
BEGIN
    SELECT id INTO default_prop_id FROM properties ORDER BY created_at ASC LIMIT 1;
    
    UPDATE inventory_suppliers SET property_id = default_prop_id WHERE property_id IS NULL;
    UPDATE inventory_purchase_orders SET property_id = default_prop_id WHERE property_id IS NULL;
    UPDATE inventory_recipes SET property_id = default_prop_id WHERE property_id IS NULL;
END $$;

-- 3. Enable RLS on all tables
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_wastage ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_variance ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_recipes ENABLE ROW LEVEL SECURITY;

-- 4. Create helper function for property access check
CREATE OR REPLACE FUNCTION user_has_property_access(user_uuid UUID, prop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_property_access 
    WHERE user_id = user_uuid AND property_id = prop_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create join-based policies (tables linked to inventory_items)
CREATE POLICY inventory_transactions_isolation ON inventory_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE inventory_items.id = inventory_transactions.item_id
      AND user_has_property_access(auth.uid(), inventory_items.property_id)
    )
  );

CREATE POLICY inventory_alerts_isolation ON inventory_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE inventory_items.id = inventory_alerts.item_id
      AND user_has_property_access(auth.uid(), inventory_items.property_id)
    )
  );

CREATE POLICY inventory_wastage_isolation ON inventory_wastage
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE inventory_items.id = inventory_wastage.item_id
      AND user_has_property_access(auth.uid(), inventory_items.property_id)
    )
  );

CREATE POLICY inventory_variance_isolation ON inventory_variance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE inventory_items.id = inventory_variance.item_id
      AND user_has_property_access(auth.uid(), inventory_items.property_id)
    )
  );

CREATE POLICY inventory_batches_isolation ON inventory_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE inventory_items.id = inventory_batches.item_id
      AND user_has_property_access(auth.uid(), inventory_items.property_id)
    )
  );

-- 6. Create direct policies (tables with their own property_id)
CREATE POLICY inventory_suppliers_isolation ON inventory_suppliers
  FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY inventory_purchase_orders_isolation ON inventory_purchase_orders
  FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY inventory_recipes_isolation ON inventory_recipes
  FOR ALL USING (user_has_property_access(auth.uid(), property_id));

-- 7. Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_wastage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_variance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_recipes TO authenticated;

-- Note: Sequence grants are handled automatically by Supabase for identity columns

-- =============================================
-- Migration complete
-- =============================================
