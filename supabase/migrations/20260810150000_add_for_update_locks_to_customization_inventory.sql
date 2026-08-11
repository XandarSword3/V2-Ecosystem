-- Add FOR UPDATE locks to prevent race conditions in customization inventory deduction
-- Phase 0.5 of customization inventory integration plan

-- Add FOR UPDATE lock to process_customization_inventory_safe
CREATE OR REPLACE FUNCTION "public"."process_customization_inventory_safe"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer DEFAULT 1) RETURNS TABLE("items_added" integer, "items_removed" integer, "items_swapped" integer, "deduction_log" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_selection JSONB;
    v_added INT := 0;
    v_removed INT := 0;
    v_swapped INT := 0;
    v_log JSONB := '[]'::JSONB;
    v_inv_item_id UUID;
    v_qty_to_deduct DECIMAL(10,3);
    v_current_stock DECIMAL(10,3);
    v_min_stock DECIMAL(10,3);
    v_item_name TEXT;
BEGIN
    FOR v_selection IN SELECT * FROM jsonb_array_elements(COALESCE(p_selections, '[]'::JSONB))
    LOOP
        v_inv_item_id := (v_selection->>'inventoryItemId')::UUID;
        
        CASE (v_selection->>'customizationType')
            WHEN 'add', 'upgrade' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    -- Get current stock and check for warnings WITH FOR UPDATE LOCK
                    SELECT current_stock, minimum_stock, name INTO v_current_stock, v_min_stock, v_item_name
                    FROM inventory_items WHERE id = v_inv_item_id FOR UPDATE;
                    
                    -- Check if this would trigger low stock warning
                    IF v_current_stock - v_qty_to_deduct <= COALESCE(v_min_stock, 0) THEN
                        INSERT INTO customization_events (event_type, payload)
                        VALUES (
                            'inventory.warning',
                            jsonb_build_object(
                                'warning_type', 'low_stock',
                                'inventory_item_id', v_inv_item_id,
                                'item_name', v_item_name,
                                'current_stock', v_current_stock,
                                'deduction_amount', v_qty_to_deduct,
                                'remaining_stock', v_current_stock - v_qty_to_deduct,
                                'minimum_stock', v_min_stock
                            )
                        );
                    END IF;
                    
                    -- Perform deduction
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id
                    AND current_stock >= v_qty_to_deduct;
                    
                    IF FOUND THEN
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, 
                            reference_type, reference_id, notes
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Customization: ' || (v_selection->>'optionName')
                        );
                        
                        -- Update the snapshot with actual deduction
                        UPDATE order_customizations
                        SET inventory_quantity_used = v_qty_to_deduct,
                            inventory_deducted = true
                        WHERE order_type = p_order_type
                        AND order_id = p_order_id
                        AND (p_order_item_id IS NULL OR order_item_id = p_order_item_id)
                        AND customization_option_id = (v_selection->>'optionId')::UUID;
                        
                        v_added := v_added + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'deducted',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );
                    ELSE
                        -- Insufficient stock - emit warning
                        INSERT INTO customization_events (event_type, payload)
                        VALUES (
                            'inventory.warning',
                            jsonb_build_object(
                                'warning_type', 'insufficient_stock',
                                'inventory_item_id', v_inv_item_id,
                                'item_name', v_item_name,
                                'required', v_qty_to_deduct,
                                'available', v_current_stock
                            )
                        );
                    END IF;
                END IF;
                
            WHEN 'swap' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    -- Get current stock WITH FOR UPDATE LOCK
                    SELECT current_stock, minimum_stock, name INTO v_current_stock, v_min_stock, v_item_name
                    FROM inventory_items WHERE id = v_inv_item_id FOR UPDATE;
                    
                    -- Perform deduction
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id
                    AND current_stock >= v_qty_to_deduct;
                    
                    IF FOUND THEN
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, 
                            reference_type, reference_id, notes
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Swap (added): ' || (v_selection->>'optionName')
                        );
                        
                        -- Update the snapshot with actual deduction
                        UPDATE order_customizations
                        SET inventory_quantity_used = v_qty_to_deduct,
                            inventory_deducted = true
                        WHERE order_type = p_order_type
                        AND order_id = p_order_id
                        AND (p_order_item_id IS NULL OR order_item_id = p_order_item_id)
                        AND customization_option_id = (v_selection->>'optionId')::UUID;
                    END IF;
                END IF;
                
                v_swapped := v_swapped + 1;
                v_log := v_log || jsonb_build_object(
                    'action', 'swapped',
                    'addedItemId', v_inv_item_id,
                    'removedItemId', v_selection->>'replacesInventoryItemId',
                    'optionName', v_selection->>'optionName',
                    'quantity', v_qty_to_deduct
                );
                
            WHEN 'remove' THEN
                -- Just track it, inventory NOT deducted (handled by base recipe processing)
                v_removed := v_removed + 1;
                v_log := v_log || jsonb_build_object(
                    'action', 'skip_deduction',
                    'inventoryItemId', v_selection->>'inventoryItemId',
                    'optionName', v_selection->>'optionName',
                    'reason', 'remove_modifier'
                );
        END CASE;

        -- Store the customization record
        INSERT INTO order_customizations (
            order_type, order_id, order_item_id,
            customization_group_id, customization_option_id,
            group_name, option_name, customization_type, quantity,
            unit_price_adjustment, total_price_adjustment,
            inventory_item_id, inventory_quantity_used, inventory_deducted
        ) VALUES (
            p_order_type, p_order_id, p_order_item_id,
            (v_selection->>'groupId')::UUID,
            (v_selection->>'optionId')::UUID,
            v_selection->>'groupName',
            v_selection->>'optionName',
            v_selection->>'customizationType',
            COALESCE((v_selection->>'quantity')::INT, 1),
            COALESCE((v_selection->>'unitPrice')::DECIMAL, 0),
            COALESCE((v_selection->>'totalPrice')::DECIMAL, 0),
            v_inv_item_id,
            CASE WHEN (v_selection->>'customizationType') IN ('add', 'upgrade', 'swap') 
                 THEN v_qty_to_deduct ELSE NULL END,
            (v_selection->>'customizationType') IN ('add', 'upgrade', 'swap')
        );
    END LOOP;

    RETURN QUERY SELECT v_added, v_removed, v_swapped, v_log;
END;
$$;
