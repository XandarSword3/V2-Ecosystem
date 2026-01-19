-- Migration: Schema and Inventory Function
-- Date: 2026-01-17

-- 1. Ensure columns exist (Idempotent)
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS loyalty_points_used INTEGER DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS loyalty_discount DECIMAL(10,2) DEFAULT 0;

-- 2. Ensure table exists
CREATE TABLE IF NOT EXISTS order_gift_card_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
    gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE RESTRICT,
    amount_used DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_order_gift_card_usage_order ON order_gift_card_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_order_gift_card_usage_gift_card ON order_gift_card_usage(gift_card_id);

-- 4. Inventory Deduction Function
CREATE OR REPLACE FUNCTION deduct_inventory_for_order(p_order_id UUID)
RETURNS TABLE(success BOOLEAN, items_deducted INTEGER, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_order_item RECORD;
    v_ingredient RECORD;
    v_deduction_count INTEGER := 0;
    v_total_needed DECIMAL;
BEGIN
    FOR v_order_item IN SELECT oi.menu_item_id, oi.quantity FROM restaurant_order_items oi WHERE oi.order_id = p_order_id
    LOOP
        FOR v_ingredient IN SELECT mii.inventory_item_id, mii.quantity_required, ii.name, ii.current_stock FROM menu_item_ingredients mii JOIN inventory_items ii ON ii.id = mii.inventory_item_id WHERE mii.menu_item_id = v_order_item.menu_item_id FOR UPDATE OF ii
        LOOP
            v_total_needed := v_ingredient.quantity_required * v_order_item.quantity;
            UPDATE inventory_items SET current_stock = current_stock - v_total_needed, updated_at = NOW() WHERE id = v_ingredient.inventory_item_id;
            INSERT INTO inventory_transactions(item_id, transaction_type, quantity, stock_before, stock_after, reference_type, reference_id, notes) VALUES (v_ingredient.inventory_item_id, 'sale', -v_total_needed, v_ingredient.current_stock, v_ingredient.current_stock - v_total_needed, 'order', p_order_id, 'Auto-deducted for order');
            v_deduction_count := v_deduction_count + 1;
        END LOOP;
    END LOOP;
    RETURN QUERY SELECT true, v_deduction_count, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_inventory_for_order TO service_role;

-- RLS
ALTER TABLE order_gift_card_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage order_gift_card_usage" ON order_gift_card_usage;
CREATE POLICY "Staff can manage order_gift_card_usage" ON order_gift_card_usage FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'staff'))
);

DROP POLICY IF EXISTS "Users can view own order_gift_card_usage" ON order_gift_card_usage;
CREATE POLICY "Users can view own order_gift_card_usage" ON order_gift_card_usage FOR SELECT USING (
    EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
);
