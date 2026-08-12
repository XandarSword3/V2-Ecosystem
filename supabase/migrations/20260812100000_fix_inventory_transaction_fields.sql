-- Fix inventory transaction fields: add stock_before, stock_after, and performed_by
-- This migration updates three RPC functions to include missing fields in inventory_transactions
-- 
-- Issues fixed:
-- 1. process_customization_inventory_safe: missing stock_before, stock_after, performed_by
-- 2. deduct_inventory_for_order: missing performed_by
-- 3. restore_inventory_for_order: missing performed_by

-- ============================================
-- Update process_customization_inventory_safe
-- ============================================
DROP FUNCTION IF EXISTS "public"."process_customization_inventory_safe" CASCADE;

CREATE FUNCTION "public"."process_customization_inventory_safe"(
    "p_order_type" "text",
    "p_order_id" "uuid",
    "p_order_item_id" "uuid",
    "p_selections" "jsonb",
    "p_base_quantity" integer DEFAULT 1,
    "p_performed_by" "uuid" DEFAULT NULL
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
                            DECLARE
                                v_stock_before DECIMAL(10,3);
                                v_stock_after DECIMAL(10,3);
                            BEGIN
                                -- Capture stock before update
                                SELECT current_stock INTO v_stock_before
                                FROM inventory_items
                                WHERE id = v_inv_item_id;
                                
                                UPDATE inventory_items 
                                SET current_stock = current_stock - v_deducted,
                                    updated_at = NOW()
                                WHERE id = v_inv_item_id;
                                
                                -- Capture stock after update
                                SELECT current_stock INTO v_stock_after
                                FROM inventory_items
                                WHERE id = v_inv_item_id;
                                
                                INSERT INTO inventory_transactions (
                                    item_id, transaction_type, quantity, 
                                    stock_before, stock_after,
                                    reference_type, reference_id, notes,
                                    performed_by, tenant_id, property_id
                                ) VALUES (
                                    v_inv_item_id, 'sale', -v_deducted,
                                    v_stock_before, v_stock_after,
                                    p_order_type || '_customization', p_order_id,
                                    'Customization: ' || (v_selection->>'optionName'),
                                    p_performed_by,
                                    v_tenant_id,
                                    v_property_id
                                );
                            END;
                            
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
                            DECLARE
                                v_stock_before DECIMAL(10,3);
                                v_stock_after DECIMAL(10,3);
                            BEGIN
                                SELECT current_stock INTO v_stock_before
                                FROM inventory_items
                                WHERE id = v_inv_item_id;

                                UPDATE inventory_items 
                                SET current_stock = current_stock - v_deducted,
                                    updated_at = NOW()
                                WHERE id = v_inv_item_id;

                                SELECT current_stock INTO v_stock_after
                                FROM inventory_items
                                WHERE id = v_inv_item_id;

                                INSERT INTO inventory_transactions (
                                    item_id, transaction_type, quantity,
                                    stock_before, stock_after,
                                    reference_type, reference_id, notes,
                                    performed_by, tenant_id, property_id
                                ) VALUES (
                                    v_inv_item_id, 'sale', -v_deducted,
                                    v_stock_before, v_stock_after,
                                    p_order_type || '_customization', p_order_id,
                                    'Customization swap: ' || (v_selection->>'optionName'),
                                    p_performed_by,
                                    v_tenant_id,
                                    v_property_id
                                );
                            END;
                            
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
                    
                    DECLARE
                        v_stock_before DECIMAL(10,3);
                        v_stock_after DECIMAL(10,3);
                    BEGIN
                        SELECT current_stock INTO v_stock_before
                        FROM inventory_items
                        WHERE id = v_inv_item_id;

                        UPDATE inventory_items 
                        SET current_stock = current_stock + v_qty_to_deduct,
                            updated_at = NOW()
                        WHERE id = v_inv_item_id;
                        
                        IF FOUND THEN
                            SELECT current_stock INTO v_stock_after
                            FROM inventory_items
                            WHERE id = v_inv_item_id;

                            INSERT INTO inventory_transactions (
                                item_id, transaction_type, quantity,
                                stock_before, stock_after,
                                reference_type, reference_id, notes,
                                performed_by, tenant_id, property_id
                            ) VALUES (
                                v_inv_item_id, 'restoration', v_qty_to_deduct,
                                v_stock_before, v_stock_after,
                                p_order_type || '_customization', p_order_id,
                                'Customization removed: ' || (v_selection->>'optionName'),
                                p_performed_by,
                                v_tenant_id,
                                v_property_id
                            );

                            v_removed := v_removed + 1;
                            v_log := v_log || jsonb_build_object(
                                'action', 'restored',
                                'inventoryItemId', v_inv_item_id,
                                'optionName', v_selection->>'optionName',
                                'quantity', v_qty_to_deduct
                            );
                        END IF;
                    END;
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

-- ============================================
-- Update deduct_inventory_for_order
-- ============================================
CREATE OR REPLACE FUNCTION "public"."deduct_inventory_for_order"(
    "p_transaction_id" "uuid",
    "p_performed_by" "uuid" DEFAULT NULL
) RETURNS TABLE("success" boolean, "items_deducted" integer, "error_message" "text")
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
            INSERT INTO inventory_transactions(item_id, transaction_type, quantity, stock_before, stock_after, reference_type, reference_id, notes, performed_by) VALUES (v_ingredient.inventory_item_id, 'sale', -v_total_needed, v_ingredient.current_stock, v_ingredient.current_stock - v_total_needed, 'transaction', p_transaction_id, 'Auto-deducted for order', p_performed_by);
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
                stock_before, stock_after, reference_type, reference_id, notes, performed_by
            ) VALUES (
                v_customization.inventory_item_id, 'sale', -v_qty_to_deduct,
                v_current_stock, v_current_stock - v_qty_to_deduct,
                'transaction', p_transaction_id,
                'Customization deduction for order',
                p_performed_by
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

-- ============================================
-- Update restore_inventory_for_order
-- ============================================
CREATE OR REPLACE FUNCTION "public"."restore_inventory_for_order"(
    "p_transaction_id" "uuid",
    "p_performed_by" "uuid" DEFAULT NULL
)
RETURNS TABLE("success" boolean, "items_restored" integer, "error_message" "text")
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deduction RECORD;
    v_restore_count INTEGER := 0;
    v_current_stock DECIMAL;
BEGIN
    -- Idempotency guard: if this transaction has already been restored,
    -- do nothing rather than double-crediting stock.
    IF EXISTS (
        SELECT 1 FROM inventory_transactions
        WHERE reference_type = 'transaction'
          AND reference_id = p_transaction_id
          AND transaction_type = 'restoration'
    ) THEN
        RETURN QUERY SELECT true, 0, 'Already restored'::TEXT;
        RETURN;
    END IF;

    FOR v_deduction IN
        SELECT item_id, quantity
        FROM inventory_transactions
        WHERE reference_type = 'transaction'
          AND reference_id = p_transaction_id
          AND transaction_type = 'sale'
        FOR UPDATE OF inventory_transactions
    LOOP
        -- Lock the inventory_items row before touching it, same as
        -- deduct_stock_fifo's serialization point.
        SELECT current_stock INTO v_current_stock
        FROM inventory_items
        WHERE id = v_deduction.item_id
        FOR UPDATE;

        UPDATE inventory_items
        SET current_stock = current_stock + ABS(v_deduction.quantity),
            updated_at = NOW()
        WHERE id = v_deduction.item_id;

        INSERT INTO inventory_transactions(
            item_id, transaction_type, quantity, stock_before, stock_after,
            reference_type, reference_id, notes, performed_by
        ) VALUES (
            v_deduction.item_id, 'restoration', ABS(v_deduction.quantity),
            v_current_stock, v_current_stock + ABS(v_deduction.quantity),
            'transaction', p_transaction_id, 'Restored due to order cancellation',
            p_performed_by
        );

        v_restore_count := v_restore_count + 1;
    END LOOP;

    RETURN QUERY SELECT true, v_restore_count, NULL::TEXT;
END;
$$;

-- ============================================
-- Update create_order_customization_snapshot
-- ============================================
-- Issue 4 (found while fixing #1-3 above): this is the function actually
-- invoked by the order-creation flow (dynamic-module.router.ts) and by
-- customization.service.ts's createOrderSnapshot(). It never accepted
-- p_performed_by and never forwarded one to process_customization_inventory_safe,
-- so performed_by stayed NULL for every customization-driven deduction even
-- after the TS layer started passing it through. Same shape as
-- 20260810171000_fix_order_customizations_tenant_property.sql, plus the new param.
CREATE OR REPLACE FUNCTION "public"."create_order_customization_snapshot"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer DEFAULT 1, "p_execute_inventory" boolean DEFAULT true, "p_performed_by" "uuid" DEFAULT NULL) RETURNS TABLE("success" boolean, "snapshot_id" "uuid", "total_price_adjustment" numeric, "inventory_result" "jsonb", "validation_errors" "text"[], "event_ids" "uuid"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_validation RECORD;
    v_snapshot_ids UUID[] := '{}';
    v_selection JSONB;
    v_snapshot_id UUID;
    v_inv_result RECORD;
    v_total_price DECIMAL(10,2) := 0;
    v_event_ids UUID[] := '{}';
    v_start_time TIMESTAMPTZ;
    v_event_id UUID;
    v_tenant_id UUID;
    v_property_id UUID;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Get tenant_id and property_id from the order
    SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
    FROM transactions
    WHERE id = p_order_id;
    
    -- If not found in transactions, try to get from the entity
    IF v_tenant_id IS NULL THEN
        CASE p_entity_type
            WHEN 'catalog_item' THEN
                SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
                FROM catalog_items
                WHERE id = p_entity_id;
            WHEN 'kiosk_item' THEN
                SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
                FROM kiosk_items
                WHERE id = p_entity_id;
            -- Add other entity types as needed
        END CASE;
    END IF;
    
    -- Step 1: Validate selections
    SELECT * INTO v_validation 
    FROM validate_customizations(p_entity_type, p_entity_id, p_selections);
    
    -- Emit validation event
    INSERT INTO customization_events (event_type, entity_type, entity_id, order_type, order_id, order_item_id, payload, tenant_id, property_id)
    VALUES (
        CASE WHEN v_validation.is_valid THEN 'price.calculated' ELSE 'validation.failed' END,
        p_entity_type::TEXT,
        p_entity_id,
        p_order_type,
        p_order_id,
        p_order_item_id,
        jsonb_build_object(
            'selections_count', jsonb_array_length(p_selections),
            'total_price_adjustment', v_validation.total_price_adjustment,
            'is_valid', v_validation.is_valid,
            'errors', v_validation.validation_errors,
            'latency_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)
        ),
        v_tenant_id,
        v_property_id
    ) RETURNING id INTO v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);
    
    -- Record validation metric
    INSERT INTO customization_metrics (metric_name, metric_value, dimensions, tenant_id, property_id)
    VALUES (
        'validation_latency_ms',
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time),
        jsonb_build_object('entity_type', p_entity_type, 'selections_count', jsonb_array_length(p_selections)),
        v_tenant_id,
        v_property_id
    );
    
    IF NOT v_validation.is_valid THEN
        RETURN QUERY SELECT 
            false, 
            NULL::UUID, 
            0::DECIMAL(10,2), 
            NULL::JSONB, 
            v_validation.validation_errors,
            v_event_ids;
        RETURN;
    END IF;
    
    v_total_price := v_validation.total_price_adjustment;
    
    -- Step 2: Create snapshots for each validated selection
    FOR v_selection IN SELECT * FROM jsonb_array_elements(v_validation.validated_selections)
    LOOP
        INSERT INTO order_customizations (
            order_type, order_id, order_item_id,
            customization_group_id, customization_option_id,
            group_name, option_name, customization_type, quantity,
            unit_price_adjustment, total_price_adjustment,
            inventory_item_id, inventory_quantity_used, inventory_deducted,
            tenant_id, property_id
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
            (v_selection->>'inventoryItemId')::UUID,
            NULL, -- Will be set by inventory processing
            false,
            v_tenant_id,
            v_property_id
        ) RETURNING id INTO v_snapshot_id;
        
        v_snapshot_ids := array_append(v_snapshot_ids, v_snapshot_id);
    END LOOP;
    
    -- Step 3: Execute inventory if requested
    IF p_execute_inventory AND jsonb_array_length(v_validation.validated_selections) > 0 THEN
        v_start_time := clock_timestamp();
        
        SELECT * INTO v_inv_result 
        FROM process_customization_inventory_safe(
            p_order_type,
            p_order_id, 
            p_order_item_id,
            v_validation.validated_selections,
            p_base_quantity,
            p_performed_by
        );
        
        -- Emit inventory execution event
        INSERT INTO customization_events (event_type, order_type, order_id, order_item_id, payload, tenant_id, property_id)
        VALUES (
            'inventory.executed',
            p_order_type,
            p_order_id,
            p_order_item_id,
            jsonb_build_object(
                'items_added', v_inv_result.items_added,
                'items_removed', v_inv_result.items_removed,
                'items_swapped', v_inv_result.items_swapped,
                'deduction_log', v_inv_result.deduction_log,
                'latency_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)
            ),
            v_tenant_id,
            v_property_id
        ) RETURNING id INTO v_event_id;
        v_event_ids := array_append(v_event_ids, v_event_id);
        
        -- Record inventory metric
        INSERT INTO customization_metrics (metric_name, metric_value, dimensions, tenant_id, property_id)
        VALUES (
            'inventory_processing_ms',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time),
            jsonb_build_object('items_processed', v_inv_result.items_added + v_inv_result.items_swapped),
            v_tenant_id,
            v_property_id
        );
        
        RETURN QUERY SELECT 
            true,
            v_snapshot_ids[1], -- Return first snapshot ID
            v_total_price,
            jsonb_build_object(
                'items_added', v_inv_result.items_added,
                'items_removed', v_inv_result.items_removed,
                'items_swapped', v_inv_result.items_swapped,
                'deduction_log', v_inv_result.deduction_log
            ),
            '{}'::TEXT[],
            v_event_ids;
    ELSE
        RETURN QUERY SELECT 
            true,
            v_snapshot_ids[1],
            v_total_price,
            '{"items_added": 0, "items_removed": 0, "items_swapped": 0}'::JSONB,
            '{}'::TEXT[],
            v_event_ids;
    END IF;
END;
$$;
