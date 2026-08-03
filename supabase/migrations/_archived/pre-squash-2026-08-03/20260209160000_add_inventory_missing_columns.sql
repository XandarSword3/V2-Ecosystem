-- Add missing created_by column to inventory_items table (no FK to avoid auth.users issues)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS created_by UUID;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
