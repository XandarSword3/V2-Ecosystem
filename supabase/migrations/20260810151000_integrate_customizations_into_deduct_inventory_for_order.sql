-- Integrate customizations into deduct_inventory_for_order RPC with stock check fix
-- Phase 1.5 of customization inventory integration plan

-- Modify deduct_inventory_for_order to:
-- 1. Add stock-sufficiency check (pre-existing bug fix)
-- 2. Process customizations from order_customizations table
CREATE OR REPLACE FUNCTION "public"."deduct_inventory_for_order"("p_transaction_id" "uuid") RETURNS TABLE("success" boolean, "items_deducted" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order_item RECORD;
    v_ingredient RECORD;
    v_deduction_count INTEGER := 0;
    v_total_needed DECIMAL;
    v_customization RECORD;
    v_customization_deduction_count INTEGER := 0;
BEGIN
    -- Process base recipe ingredients
    FOR v_order_item IN SELECT oi.catalog_item_id, oi.quantity FROM order_items oi WHERE oi.transaction_id = p_transaction_id
    LOOP
        FOR v_ingredient IN SELECT mii.inventory_item_id, mii.quantity_required, ii.name, ii.current_stock FROM menu_item_ingredients mii JOIN inventory_items ii ON ii.id = mii.inventory_item_id WHERE mii.catalog_item_id = v_order_item.catalog_item_id FOR UPDATE OF ii
        LOOP
            v_total_needed := v_ingredient.quantity_required * v_order_item.quantity;
            
            -- Stock-sufficiency check (pre-existing bug fix)
            IF v_ingredient.current_stock < v_total_needed THEN
                RETURN QUERY SELECT false, 0::INTEGER, 'Insufficient stock for item: ' || v_ingredient.name::TEXT;
                RETURN;
            END IF;
            
            UPDATE inventory_items SET current_stock = current_stock - v_total_needed, updated_at = NOW() WHERE id = v_ingredient.inventory_item_id;
            INSERT INTO inventory_transactions(item_id, transaction_type, quantity, stock_before, stock_after, reference_type, reference_id, notes) VALUES (v_ingredient.inventory_item_id, 'sale', -v_total_needed, v_ingredient.current_stock, v_ingredient.current_stock - v_total_needed, 'transaction', p_transaction_id, 'Auto-deducted for order');
            v_deduction_count := v_deduction_count + 1;
        END LOOP;
    END LOOP;
    
    -- Process customizations for this transaction
    -- Query order_customizations that haven't been deducted yet
    FOR v_customization IN 
        SELECT 
            oc.id,
            oc.order_item_id,
            oc.customization_option_id,
            oc.customization_type,
            oc.quantity,
            oc.inventory_item_id,
            oc.inventory_quantity_used,
            oi.catalog_item_id,
            oi.quantity as order_item_quantity
        FROM order_customizations oc
        JOIN order_items oi ON oi.id = oc.order_item_id
        WHERE oc.order_type = 'instant_transaction'
        AND oc.order_id = p_transaction_id
        AND oc.inventory_deducted = false
        AND oc.customization_type IN ('add', 'upgrade', 'swap')
        AND oc.inventory_item_id IS NOT NULL
    LOOP
        -- Calculate quantity to deduct
        -- If inventory_quantity_used is already set (from creation-time path), use it
        -- Otherwise, calculate from customization option
        DECLARE
            v_qty_to_deduct DECIMAL(10,3);
            v_current_stock DECIMAL(10,3);
            v_item_name TEXT;
        BEGIN
            IF v_customization.inventory_quantity_used IS NOT NULL THEN
                v_qty_to_deduct := v_customization.inventory_quantity_used;
            ELSE
                -- Fetch quantity_per_selection from customization_options
                SELECT co.quantity_per_selection INTO v_qty_to_deduct
                FROM customization_options co
                WHERE co.id = v_customization.customization_option_id;
                
                v_qty_to_deduct := COALESCE(v_qty_to_deduct, 1) * v_customization.quantity * v_customization.order_item_quantity;
            END IF;
            
            -- Get current stock with FOR UPDATE lock
            SELECT current_stock, name INTO v_current_stock, v_item_name
            FROM inventory_items 
            WHERE id = v_customization.inventory_item_id 
            FOR UPDATE;
            
            -- Stock-sufficiency check
            IF v_current_stock < v_qty_to_deduct THEN
                RETURN QUERY SELECT false, v_deduction_count, 'Insufficient stock for customization: ' || v_item_name::TEXT;
                RETURN;
            END IF;
            
            -- Perform deduction
            UPDATE inventory_items 
            SET current_stock = current_stock - v_qty_to_deduct,
                updated_at = NOW()
            WHERE id = v_customization.inventory_item_id;
            
            -- Record transaction
            INSERT INTO inventory_transactions(
                item_id, transaction_type, quantity, 
                stock_before, stock_after, reference_type, reference_id, notes
            ) VALUES (
                v_customization.inventory_item_id, 'sale', -v_qty_to_deduct,
                v_current_stock, v_current_stock - v_qty_to_deduct,
                'transaction', p_transaction_id,
                'Customization deduction for order'
            );
            
            -- Mark as deducted
            UPDATE order_customizations
            SET inventory_quantity_used = v_qty_to_deduct,
                inventory_deducted = true
            WHERE id = v_customization.id;
            
            v_customization_deduction_count := v_customization_deduction_count + 1;
        END;
    END LOOP;
    
    RETURN QUERY SELECT true, v_deduction_count + v_customization_deduction_count, NULL::TEXT;
END;
$$;
