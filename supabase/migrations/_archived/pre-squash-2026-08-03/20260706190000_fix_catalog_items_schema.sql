-- Fix catalog_items schema to match generic engine config tables
-- Adds missing columns for the refactored dynamic module system
-- This migration bridges the gap between the old base_schema_shim and the new generic_engine_config_tables

BEGIN;

-- Add metadata column (JSONB for flexible storage)
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- Add module_id column (FK to modules table)
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE CASCADE;

-- Add tenant_id column for multi-tenant support (nullable for backward compatibility)
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Add property_id column for property scoping (nullable for backward compatibility)
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS property_id UUID;

-- Add created_at timestamp
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add updated_at timestamp
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create index on module_id for performance
CREATE INDEX IF NOT EXISTS idx_catalog_items_module_id ON catalog_items(module_id);

-- Create index on module_id and is_active for common queries
CREATE INDEX IF NOT EXISTS idx_catalog_items_available ON catalog_items(module_id, is_available);

-- Create index on tenant_id for tenant isolation
CREATE INDEX IF NOT EXISTS idx_catalog_items_tenant_id ON catalog_items(tenant_id);

-- Create index on property_id for property scoping
CREATE INDEX IF NOT EXISTS idx_catalog_items_property_id ON catalog_items(property_id);

-- Add comment to document the schema evolution
COMMENT ON COLUMN catalog_items.metadata IS 'Flexible JSONB storage for module-specific attributes (e.g., name_ar, description_ar, image_url, is_featured, etc.)';
COMMENT ON COLUMN catalog_items.module_id IS 'Reference to the dynamic module this item belongs to (replaces category_id FK)';
COMMENT ON COLUMN catalog_items.tenant_id IS 'Tenant ownership for multi-tenant isolation';
COMMENT ON COLUMN catalog_items.property_id IS 'Property scoping for property-level access control';

COMMIT;
