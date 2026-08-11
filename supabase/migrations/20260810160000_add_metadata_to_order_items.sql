-- Add metadata JSONB column to order_items table
-- This column stores flexible data like selectedModifiers for customizations
ALTER TABLE "public"."order_items" 
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN "public"."order_items".metadata IS 'Flexible JSONB storage for item-specific data (e.g., selectedModifiers for customizations)';
