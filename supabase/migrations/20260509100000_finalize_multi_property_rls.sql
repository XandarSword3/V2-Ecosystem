-- =============================================
-- Final Multi-Property Hardening & RLS Isolation
-- Enforces data silos between different resort properties
-- =============================================

BEGIN;

-- 1. ADD property_id TO MISSING TABLES
ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS inventory_items ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS inventory_categories ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS gift_cards ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS gift_card_templates ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS coupons ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS housekeeping_task_types ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS loyalty_members ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS loyalty_tiers ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS site_settings ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS system_settings ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;

-- 2. DETERMINISTIC BACKFILL
DO $$
DECLARE
    default_prop_id UUID;
BEGIN
    -- Prioritize primary property, fallback to first created
    SELECT id INTO default_prop_id FROM properties ORDER BY is_primary DESC, created_at ASC LIMIT 1;
    
    IF default_prop_id IS NOT NULL THEN
        -- Standard transactional/config tables
        UPDATE restaurant_tables SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE inventory_items SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE inventory_categories SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE gift_cards SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE gift_card_templates SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE coupons SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE housekeeping_tasks SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE housekeeping_task_types SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE loyalty_members SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE loyalty_tiers SET property_id = default_prop_id WHERE property_id IS NULL;
        UPDATE site_settings SET property_id = default_prop_id WHERE property_id IS NULL;
        
        -- System settings: only backfill non-system categories
        UPDATE system_settings SET property_id = default_prop_id 
        WHERE property_id IS NULL AND category NOT IN ('security', 'system');
    END IF;
END $$;

-- 3. REFACTOR UNIQUE CONSTRAINTS TO BE PROPERTY-AWARE
-- restaurant_tables: number should be unique per property
ALTER TABLE IF EXISTS restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_num_prop ON restaurant_tables(property_id, number);

-- inventory_items: sku should be unique per property
ALTER TABLE IF EXISTS inventory_items DROP CONSTRAINT IF EXISTS inventory_items_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_sku_prop ON inventory_items(property_id, sku);

-- coupons: code should be unique per property
ALTER TABLE IF EXISTS coupons DROP CONSTRAINT IF EXISTS coupons_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_prop ON coupons(property_id, code);

-- gift_cards: code should be unique per property
ALTER TABLE IF EXISTS gift_cards DROP CONSTRAINT IF EXISTS gift_cards_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_code_prop ON gift_cards(property_id, code);

-- 4. ENABLE RLS AND ESTABLISH ISOLATION POLICIES
-- We use the pre-existing user_has_property_access(user_id, property_id) function

-- Helper function to apply standard isolation policy
CREATE OR REPLACE FUNCTION apply_property_isolation(target_table TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE 'ALTER TABLE ' || target_table || ' ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ' || target_table || '_isolation ON ' || target_table;
    EXECUTE 'CREATE POLICY ' || target_table || '_isolation ON ' || target_table || 
            ' FOR ALL USING (user_has_property_access(auth.uid(), property_id))';
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
SELECT apply_property_isolation('restaurant_tables');
SELECT apply_property_isolation('inventory_items');
SELECT apply_property_isolation('inventory_categories');
SELECT apply_property_isolation('gift_cards');
SELECT apply_property_isolation('gift_card_templates');
SELECT apply_property_isolation('coupons');
SELECT apply_property_isolation('housekeeping_tasks');
SELECT apply_property_isolation('housekeeping_task_types');
SELECT apply_property_isolation('loyalty_members');
SELECT apply_property_isolation('loyalty_tiers');
SELECT apply_property_isolation('site_settings');
SELECT apply_property_isolation('modules');
SELECT apply_property_isolation('restaurant_orders');
SELECT apply_property_isolation('chalet_bookings');
SELECT apply_property_isolation('pool_tickets');

-- 5. SPECIAL CASE: system_settings
-- Global settings (property_id IS NULL) are readable by all; property settings are isolated
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_settings_isolation ON system_settings;
CREATE POLICY system_settings_isolation ON system_settings
    FOR ALL USING (
        property_id IS NULL 
        OR user_has_property_access(auth.uid(), property_id)
    );

-- Clean up helper
DROP FUNCTION apply_property_isolation(TEXT);

COMMIT;
