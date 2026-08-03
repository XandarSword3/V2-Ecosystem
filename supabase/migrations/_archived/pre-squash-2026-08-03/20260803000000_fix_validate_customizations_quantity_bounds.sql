-- =============================================
-- FIX: validate_customizations() never enforced per-option quantity bounds
-- =============================================
-- Found during E2E verification of the modifier pricing pipeline.
-- customization_options.max_quantity has always existed and is returned to
-- the frontend for UI clamping (CustomizationSelector's +/- buttons respect
-- it), but the server-side "authoritative" validator never checked it and
-- never rejected quantity < 1 either. Since POST /orders now feeds
-- total_price_adjustment straight into unitPrice, a client could bypass the
-- UI entirely and:
--   - submit an inflated quantity past max_quantity for more than the admin
--     intended to allow, or
--   - submit a negative quantity to make total_price_adjustment negative,
--     discounting the order arbitrarily (confirmed: quantity=-50 on a
--     $1.25 option produced total_price_adjustment = -60.00 with
--     is_valid = true and zero validation errors).
--
-- This replaces validate_customizations() with the same signature, adding
-- exactly one bounds check per selection. Everything else is unchanged from
-- 20260204100000_unified_customization_system.sql.

CREATE OR REPLACE FUNCTION validate_customizations(
    p_entity_type customizable_entity_type,
    p_entity_id UUID,
    p_selections JSONB -- Array of {groupId, optionId, quantity}
)
RETURNS TABLE (
    is_valid BOOLEAN,
    total_price_adjustment DECIMAL(10,2),
    validated_selections JSONB,
    validation_errors TEXT[]
) AS $$
DECLARE
    v_selection JSONB;
    v_option RECORD;
    v_group RECORD;
    v_total DECIMAL(10,2) := 0;
    v_validated JSONB := '[]'::JSONB;
    v_errors TEXT[] := '{}';
    v_group_counts JSONB := '{}';
    v_price_multiplier DECIMAL(10,4);
    v_is_valid BOOLEAN := true;
BEGIN
    -- Process each selection
    FOR v_selection IN SELECT * FROM jsonb_array_elements(COALESCE(p_selections, '[]'::JSONB))
    LOOP
        -- Get option details with group info
        SELECT 
            co.*,
            cg.name as group_name,
            cg.selection_mode,
            cg.min_selections,
            cg.max_selections,
            cg.is_required,
            COALESCE(ec.price_multiplier, 1.0) as price_multiplier,
            COALESCE(ec.min_selections_override, cg.min_selections) as effective_min,
            COALESCE(ec.max_selections_override, cg.max_selections) as effective_max,
            COALESCE(ec.is_required_override, cg.is_required) as effective_required
        INTO v_option
        FROM customization_options co
        JOIN customization_groups cg ON co.group_id = cg.id
        LEFT JOIN entity_customizations ec ON ec.customization_group_id = cg.id
            AND ec.entity_type = p_entity_type
            AND ec.entity_id = p_entity_id
        WHERE co.id = (v_selection->>'optionId')::UUID
        AND co.is_available = true
        AND co.deleted_at IS NULL
        AND cg.deleted_at IS NULL;

        IF v_option IS NULL THEN
            v_errors := array_append(v_errors, 'Option not found or unavailable: ' || (v_selection->>'optionId'));
            v_is_valid := false;
            CONTINUE;
        END IF;

        -- Check stock availability
        IF v_option.available_stock IS NOT NULL AND v_option.available_stock < COALESCE((v_selection->>'quantity')::INT, 1) THEN
            v_errors := array_append(v_errors, 'Insufficient stock for: ' || v_option.name);
            v_is_valid := false;
            CONTINUE;
        END IF;

        -- Check per-option quantity bounds (NEW: was never enforced server-side)
        IF COALESCE((v_selection->>'quantity')::INT, 1) < 1 THEN
            v_errors := array_append(v_errors, 'Invalid quantity for: ' || v_option.name);
            v_is_valid := false;
            CONTINUE;
        END IF;
        IF COALESCE((v_selection->>'quantity')::INT, 1) > v_option.max_quantity THEN
            v_errors := array_append(v_errors, v_option.name || ' allows at most ' || v_option.max_quantity || ' per selection');
            v_is_valid := false;
            CONTINUE;
        END IF;

        -- Calculate price adjustment based on type
        DECLARE
            v_qty INT := COALESCE((v_selection->>'quantity')::INT, 1);
            v_price DECIMAL(10,2);
        BEGIN
            IF v_option.customization_type IN ('add', 'upgrade', 'swap') THEN
                v_price := v_option.price_adjustment * v_option.price_multiplier * v_qty;
                v_total := v_total + v_price;
            ELSIF v_option.customization_type = 'remove' THEN
                -- Remove type can have negative price (discount) or zero
                v_price := LEAST(v_option.price_adjustment * v_option.price_multiplier, 0) * v_qty;
                v_total := v_total + v_price;
            END IF;
        END;

        -- Build validated selection object
        v_validated := v_validated || jsonb_build_object(
            'groupId', v_option.group_id,
            'groupName', v_option.group_name,
            'optionId', v_option.id,
            'optionName', v_option.name,
            'customizationType', v_option.customization_type,
            'quantity', COALESCE((v_selection->>'quantity')::INT, 1),
            'unitPrice', v_option.price_adjustment * v_option.price_multiplier,
            'totalPrice', v_option.price_adjustment * v_option.price_multiplier * COALESCE((v_selection->>'quantity')::INT, 1),
            'inventoryItemId', v_option.inventory_item_id,
            'quantityPerSelection', v_option.quantity_per_selection,
            'replacesInventoryItemId', v_option.replaces_inventory_item_id
        );

        -- Track group counts for validation
        v_group_counts := jsonb_set(
            v_group_counts,
            ARRAY[v_option.group_id::TEXT],
            to_jsonb(COALESCE((v_group_counts->>v_option.group_id::TEXT)::INT, 0) + COALESCE((v_selection->>'quantity')::INT, 1))
        );
    END LOOP;

    -- Validate group requirements
    FOR v_group IN 
        SELECT DISTINCT
            cg.id,
            cg.name,
            COALESCE(ec.min_selections_override, cg.min_selections) as min_selections,
            COALESCE(ec.max_selections_override, cg.max_selections) as max_selections,
            COALESCE(ec.is_required_override, cg.is_required) as is_required
        FROM customization_groups cg
        LEFT JOIN entity_customizations ec ON ec.customization_group_id = cg.id
            AND ec.entity_type = p_entity_type
            AND ec.entity_id = p_entity_id
            AND ec.is_enabled = true
        WHERE cg.deleted_at IS NULL
        AND cg.is_available = true
        AND (ec.id IS NOT NULL OR (cg.is_global = true AND p_entity_type = ANY(cg.applicable_entity_types)))
    LOOP
        DECLARE
            v_count INT := COALESCE((v_group_counts->>v_group.id::TEXT)::INT, 0);
        BEGIN
            IF v_group.is_required AND v_count = 0 THEN
                v_errors := array_append(v_errors, 'Required selection missing: ' || v_group.name);
                v_is_valid := false;
            ELSIF v_count > 0 AND v_count < v_group.min_selections THEN
                v_errors := array_append(v_errors, v_group.name || ' requires at least ' || v_group.min_selections || ' selection(s)');
                v_is_valid := false;
            ELSIF v_count > v_group.max_selections THEN
                v_errors := array_append(v_errors, v_group.name || ' allows at most ' || v_group.max_selections || ' selection(s)');
                v_is_valid := false;
            END IF;
        END;
    END LOOP;

    RETURN QUERY SELECT v_is_valid, v_total, v_validated, v_errors;
END;
$$ LANGUAGE plpgsql;
