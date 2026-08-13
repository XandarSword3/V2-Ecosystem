-- DUPLICATE_DO_NOT_RUN: archived 2026-08-13.
--
-- This file never applied (confirmed via `supabase migration list` — blank
-- Remote column for 20260812110000) and `supabase db push` failed on it
-- with "unterminated dollar-quoted string": the file is truncated mid-body,
-- cut off at line 271 right after the 'swap' branch, with no 'remove'
-- branch, no END CASE/END LOOP, no RETURN QUERY, no closing END;/$$;, and
-- no second CREATE FUNCTION for create_order_customization_snapshot.
--
-- It's also redundant even if completed: 20260812100000_fix_inventory_
-- transaction_fields.sql (committed in the same wip commit, 003b9a56) was
-- already applied to remote and already contains the full, working fix for
-- all three items this file's header describes — the swap branch's
-- inventory_transactions insert, the remove branch's insert, and
-- create_order_customization_snapshot accepting + forwarding p_performed_by
-- to process_customization_inventory_safe. Diffed line-by-line against
-- 20260812100000 for everything up to the truncation point; identical.
--
-- Moved here instead of hand-completing it, per the repo's existing
-- DUPLICATE_DO_NOT_RUN convention (see the 2026-02-24 pool-ticket/chalet
-- duplicates in this same folder) — finishing it would only recreate a
-- function that's already live, with no functional difference.
--
-- Original header follows unmodified:
-- ------------------------------------------------------------------
-- Fix swap/remove branches in process_customization_inventory_safe missing
-- inventory_transactions records, and add p_performed_by to
-- create_order_customization_snapshot (the function actually invoked by the
-- order-creation flow), forwarding it to process_customization_inventory_safe.
--
-- Context: 20260812100000_fix_inventory_transaction_fields.sql already fixed
-- deduct_inventory_for_order, restore_inventory_for_order, and the
-- add/upgrade branch of process_customization_inventory_safe — but that
-- migration was already applied to the remote database before these
-- additional gaps were found, so they need their own migration:
--   1. process_customization_inventory_safe's 'swap' branch deducted stock
--      but never inserted an inventory_transactions row at all.
--   2. Its 'remove' branch (restoring stock) had the same problem.
--   3. create_order_customization_snapshot — the function the real order
--      flow calls — never accepted p_performed_by and never forwarded one
--      to process_customization_inventory_safe, so performed_by stayed NULL
--      for every customization-driven deduction regardless of what the TS
--      layer passed in.

-- ============================================
-- Update process_customization_inventory_safe
-- ============================================
-- Signature is unchanged from the currently-live version, so CREATE OR
-- REPLACE is sufficient (no DROP/CASCADE needed).
CREATE OR REPLACE FUNCTION "public"."process_customization_inventory_safe"(
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
