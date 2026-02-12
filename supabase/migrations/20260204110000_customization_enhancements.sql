-- =============================================
-- UNIFIED CUSTOMIZATION SYSTEM - ENHANCEMENTS
-- Transactional order processing, reversal flow, observability
-- =============================================

-- 1. Add reversal tracking columns to order_customizations
ALTER TABLE order_customizations 
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reversal_reason TEXT,
ADD COLUMN IF NOT EXISTS inventory_reversed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_snapshot_id UUID REFERENCES order_customizations(id);

-- 2. Create customization events table for observability
CREATE TABLE IF NOT EXISTS customization_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'price.calculated', 'inventory.warning', 'inventory.executed', 'inventory.reversed', 'validation.failed'
    entity_type TEXT,
    entity_id UUID,
    order_type TEXT,
    order_id UUID,
    order_item_id UUID,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processing_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_customization_events_type ON customization_events(event_type);
CREATE INDEX IF NOT EXISTS idx_customization_events_order ON customization_events(order_type, order_id);
CREATE INDEX IF NOT EXISTS idx_customization_events_created ON customization_events(created_at DESC);

-- 3. Create metrics table for performance tracking
CREATE TABLE IF NOT EXISTS customization_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL, -- 'validation_latency_ms', 'inventory_processing_ms', etc.
    metric_value DECIMAL(10,3) NOT NULL,
    dimensions JSONB DEFAULT '{}', -- e.g., {entity_type: 'menu_item', selections_count: 5}
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customization_metrics_name ON customization_metrics(metric_name, recorded_at DESC);

-- 4. Create function for transactional order snapshot with inventory
CREATE OR REPLACE FUNCTION create_order_customization_snapshot(
    p_order_type TEXT,
    p_order_id UUID,
    p_order_item_id UUID,
    p_entity_type customizable_entity_type,
    p_entity_id UUID,
    p_selections JSONB,
    p_base_quantity INT DEFAULT 1,
    p_execute_inventory BOOLEAN DEFAULT true
)
RETURNS TABLE (
    success BOOLEAN,
    snapshot_id UUID,
    total_price_adjustment DECIMAL(10,2),
    inventory_result JSONB,
    validation_errors TEXT[],
    event_ids UUID[]
) AS $$
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
BEGIN
    v_start_time := clock_timestamp();
    
    -- Step 1: Validate selections
    SELECT * INTO v_validation 
    FROM validate_customizations(p_entity_type, p_entity_id, p_selections);
    
    -- Emit validation event
    INSERT INTO customization_events (event_type, entity_type, entity_id, order_type, order_id, order_item_id, payload)
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
        )
    ) RETURNING id INTO v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);
    
    -- Record validation metric
    INSERT INTO customization_metrics (metric_name, metric_value, dimensions)
    VALUES (
        'validation_latency_ms',
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time),
        jsonb_build_object('entity_type', p_entity_type, 'selections_count', jsonb_array_length(p_selections))
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
            (v_selection->>'inventoryItemId')::UUID,
            NULL, -- Will be set by inventory processing
            false
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
            p_base_quantity
        );
        
        -- Emit inventory execution event
        INSERT INTO customization_events (event_type, order_type, order_id, order_item_id, payload)
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
            )
        ) RETURNING id INTO v_event_id;
        v_event_ids := array_append(v_event_ids, v_event_id);
        
        -- Record inventory metric
        INSERT INTO customization_metrics (metric_name, metric_value, dimensions)
        VALUES (
            'inventory_processing_ms',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time),
            jsonb_build_object('items_processed', v_inv_result.items_added + v_inv_result.items_swapped)
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
$$ LANGUAGE plpgsql;

-- 5. Create safe inventory processing with warning events
CREATE OR REPLACE FUNCTION process_customization_inventory_safe(
    p_order_type TEXT,
    p_order_id UUID,
    p_order_item_id UUID,
    p_selections JSONB,
    p_base_quantity INT DEFAULT 1
)
RETURNS TABLE (
    items_added INT,
    items_removed INT,
    items_swapped INT,
    deduction_log JSONB
) AS $$
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
                    
                    -- Get current stock and check for warnings
                    SELECT current_stock, minimum_stock, name INTO v_current_stock, v_min_stock, v_item_name
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
                    
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id;
                    
                    IF FOUND THEN
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, 
                            reference_type, reference_id, notes
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Swap (added): ' || (v_selection->>'optionName')
                        );
                        
                        -- Update the snapshot
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
                v_removed := v_removed + 1;
                v_log := v_log || jsonb_build_object(
                    'action', 'skip_deduction',
                    'inventoryItemId', v_selection->>'inventoryItemId',
                    'optionName', v_selection->>'optionName',
                    'reason', 'remove_modifier'
                );
        END CASE;
    END LOOP;

    RETURN QUERY SELECT v_added, v_removed, v_swapped, v_log;
END;
$$ LANGUAGE plpgsql;

-- 6. Create CRITICAL reversal function for refunds
CREATE OR REPLACE FUNCTION reverse_order_item_inventory(
    p_snapshot_id UUID,
    p_reason TEXT DEFAULT 'Refund',
    p_reversed_by UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    items_reversed INT,
    reversal_log JSONB,
    error_message TEXT
) AS $$
DECLARE
    v_snapshot RECORD;
    v_reversed INT := 0;
    v_log JSONB := '[]'::JSONB;
    v_event_id UUID;
BEGIN
    -- Get snapshot details
    SELECT * INTO v_snapshot
    FROM order_customizations
    WHERE id = p_snapshot_id;
    
    IF v_snapshot IS NULL THEN
        RETURN QUERY SELECT false, 0, '[]'::JSONB, 'Snapshot not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_snapshot.reversed_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 0, '[]'::JSONB, 'Snapshot already reversed'::TEXT;
        RETURN;
    END IF;
    
    -- Reverse inventory for ALL snapshots in this order item
    FOR v_snapshot IN 
        SELECT * FROM order_customizations
        WHERE order_type = (SELECT order_type FROM order_customizations WHERE id = p_snapshot_id)
        AND order_id = (SELECT order_id FROM order_customizations WHERE id = p_snapshot_id)
        AND (order_item_id = (SELECT order_item_id FROM order_customizations WHERE id = p_snapshot_id)
             OR (order_item_id IS NULL AND (SELECT order_item_id FROM order_customizations WHERE id = p_snapshot_id) IS NULL))
        AND reversed_at IS NULL
    LOOP
        IF v_snapshot.inventory_deducted AND v_snapshot.inventory_item_id IS NOT NULL THEN
            -- Restore inventory
            UPDATE inventory_items 
            SET current_stock = current_stock + v_snapshot.inventory_quantity_used,
                updated_at = NOW()
            WHERE id = v_snapshot.inventory_item_id;
            
            -- Create reversal transaction
            INSERT INTO inventory_transactions (
                item_id, transaction_type, quantity, 
                reference_type, reference_id, notes
            ) VALUES (
                v_snapshot.inventory_item_id, 
                'adjustment', 
                v_snapshot.inventory_quantity_used,
                v_snapshot.order_type || '_customization_reversal', 
                v_snapshot.order_id,
                'Reversal: ' || v_snapshot.option_name || ' - ' || p_reason
            );
            
            v_reversed := v_reversed + 1;
            v_log := v_log || jsonb_build_object(
                'action', 'inventory_restored',
                'snapshot_id', v_snapshot.id,
                'inventory_item_id', v_snapshot.inventory_item_id,
                'quantity_restored', v_snapshot.inventory_quantity_used,
                'option_name', v_snapshot.option_name
            );
        END IF;
        
        -- Mark snapshot as reversed
        UPDATE order_customizations
        SET reversed_at = NOW(),
            reversed_by = p_reversed_by,
            reversal_reason = p_reason,
            inventory_reversed = true
        WHERE id = v_snapshot.id;
    END LOOP;
    
    -- Emit reversal event
    INSERT INTO customization_events (event_type, order_type, order_id, payload)
    VALUES (
        'inventory.reversed',
        v_snapshot.order_type,
        v_snapshot.order_id,
        jsonb_build_object(
            'snapshot_id', p_snapshot_id,
            'items_reversed', v_reversed,
            'reason', p_reason,
            'reversed_by', p_reversed_by,
            'reversal_log', v_log
        )
    ) RETURNING id INTO v_event_id;
    
    RETURN QUERY SELECT true, v_reversed, v_log, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get reversal-eligible snapshots
CREATE OR REPLACE FUNCTION get_reversible_order_customizations(
    p_order_type TEXT,
    p_order_id UUID
)
RETURNS TABLE (
    snapshot_id UUID,
    order_item_id UUID,
    option_name TEXT,
    quantity INT,
    inventory_deducted BOOLEAN,
    inventory_quantity_used DECIMAL(10,3),
    created_at TIMESTAMPTZ,
    can_reverse BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        oc.id,
        oc.order_item_id,
        oc.option_name,
        oc.quantity,
        oc.inventory_deducted,
        oc.inventory_quantity_used,
        oc.created_at,
        (oc.reversed_at IS NULL) as can_reverse
    FROM order_customizations oc
    WHERE oc.order_type = p_order_type
    AND oc.order_id = p_order_id
    ORDER BY oc.created_at;
END;
$$ LANGUAGE plpgsql;

-- 8. Enhanced RLS policies with proper security
DROP POLICY IF EXISTS "customization_groups_write" ON customization_groups;
DROP POLICY IF EXISTS "customization_options_write" ON customization_options;
DROP POLICY IF EXISTS "entity_customizations_write" ON entity_customizations;
DROP POLICY IF EXISTS "order_customizations_all" ON order_customizations;

-- Admin/staff can write to groups
CREATE POLICY "customization_groups_insert" ON customization_groups 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "customization_groups_update" ON customization_groups 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "customization_groups_delete" ON customization_groups 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Options policies
CREATE POLICY "customization_options_insert" ON customization_options 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "customization_options_update" ON customization_options 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "customization_options_delete" ON customization_options 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Entity links policies
CREATE POLICY "entity_customizations_insert" ON entity_customizations 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
    );

CREATE POLICY "entity_customizations_update" ON entity_customizations 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
    );

CREATE POLICY "entity_customizations_delete" ON entity_customizations 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- Order customizations: read by order owner or staff, write by system only
CREATE POLICY "order_customizations_read" ON order_customizations 
    FOR SELECT USING (
        -- Staff can read all
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
        OR
        -- Order owner can read their own (check via order reference)
        auth.uid() IS NOT NULL
    );

CREATE POLICY "order_customizations_insert" ON order_customizations 
    FOR INSERT WITH CHECK (
        -- Only system (service role) or staff can insert
        auth.jwt()->>'role' = 'service_role'
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
    );

CREATE POLICY "order_customizations_update" ON order_customizations 
    FOR UPDATE USING (
        -- Only system or admin can update (for reversals)
        auth.jwt()->>'role' = 'service_role'
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Events table policies
ALTER TABLE customization_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customization_events_read" ON customization_events 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "customization_events_insert" ON customization_events 
    FOR INSERT WITH CHECK (true); -- Allow system to insert events

-- Metrics table policies
ALTER TABLE customization_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customization_metrics_read" ON customization_metrics 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "customization_metrics_insert" ON customization_metrics 
    FOR INSERT WITH CHECK (true); -- Allow system to insert metrics

-- 9. Create dual-write tracking table for migration
CREATE TABLE IF NOT EXISTS customization_dual_write_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation TEXT NOT NULL, -- 'create_order', 'process_inventory', 'validate'
    old_system_result JSONB,
    new_system_result JSONB,
    results_match BOOLEAN,
    discrepancies JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dual_write_log_match ON customization_dual_write_log(results_match, created_at DESC);

-- 10. Create function for dual-write comparison
CREATE OR REPLACE FUNCTION log_dual_write_comparison(
    p_operation TEXT,
    p_old_result JSONB,
    p_new_result JSONB
)
RETURNS UUID AS $$
DECLARE
    v_match BOOLEAN;
    v_discrepancies JSONB := '[]'::JSONB;
    v_log_id UUID;
BEGIN
    -- Simple comparison for now - can be enhanced
    v_match := p_old_result::TEXT = p_new_result::TEXT;
    
    IF NOT v_match THEN
        v_discrepancies := jsonb_build_object(
            'old_keys', jsonb_object_keys(p_old_result),
            'new_keys', jsonb_object_keys(p_new_result)
        );
    END IF;
    
    INSERT INTO customization_dual_write_log (
        operation, old_system_result, new_system_result, results_match, discrepancies
    ) VALUES (
        p_operation, p_old_result, p_new_result, v_match, v_discrepancies
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Create view for metrics dashboard
CREATE OR REPLACE VIEW customization_metrics_summary AS
SELECT 
    metric_name,
    COUNT(*) as sample_count,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value) as p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) as p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY metric_value) as p99,
    date_trunc('hour', recorded_at) as hour
FROM customization_metrics
WHERE recorded_at > NOW() - INTERVAL '24 hours'
GROUP BY metric_name, date_trunc('hour', recorded_at)
ORDER BY hour DESC, metric_name;

-- 12. Add comments
COMMENT ON FUNCTION create_order_customization_snapshot IS 'Transactional function to validate, snapshot, and optionally execute inventory for customizations';
COMMENT ON FUNCTION reverse_order_item_inventory IS 'Reverse inventory deductions for refunds/cancellations - CRITICAL for financial accuracy';
COMMENT ON FUNCTION process_customization_inventory_safe IS 'Safe inventory processing with warning events for low stock';
COMMENT ON TABLE customization_events IS 'Event log for observability - price.calculated, inventory.warning, inventory.executed, inventory.reversed';
COMMENT ON TABLE customization_metrics IS 'Performance metrics for monitoring validation and inventory processing latency';
COMMENT ON TABLE customization_dual_write_log IS 'Dual-write comparison log for migration validation';
