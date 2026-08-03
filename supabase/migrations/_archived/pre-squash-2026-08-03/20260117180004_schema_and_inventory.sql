-- Migration: Schema and Inventory Function
-- Date: 2026-01-17
-- NOTE: coupon/gift-card/loyalty columns and order_gift_card_usage now tracked
-- via transactions.metadata. Legacy restaurant_orders references removed.

-- 1. order_gift_card_usage → no-op (usage tracked via transactions.metadata;
--    original FK referenced transactions which does not exist at this point in the migration sequence)

-- 2. (indexes skipped — table not created)

-- 3. Inventory Deduction Function (operates on order_items + inventory_items)
DROP FUNCTION IF EXISTS deduct_inventory_for_order(UUID);

CREATE OR REPLACE FUNCTION deduct_inventory_for_order(p_transaction_id UUID)
RETURNS TABLE(success BOOLEAN, items_deducted INTEGER, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_order_item RECORD;
    v_ingredient RECORD;
    v_deduction_count INTEGER := 0;
    v_total_needed DECIMAL;
BEGIN
    FOR v_order_item IN SELECT oi.catalog_item_id, oi.quantity FROM order_items oi WHERE oi.transaction_id = p_transaction_id
    LOOP
        FOR v_ingredient IN SELECT mii.inventory_item_id, mii.quantity_required, ii.name, ii.current_stock FROM menu_item_ingredients mii JOIN inventory_items ii ON ii.id = mii.inventory_item_id WHERE mii.catalog_item_id = v_order_item.catalog_item_id FOR UPDATE OF ii
        LOOP
            v_total_needed := v_ingredient.quantity_required * v_order_item.quantity;
            UPDATE inventory_items SET current_stock = current_stock - v_total_needed, updated_at = NOW() WHERE id = v_ingredient.inventory_item_id;
            INSERT INTO inventory_transactions(item_id, transaction_type, quantity, stock_before, stock_after, reference_type, reference_id, notes) VALUES (v_ingredient.inventory_item_id, 'sale', -v_total_needed, v_ingredient.current_stock, v_ingredient.current_stock - v_total_needed, 'transaction', p_transaction_id, 'Auto-deducted for order');
            v_deduction_count := v_deduction_count + 1;
        END LOOP;
    END LOOP;
    RETURN QUERY SELECT true, v_deduction_count, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_inventory_for_order TO service_role;

-- RLS: (order_gift_card_usage not created in this migration — skipped)
