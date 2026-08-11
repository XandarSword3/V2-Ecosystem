-- Add tenant_id and property_id to process_customization_inventory_safe function
-- The function was missing these required columns when inserting into inventory_transactions

DROP FUNCTION IF EXISTS "public"."process_customization_inventory_safe" CASCADE;

CREATE FUNCTION "public"."process_customization_inventory_safe"(
    "p_order_type" "text",
    "p_order_id" "uuid",
    "p_order_item_id" "uuid",
    "p_selections" "jsonb",
    "p_base_quantity" integer DEFAULT 1
) RETURNS TABLE(
    "success" boolean,
    "items_added" integer,
    "items_removed" integer,
    "items_swapped" integer,
    "deduction_log" "jsonb"
)
LANGUAGE "plpgsql"
AS $$
DECLARE
    v_selection JSONB;
    v_inv_item_id UUID;
    v_qty_to_deduct DECIMAL(10,3);
    v_current_stock DECIMAL(10,3);
    v_min_stock DECIMAL(10,3);
    v_item_name TEXT;
    v_log JSONB := '[]'::JSONB;
    v_added INTEGER := 0;
    v_removed INTEGER := 0;
    v_swapped INTEGER := 0;
    v_tenant_id UUID;
    v_property_id UUID;
BEGIN
    -- Get tenant_id and property_id from the order
    SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
    FROM transactions
    WHERE id = p_order_id;
    
    -- If not found in transactions, try to get from inventory item
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
        FROM inventory_items
        WHERE id = (SELECT (p_selections->0->>'inventoryItemId')::UUID LIMIT 1);
    END IF;
    
    FOR v_selection IN SELECT * FROM jsonb_array_elements(COALESCE(p_selections, '[]'::JSONB))
    LOOP
        v_inv_item_id := (v_selection->>'inventoryItemId')::UUID;
        
        CASE (v_selection->>'customizationType')
            WHEN 'add', 'upgrade' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    -- Get current stock and check for warnings (using correct column name)
                    SELECT current_stock, min_stock_level, name INTO v_current_stock, v_min_stock, v_item_name
                    FROM inventory_items WHERE id = v_inv_item_id;
                    
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
                                'min_stock_level', v_min_stock
                            )
                        );
                    END IF;
                    
                    -- Perform FIFO deduction from batches
                    DECLARE
                        v_qty_remaining DECIMAL(10,3) := v_qty_to_deduct;
                        v_batch_id UUID;
                        v_batch_qty DECIMAL(10,3);
                        v_deducted DECIMAL(10,3) := 0;
                    BEGIN
                        -- Deduct from active batches in FIFO order
                        FOR v_batch_id, v_batch_qty IN 
                            SELECT id, remaining_quantity 
                            FROM inventory_batches 
                            WHERE item_id = v_inv_item_id 
                              AND status = 'active' 
                              AND remaining_quantity > 0
                            ORDER BY received_date ASC
                        LOOP
                            DECLARE
                                v_deduct_amount DECIMAL(10,3);
                            BEGIN
                                v_deduct_amount := LEAST(v_batch_qty, v_qty_remaining);
                                
                                -- Deduct from batch
                                UPDATE inventory_batches 
                                SET remaining_quantity = remaining_quantity - v_deduct_amount,
                                    status = CASE WHEN remaining_quantity - v_deduct_amount <= 0 THEN 'exhausted' ELSE 'active' END
                                WHERE id = v_batch_id;
                                
                                v_deducted := v_deducted + v_deduct_amount;
                                v_qty_remaining := v_qty_remaining - v_deduct_amount;
                                
                                EXIT WHEN v_qty_remaining <= 0;
                            END;
                        END LOOP;
                        
                        -- Update item stock
                        IF v_deducted > 0 THEN
                            UPDATE inventory_items 
                            SET current_stock = current_stock - v_deducted,
                                updated_at = NOW()
                            WHERE id = v_inv_item_id;
                            
                            INSERT INTO inventory_transactions (
                                item_id, transaction_type, quantity, 
                                reference_type, reference_id, notes,
                                tenant_id, property_id
                            ) VALUES (
                                v_inv_item_id, 'sale', -v_deducted,
                                p_order_type || '_customization', p_order_id,
                                'Customization: ' || (v_selection->>'optionName'),
                                v_tenant_id,
                                v_property_id
                            );
                            
                            -- Update the snapshot with actual deduction
                            UPDATE order_customizations
                            SET inventory_quantity_used = v_deducted,
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
                                'quantity', v_deducted
                            );
                        END IF;
                    END;
                END IF;
                
            WHEN 'swap' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    -- Perform FIFO deduction from batches
                    DECLARE
                        v_qty_remaining DECIMAL(10,3) := v_qty_to_deduct;
                        v_batch_id UUID;
                        v_batch_qty DECIMAL(10,3);
                        v_deducted DECIMAL(10,3) := 0;
                    BEGIN
                        FOR v_batch_id, v_batch_qty IN 
                            SELECT id, remaining_quantity 
                            FROM inventory_batches 
                            WHERE item_id = v_inv_item_id 
                              AND status = 'active' 
                              AND remaining_quantity > 0
                            ORDER BY received_date ASC
                        LOOP
                            DECLARE
                                v_deduct_amount DECIMAL(10,3);
                            BEGIN
                                v_deduct_amount := LEAST(v_batch_qty, v_qty_remaining);
                                
                                UPDATE inventory_batches 
                                SET remaining_quantity = remaining_quantity - v_deduct_amount,
                                    status = CASE WHEN remaining_quantity - v_deduct_amount <= 0 THEN 'exhausted' ELSE 'active' END
                                WHERE id = v_batch_id;
                                
                                v_deducted := v_deducted + v_deduct_amount;
                                v_qty_remaining := v_qty_remaining - v_deduct_amount;
                                
                                EXIT WHEN v_qty_remaining <= 0;
                            END;
                        END LOOP;
                        
                        IF v_deducted > 0 THEN
                            UPDATE inventory_items 
                            SET current_stock = current_stock - v_deducted,
                                updated_at = NOW()
                            WHERE id = v_inv_item_id;
                            
                            v_swapped := v_swapped + 1;
                            v_log := v_log || jsonb_build_object(
                                'action', 'swapped',
                                'inventoryItemId', v_inv_item_id,
                                'optionName', v_selection->>'optionName',
                                'quantity', v_deducted
                            );
                        END IF;
                    END;
                END IF;
                
            WHEN 'remove' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    UPDATE inventory_items 
                    SET current_stock = current_stock + v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id;
                    
                    IF FOUND THEN
                        v_removed := v_removed + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'restored',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );
                    END IF;
                END IF;
        END CASE;
    END LOOP;
    
    RETURN QUERY SELECT 
        true,
        v_added,
        v_removed,
        v_swapped,
        v_log;
END;
$$;
