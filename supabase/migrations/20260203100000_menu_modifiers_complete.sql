-- =============================================
-- Complete Menu Modifiers System
-- Supports: Item-specific modifiers, add/remove types, inventory integration, order storage
-- =============================================

-- 1. Add modifier type to distinguish ADD vs REMOVE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modifier_option_type') THEN
        CREATE TYPE modifier_option_type AS ENUM ('add', 'remove', 'swap');
    END IF;
END$$;

-- 2. Enhance menu_modifier_options with inventory linking and type
ALTER TABLE menu_modifier_options 
    ADD COLUMN IF NOT EXISTS modifier_type TEXT DEFAULT 'add',
    ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS quantity_required DECIMAL(10,3) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS description_ar TEXT,
    ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Add constraint to ensure modifier_type is valid
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_modifier_type') THEN
        ALTER TABLE menu_modifier_options 
            ADD CONSTRAINT chk_modifier_type CHECK (modifier_type IN ('add', 'remove', 'swap'));
    END IF;
END$$;

-- 3. Add translations to modifier groups
ALTER TABLE menu_modifier_groups
    ADD COLUMN IF NOT EXISTS name_ar TEXT,
    ADD COLUMN IF NOT EXISTS name_fr TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS allow_multiple_same BOOLEAN DEFAULT false;

-- 4. Add selected_modifiers and modifier_total to restaurant_order_items
ALTER TABLE restaurant_order_items 
    ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS modifier_total DECIMAL(10,2) DEFAULT 0;

-- 5. Add modifier columns to snack_bar_order_items if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_bar_order_items') THEN
        ALTER TABLE snack_bar_order_items 
            ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS modifier_total DECIMAL(10,2) DEFAULT 0;
    END IF;
END$$;

-- 6. (Merged with step 5 above)

-- 7. Create a table to link modifiers to snack bar items (only if snack_bar_items exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_bar_items') THEN
        CREATE TABLE IF NOT EXISTS snack_bar_item_modifiers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            item_id UUID NOT NULL REFERENCES snack_bar_items(id) ON DELETE CASCADE,
            modifier_group_id UUID NOT NULL REFERENCES menu_modifier_groups(id) ON DELETE CASCADE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(item_id, modifier_group_id)
        );
    END IF;
END$$;

-- 8. Add modifiers_total to restaurant_orders for summary
ALTER TABLE restaurant_orders 
    ADD COLUMN IF NOT EXISTS modifiers_total DECIMAL(10,2) DEFAULT 0;

-- 9. Add modifiers_total to snack_bar_orders if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_bar_orders') THEN
        ALTER TABLE snack_bar_orders 
            ADD COLUMN IF NOT EXISTS modifiers_total DECIMAL(10,2) DEFAULT 0;
    END IF;
END$$;

-- 10. Create function to calculate modifier price and validate selections
CREATE OR REPLACE FUNCTION calculate_item_modifiers_price(
    p_menu_item_id UUID,
    p_selected_modifiers JSONB
)
RETURNS TABLE (
    total_modifier_price DECIMAL(10,2),
    validated_modifiers JSONB,
    validation_errors TEXT[]
) AS $$
DECLARE
    v_modifier JSONB;
    v_option RECORD;
    v_group RECORD;
    v_total DECIMAL(10,2) := 0;
    v_validated JSONB := '[]'::JSONB;
    v_errors TEXT[] := '{}';
    v_group_counts JSONB := '{}';
BEGIN
    -- Process each selected modifier
    FOR v_modifier IN SELECT * FROM jsonb_array_elements(p_selected_modifiers)
    LOOP
        -- Get modifier option details
        SELECT mo.*, mg.name as group_name, mg.min_selections, mg.max_selections, mg.is_required
        INTO v_option
        FROM menu_modifier_options mo
        JOIN menu_modifier_groups mg ON mo.modifier_group_id = mg.id
        WHERE mo.id = (v_modifier->>'optionId')::UUID
        AND mo.is_available = true
        AND mo.deleted_at IS NULL;

        IF v_option IS NULL THEN
            v_errors := array_append(v_errors, 'Modifier option not found or unavailable');
            CONTINUE;
        END IF;

        -- Verify this modifier group is linked to the menu item
        IF NOT EXISTS (
            SELECT 1 FROM menu_item_modifiers 
            WHERE menu_item_id = p_menu_item_id 
            AND modifier_group_id = v_option.modifier_group_id
        ) THEN
            v_errors := array_append(v_errors, 'Modifier "' || v_option.name || '" is not available for this item');
            CONTINUE;
        END IF;

        -- Calculate price (only for 'add' type modifiers)
        IF v_option.modifier_type = 'add' OR v_option.modifier_type = 'swap' THEN
            v_total := v_total + COALESCE(v_option.price_adjustment, 0) * COALESCE((v_modifier->>'quantity')::INT, 1);
        END IF;

        -- Add to validated list with full details
        v_validated := v_validated || jsonb_build_object(
            'optionId', v_option.id,
            'optionName', v_option.name,
            'groupId', v_option.modifier_group_id,
            'groupName', v_option.group_name,
            'modifierType', v_option.modifier_type,
            'priceAdjustment', v_option.price_adjustment,
            'quantity', COALESCE((v_modifier->>'quantity')::INT, 1),
            'inventoryItemId', v_option.inventory_item_id,
            'inventoryQuantity', v_option.quantity_required
        );

        -- Track group selection counts for validation
        v_group_counts := jsonb_set(
            v_group_counts,
            ARRAY[v_option.modifier_group_id::TEXT],
            to_jsonb(COALESCE((v_group_counts->>v_option.modifier_group_id::TEXT)::INT, 0) + 1)
        );
    END LOOP;

    -- Validate group requirements (min/max selections)
    FOR v_group IN 
        SELECT mg.id, mg.name, mg.min_selections, mg.max_selections, mg.is_required
        FROM menu_item_modifiers mim
        JOIN menu_modifier_groups mg ON mim.modifier_group_id = mg.id
        WHERE mim.menu_item_id = p_menu_item_id
        AND mg.deleted_at IS NULL
    LOOP
        DECLARE
            v_count INT := COALESCE((v_group_counts->>v_group.id::TEXT)::INT, 0);
        BEGIN
            IF v_group.is_required AND v_count = 0 THEN
                v_errors := array_append(v_errors, 'Required modifier group "' || v_group.name || '" has no selection');
            ELSIF v_count < v_group.min_selections THEN
                v_errors := array_append(v_errors, 'Group "' || v_group.name || '" requires at least ' || v_group.min_selections || ' selections');
            ELSIF v_count > v_group.max_selections THEN
                v_errors := array_append(v_errors, 'Group "' || v_group.name || '" allows at most ' || v_group.max_selections || ' selections');
            END IF;
        END;
    END LOOP;

    RETURN QUERY SELECT v_total, v_validated, v_errors;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to deduct inventory for modifiers
CREATE OR REPLACE FUNCTION deduct_modifier_inventory(
    p_order_id UUID,
    p_order_items JSONB -- Array of {menu_item_id, quantity, selected_modifiers}
)
RETURNS TABLE (
    items_deducted INT,
    deduction_details JSONB
) AS $$
DECLARE
    v_item JSONB;
    v_modifier JSONB;
    v_inventory_item_id UUID;
    v_quantity_to_deduct DECIMAL(10,3);
    v_deducted INT := 0;
    v_details JSONB := '[]'::JSONB;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        -- Process each modifier in the item
        FOR v_modifier IN SELECT * FROM jsonb_array_elements(v_item->'selected_modifiers')
        LOOP
            -- Only deduct inventory for 'add' modifiers (not 'remove')
            IF (v_modifier->>'modifierType') = 'add' THEN
                v_inventory_item_id := (v_modifier->>'inventoryItemId')::UUID;
                
                IF v_inventory_item_id IS NOT NULL THEN
                    v_quantity_to_deduct := COALESCE((v_modifier->>'inventoryQuantity')::DECIMAL, 1) 
                                          * COALESCE((v_modifier->>'quantity')::INT, 1)
                                          * COALESCE((v_item->>'quantity')::INT, 1);
                    
                    -- Deduct from inventory
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_quantity_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inventory_item_id
                    AND current_stock >= v_quantity_to_deduct;
                    
                    IF FOUND THEN
                        -- Log the transaction
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, reference_type, reference_id, notes
                        ) VALUES (
                            v_inventory_item_id, 'sale', -v_quantity_to_deduct, 'order_modifier', p_order_id,
                            'Modifier: ' || (v_modifier->>'optionName')
                        );
                        
                        v_deducted := v_deducted + 1;
                        v_details := v_details || jsonb_build_object(
                            'inventoryItemId', v_inventory_item_id,
                            'modifierName', v_modifier->>'optionName',
                            'quantityDeducted', v_quantity_to_deduct
                        );
                    END IF;
                END IF;
            END IF;
            -- For 'remove' modifiers, we DON'T deduct inventory (e.g., no cheese on cheeseburger)
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_deducted, v_details;
END;
$$ LANGUAGE plpgsql;

-- 12. Update the menu item ingredients deduction to skip removed modifiers
CREATE OR REPLACE FUNCTION deduct_inventory_for_order_v2(
    p_order_id UUID
)
RETURNS TABLE (
    base_items_deducted INT,
    modifier_items_deducted INT,
    skipped_removals INT
) AS $$
DECLARE
    v_order_item RECORD;
    v_ingredient RECORD;
    v_removed_ingredients UUID[];
    v_base_deducted INT := 0;
    v_modifier_deducted INT := 0;
    v_skipped INT := 0;
BEGIN
    -- Process each order item
    FOR v_order_item IN 
        SELECT oi.*, mi.name as item_name
        FROM restaurant_order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = p_order_id
    LOOP
        -- Get list of inventory items to SKIP (from 'remove' modifiers)
        SELECT array_agg(DISTINCT (m->>'inventoryItemId')::UUID)
        INTO v_removed_ingredients
        FROM jsonb_array_elements(v_order_item.selected_modifiers) m
        WHERE (m->>'modifierType') = 'remove'
        AND (m->>'inventoryItemId') IS NOT NULL;

        -- Deduct base recipe ingredients (excluding removed items)
        FOR v_ingredient IN
            SELECT mii.inventory_item_id, mii.quantity_required, ii.name as ingredient_name
            FROM menu_item_ingredients mii
            JOIN inventory_items ii ON mii.inventory_item_id = ii.id
            WHERE mii.menu_item_id = v_order_item.menu_item_id
        LOOP
            -- Skip if this ingredient was removed by a modifier
            IF v_ingredient.inventory_item_id = ANY(COALESCE(v_removed_ingredients, '{}')) THEN
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;

            -- Deduct the ingredient
            UPDATE inventory_items 
            SET current_stock = current_stock - (v_ingredient.quantity_required * v_order_item.quantity),
                updated_at = NOW()
            WHERE id = v_ingredient.inventory_item_id
            AND current_stock >= (v_ingredient.quantity_required * v_order_item.quantity);
            
            IF FOUND THEN
                INSERT INTO inventory_transactions (
                    item_id, transaction_type, quantity, reference_type, reference_id, notes
                ) VALUES (
                    v_ingredient.inventory_item_id, 'sale', 
                    -(v_ingredient.quantity_required * v_order_item.quantity),
                    'order', p_order_id,
                    'Order item: ' || v_order_item.item_name
                );
                v_base_deducted := v_base_deducted + 1;
            END IF;
        END LOOP;

        -- Deduct 'add' modifier ingredients
        FOR v_ingredient IN
            SELECT 
                (m->>'inventoryItemId')::UUID as inventory_item_id,
                COALESCE((m->>'inventoryQuantity')::DECIMAL, 1) as quantity_required,
                (m->>'optionName') as modifier_name,
                COALESCE((m->>'quantity')::INT, 1) as modifier_qty
            FROM jsonb_array_elements(v_order_item.selected_modifiers) m
            WHERE (m->>'modifierType') = 'add'
            AND (m->>'inventoryItemId') IS NOT NULL
        LOOP
            UPDATE inventory_items 
            SET current_stock = current_stock - (v_ingredient.quantity_required * v_ingredient.modifier_qty * v_order_item.quantity),
                updated_at = NOW()
            WHERE id = v_ingredient.inventory_item_id
            AND current_stock >= (v_ingredient.quantity_required * v_ingredient.modifier_qty * v_order_item.quantity);
            
            IF FOUND THEN
                INSERT INTO inventory_transactions (
                    item_id, transaction_type, quantity, reference_type, reference_id, notes
                ) VALUES (
                    v_ingredient.inventory_item_id, 'sale', 
                    -(v_ingredient.quantity_required * v_ingredient.modifier_qty * v_order_item.quantity),
                    'order_modifier', p_order_id,
                    'Modifier: ' || v_ingredient.modifier_name
                );
                v_modifier_deducted := v_modifier_deducted + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_base_deducted, v_modifier_deducted, v_skipped;
END;
$$ LANGUAGE plpgsql;

-- 13. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON menu_modifier_options(modifier_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_modifier_options_inventory ON menu_modifier_options(inventory_item_id) WHERE inventory_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_modifiers_item ON menu_item_modifiers(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_modifiers ON restaurant_order_items USING GIN(selected_modifiers) WHERE selected_modifiers != '[]'::JSONB;

-- 14. Enable RLS on new table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_bar_item_modifiers') THEN
        ALTER TABLE snack_bar_item_modifiers ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "snack_modifiers_all" ON snack_bar_item_modifiers;
        CREATE POLICY "snack_modifiers_all" ON snack_bar_item_modifiers FOR ALL USING (true);
    END IF;
END$$;

-- 15. Add comments for documentation
COMMENT ON COLUMN menu_modifier_options.modifier_type IS 'add = adds ingredient/price, remove = removes from recipe (no deduction), swap = replaces ingredient';
COMMENT ON COLUMN menu_modifier_options.inventory_item_id IS 'Links to inventory_items for automatic deduction on orders';
COMMENT ON COLUMN menu_modifier_options.quantity_required IS 'How much inventory to deduct per modifier quantity';
COMMENT ON COLUMN restaurant_order_items.selected_modifiers IS 'JSONB array of {optionId, optionName, groupId, groupName, modifierType, priceAdjustment, quantity, inventoryItemId, inventoryQuantity}';
COMMENT ON FUNCTION calculate_item_modifiers_price IS 'Validates modifier selections against item config and calculates total price adjustment';
COMMENT ON FUNCTION deduct_inventory_for_order_v2 IS 'Deducts inventory for order items and modifiers, respecting "remove" modifiers that skip ingredients';
