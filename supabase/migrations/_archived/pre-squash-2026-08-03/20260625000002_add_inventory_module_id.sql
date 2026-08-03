-- Add module_id column to inventory_categories for multi-tenant module isolation
ALTER TABLE inventory_categories ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

-- Add module_id column to inventory_items for multi-tenant module isolation
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
