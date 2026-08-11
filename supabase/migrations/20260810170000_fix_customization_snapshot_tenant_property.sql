-- Fix create_order_customization_snapshot to include tenant_id and property_id
-- The function was missing these required columns when inserting into customization_events and customization_metrics

CREATE OR REPLACE FUNCTION "public"."create_order_customization_snapshot"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer DEFAULT 1, "p_execute_inventory" boolean DEFAULT true) RETURNS TABLE("success" boolean, "snapshot_id" "uuid", "total_price_adjustment" numeric, "inventory_result" "jsonb", "validation_errors" "text"[], "event_ids" "uuid"[])
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
            p_base_quantity
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
