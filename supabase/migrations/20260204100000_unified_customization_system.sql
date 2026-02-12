-- =============================================
-- UNIFIED CUSTOMIZATION SYSTEM
-- Module-agnostic customization engine for all present and future modules
-- Supports: Restaurant, Chalets, Pool, Snack Bar, Spa, Activities, and ANY future module
-- =============================================

-- 1. Create enum for customization types (what happens when selected)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customization_type') THEN
        CREATE TYPE customization_type AS ENUM ('add', 'remove', 'swap', 'upgrade', 'replace');
    END IF;
END$$;

-- 2. Create enum for entity types (what modules can use customizations)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customizable_entity_type') THEN
        CREATE TYPE customizable_entity_type AS ENUM (
            'menu_item',       -- Restaurant menu items
            'snack_bar_item',  -- Snack bar items
            'chalet',          -- Chalet/accommodation units
            'pool_session',    -- Pool sessions/bookings
            'spa_service',     -- Spa services (future)
            'activity',        -- Activities/excursions (future)
            'rental_item',     -- Equipment rentals (future)
            'event_ticket',    -- Events/shows (future)
            'room',            -- Hotel rooms (future)
            'package'          -- Bundled packages (future)
        );
    END IF;
END$$;

-- 3. Create unified customization groups table (module-agnostic)
CREATE TABLE IF NOT EXISTS customization_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    name TEXT NOT NULL,
    name_ar TEXT,
    name_fr TEXT,
    description TEXT,
    description_ar TEXT,
    
    -- Display
    display_name TEXT, -- Customer-facing name (e.g., "How would you like it?")
    display_name_ar TEXT,
    icon TEXT, -- Lucide icon name
    
    -- Selection rules
    selection_mode TEXT NOT NULL DEFAULT 'single' CHECK (selection_mode IN ('single', 'multiple', 'quantity')),
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT false,
    
    -- Applicability
    applicable_entity_types customizable_entity_type[] DEFAULT '{}', -- Which module types can use this group
    is_global BOOLEAN DEFAULT false, -- If true, available to all entities of applicable types
    
    -- Availability
    is_available BOOLEAN DEFAULT true,
    available_from TIME,
    available_until TIME,
    available_days INTEGER[], -- 0=Sunday, 1=Monday, etc.
    
    -- Conditional display (JSON rules)
    display_conditions JSONB DEFAULT '{}', -- e.g., {"min_order_total": 50, "requires_membership": true}
    
    -- Sorting
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT valid_selection_range CHECK (min_selections <= max_selections)
);

-- 4. Create unified customization options table
CREATE TABLE IF NOT EXISTS customization_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
    
    -- Identity
    name TEXT NOT NULL,
    name_ar TEXT,
    name_fr TEXT,
    description TEXT,
    description_ar TEXT,
    
    -- Type and behavior
    customization_type customization_type NOT NULL DEFAULT 'add',
    
    -- Pricing
    price_adjustment DECIMAL(10,2) DEFAULT 0, -- Can be negative for discounts
    price_type TEXT DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'percentage', 'per_unit', 'per_night', 'per_person')),
    
    -- Inventory integration
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    quantity_per_selection DECIMAL(10,3) DEFAULT 1, -- How much inventory to consume
    inventory_unit TEXT DEFAULT 'pcs',
    
    -- For 'swap' type: what it replaces
    replaces_inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    
    -- Quantity options (for quantity selection mode)
    max_quantity INTEGER DEFAULT 1,
    quantity_increment DECIMAL(10,2) DEFAULT 1,
    
    -- Display
    is_default BOOLEAN DEFAULT false,
    is_popular BOOLEAN DEFAULT false,
    badge_text TEXT, -- e.g., "Popular", "New", "Limited"
    badge_color TEXT,
    image_url TEXT,
    
    -- Availability
    is_available BOOLEAN DEFAULT true,
    available_stock INTEGER, -- NULL = unlimited, 0 = sold out
    
    -- Sorting
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 5. Create entity-to-customization linking table (many-to-many)
CREATE TABLE IF NOT EXISTS entity_customizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity reference (polymorphic)
    entity_type customizable_entity_type NOT NULL,
    entity_id UUID NOT NULL, -- References the actual entity (menu_item, chalet, etc.)
    
    -- Customization group
    customization_group_id UUID NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
    
    -- Override settings for this specific entity
    is_required_override BOOLEAN, -- Overrides group.is_required
    min_selections_override INTEGER,
    max_selections_override INTEGER,
    price_multiplier DECIMAL(10,4) DEFAULT 1.0, -- Scale prices for this entity
    
    -- Entity-specific availability
    is_enabled BOOLEAN DEFAULT true,
    
    -- Sorting
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(entity_type, entity_id, customization_group_id)
);

-- 6. Create order/booking customization storage table (immutable snapshot)
CREATE TABLE IF NOT EXISTS order_customizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Order reference (polymorphic)
    order_type TEXT NOT NULL, -- 'restaurant_order', 'chalet_booking', 'pool_booking', 'snack_bar_order', etc.
    order_id UUID NOT NULL,
    order_item_id UUID, -- For item-level customizations (nullable for booking-level)
    
    -- Snapshot of selection (immutable record)
    customization_group_id UUID REFERENCES customization_groups(id) ON DELETE SET NULL,
    customization_option_id UUID REFERENCES customization_options(id) ON DELETE SET NULL,
    
    -- Snapshot of values at time of order (for audit trail)
    group_name TEXT NOT NULL,
    option_name TEXT NOT NULL,
    customization_type TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    
    -- Pricing at time of order
    unit_price_adjustment DECIMAL(10,2) DEFAULT 0,
    total_price_adjustment DECIMAL(10,2) DEFAULT 0,
    
    -- Inventory snapshot
    inventory_item_id UUID,
    inventory_quantity_used DECIMAL(10,3),
    inventory_deducted BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create function to get available customizations for an entity
CREATE OR REPLACE FUNCTION get_entity_customizations(
    p_entity_type customizable_entity_type,
    p_entity_id UUID
)
RETURNS TABLE (
    group_id UUID,
    group_name TEXT,
    group_name_ar TEXT,
    display_name TEXT,
    display_name_ar TEXT,
    selection_mode TEXT,
    min_selections INTEGER,
    max_selections INTEGER,
    is_required BOOLEAN,
    sort_order INTEGER,
    options JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH entity_groups AS (
        -- Get explicitly linked groups
        SELECT 
            cg.id,
            cg.name,
            cg.name_ar,
            cg.display_name,
            cg.display_name_ar,
            cg.selection_mode,
            COALESCE(ec.min_selections_override, cg.min_selections) as min_selections,
            COALESCE(ec.max_selections_override, cg.max_selections) as max_selections,
            COALESCE(ec.is_required_override, cg.is_required) as is_required,
            COALESCE(ec.sort_order, cg.sort_order) as sort_order,
            COALESCE(ec.price_multiplier, 1.0) as price_multiplier
        FROM customization_groups cg
        LEFT JOIN entity_customizations ec ON ec.customization_group_id = cg.id
            AND ec.entity_type = p_entity_type
            AND ec.entity_id = p_entity_id
            AND ec.is_enabled = true
        WHERE cg.deleted_at IS NULL
        AND cg.is_available = true
        AND (
            -- Explicitly linked to this entity
            ec.id IS NOT NULL
            OR 
            -- Global group for this entity type
            (cg.is_global = true AND p_entity_type = ANY(cg.applicable_entity_types))
        )
        -- Time-based availability
        AND (cg.available_from IS NULL OR CURRENT_TIME >= cg.available_from)
        AND (cg.available_until IS NULL OR CURRENT_TIME <= cg.available_until)
        AND (cg.available_days IS NULL OR EXTRACT(DOW FROM CURRENT_DATE)::INTEGER = ANY(cg.available_days))
    )
    SELECT 
        eg.id,
        eg.name,
        eg.name_ar,
        eg.display_name,
        eg.display_name_ar,
        eg.selection_mode,
        eg.min_selections,
        eg.max_selections,
        eg.is_required,
        eg.sort_order,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', co.id,
                    'name', co.name,
                    'name_ar', co.name_ar,
                    'description', co.description,
                    'customizationType', co.customization_type,
                    'priceAdjustment', co.price_adjustment * eg.price_multiplier,
                    'priceType', co.price_type,
                    'maxQuantity', co.max_quantity,
                    'isDefault', co.is_default,
                    'isPopular', co.is_popular,
                    'badgeText', co.badge_text,
                    'imageUrl', co.image_url,
                    'isAvailable', co.is_available AND (co.available_stock IS NULL OR co.available_stock > 0),
                    'inventoryItemId', co.inventory_item_id,
                    'quantityPerSelection', co.quantity_per_selection,
                    'sortOrder', co.sort_order
                ) ORDER BY co.sort_order, co.name
            ) FILTER (WHERE co.id IS NOT NULL),
            '[]'::JSONB
        ) as options
    FROM entity_groups eg
    LEFT JOIN customization_options co ON co.group_id = eg.id
        AND co.deleted_at IS NULL
        AND co.is_available = true
    GROUP BY eg.id, eg.name, eg.name_ar, eg.display_name, eg.display_name_ar,
             eg.selection_mode, eg.min_selections, eg.max_selections, eg.is_required, eg.sort_order
    ORDER BY eg.sort_order, eg.name;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to validate customization selections
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

-- 9. Create function to process inventory for customizations (generic for all modules)
CREATE OR REPLACE FUNCTION process_customization_inventory(
    p_order_type TEXT,
    p_order_id UUID,
    p_order_item_id UUID,
    p_selections JSONB, -- validated selections from validate_customizations
    p_base_quantity INT DEFAULT 1 -- number of items/nights/units
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
                        
                        v_added := v_added + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'deducted',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );
                    END IF;
                END IF;
                
            WHEN 'swap' THEN
                -- Deduct the new item
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
$$ LANGUAGE plpgsql;

-- 10. Create function to get customizations for an order (for display/receipt)
CREATE OR REPLACE FUNCTION get_order_customizations(
    p_order_type TEXT,
    p_order_id UUID,
    p_order_item_id UUID DEFAULT NULL
)
RETURNS TABLE (
    group_name TEXT,
    options JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        oc.group_name,
        jsonb_agg(
            jsonb_build_object(
                'name', oc.option_name,
                'type', oc.customization_type,
                'quantity', oc.quantity,
                'priceAdjustment', oc.total_price_adjustment
            ) ORDER BY oc.created_at
        ) as options
    FROM order_customizations oc
    WHERE oc.order_type = p_order_type
    AND oc.order_id = p_order_id
    AND (p_order_item_id IS NULL OR oc.order_item_id = p_order_item_id)
    GROUP BY oc.group_name, oc.customization_group_id
    ORDER BY MIN(oc.created_at);
END;
$$ LANGUAGE plpgsql;

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customization_groups_entity_types 
    ON customization_groups USING GIN(applicable_entity_types) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customization_options_group 
    ON customization_options(group_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customization_options_inventory 
    ON customization_options(inventory_item_id) 
    WHERE inventory_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_customizations_lookup 
    ON entity_customizations(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_customizations_group 
    ON entity_customizations(customization_group_id);

CREATE INDEX IF NOT EXISTS idx_order_customizations_order 
    ON order_customizations(order_type, order_id);

CREATE INDEX IF NOT EXISTS idx_order_customizations_item 
    ON order_customizations(order_item_id) 
    WHERE order_item_id IS NOT NULL;

-- 12. Enable RLS
ALTER TABLE customization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_customizations ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies
-- Customization groups: readable by all, writable by admin/staff
CREATE POLICY "customization_groups_read" ON customization_groups 
    FOR SELECT USING (true);

CREATE POLICY "customization_groups_write" ON customization_groups 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Customization options: readable by all, writable by admin/staff
CREATE POLICY "customization_options_read" ON customization_options 
    FOR SELECT USING (true);

CREATE POLICY "customization_options_write" ON customization_options 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Entity customizations: readable by all, writable by admin/staff
CREATE POLICY "entity_customizations_read" ON entity_customizations 
    FOR SELECT USING (true);

CREATE POLICY "entity_customizations_write" ON entity_customizations 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Order customizations: readable based on order ownership, writable by system
CREATE POLICY "order_customizations_all" ON order_customizations 
    FOR ALL USING (true);

-- 14. Add helper function to add entity type (for future modules)
CREATE OR REPLACE FUNCTION add_customizable_entity_type(p_type_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TYPE customizable_entity_type ADD VALUE IF NOT EXISTS %L', p_type_name);
END;
$$ LANGUAGE plpgsql;

-- 15. Create migration helper to port existing menu modifiers to new system
CREATE OR REPLACE FUNCTION migrate_menu_modifiers_to_unified()
RETURNS TABLE (
    groups_migrated INT,
    options_migrated INT,
    links_migrated INT
) AS $$
DECLARE
    v_groups INT := 0;
    v_options INT := 0;
    v_links INT := 0;
    v_old_group RECORD;
    v_old_option RECORD;
    v_old_link RECORD;
    v_new_group_id UUID;
BEGIN
    -- Migrate groups
    FOR v_old_group IN 
        SELECT * FROM menu_modifier_groups WHERE deleted_at IS NULL
    LOOP
        INSERT INTO customization_groups (
            id, name, name_ar, description, 
            selection_mode, min_selections, max_selections, is_required,
            applicable_entity_types, sort_order, created_at
        ) VALUES (
            v_old_group.id,
            v_old_group.name,
            v_old_group.name_ar,
            v_old_group.description,
            CASE WHEN v_old_group.max_selections > 1 THEN 'multiple' ELSE 'single' END,
            COALESCE(v_old_group.min_selections, 0),
            COALESCE(v_old_group.max_selections, 1),
            COALESCE(v_old_group.is_required, false),
            ARRAY['menu_item', 'snack_bar_item']::customizable_entity_type[],
            COALESCE(v_old_group.sort_order, 0),
            v_old_group.created_at
        )
        ON CONFLICT (id) DO NOTHING;
        
        IF FOUND THEN v_groups := v_groups + 1; END IF;
    END LOOP;

    -- Migrate options
    FOR v_old_option IN 
        SELECT * FROM menu_modifier_options WHERE deleted_at IS NULL
    LOOP
        INSERT INTO customization_options (
            id, group_id, name, name_ar, description,
            customization_type, price_adjustment, price_type,
            inventory_item_id, quantity_per_selection, inventory_unit,
            max_quantity, is_default, is_available, sort_order, created_at
        ) VALUES (
            v_old_option.id,
            v_old_option.modifier_group_id,
            v_old_option.name,
            v_old_option.name_ar,
            v_old_option.description,
            COALESCE(v_old_option.modifier_type, 'add')::customization_type,
            COALESCE(v_old_option.price_adjustment, 0),
            'fixed',
            v_old_option.inventory_item_id,
            COALESCE(v_old_option.quantity_required, 1),
            COALESCE(v_old_option.unit, 'pcs'),
            COALESCE(v_old_option.max_quantity, 1),
            COALESCE(v_old_option.is_default, false),
            COALESCE(v_old_option.is_available, true),
            COALESCE(v_old_option.sort_order, 0),
            v_old_option.created_at
        )
        ON CONFLICT (id) DO NOTHING;
        
        IF FOUND THEN v_options := v_options + 1; END IF;
    END LOOP;

    -- Migrate menu item links
    FOR v_old_link IN 
        SELECT * FROM menu_item_modifiers
    LOOP
        INSERT INTO entity_customizations (
            entity_type, entity_id, customization_group_id, sort_order, created_at
        ) VALUES (
            'menu_item',
            v_old_link.menu_item_id,
            v_old_link.modifier_group_id,
            COALESCE(v_old_link.sort_order, 0),
            v_old_link.created_at
        )
        ON CONFLICT (entity_type, entity_id, customization_group_id) DO NOTHING;
        
        IF FOUND THEN v_links := v_links + 1; END IF;
    END LOOP;

    RETURN QUERY SELECT v_groups, v_options, v_links;
END;
$$ LANGUAGE plpgsql;

-- 16. Add documentation
COMMENT ON TABLE customization_groups IS 'Unified customization groups for all modules (restaurant, chalets, pool, etc.)';
COMMENT ON TABLE customization_options IS 'Individual customization options within groups';
COMMENT ON TABLE entity_customizations IS 'Links customization groups to specific entities (menu items, chalets, etc.)';
COMMENT ON TABLE order_customizations IS 'Immutable snapshot of customizations applied to orders/bookings';

COMMENT ON TYPE customizable_entity_type IS 'All entity types that support customizations. Use add_customizable_entity_type() to add new types.';
COMMENT ON TYPE customization_type IS 'How the customization affects the item: add (include extra), remove (exclude from recipe), swap (replace), upgrade (premium version), replace (full replacement)';

COMMENT ON FUNCTION get_entity_customizations IS 'Get all available customization groups and options for an entity';
COMMENT ON FUNCTION validate_customizations IS 'Validate selections, check availability, calculate prices';
COMMENT ON FUNCTION process_customization_inventory IS 'Deduct/track inventory for customizations';
COMMENT ON FUNCTION get_order_customizations IS 'Retrieve customizations for an order (for receipts, staff display)';
COMMENT ON FUNCTION migrate_menu_modifiers_to_unified IS 'One-time migration from old menu_modifier_* tables to unified system';
