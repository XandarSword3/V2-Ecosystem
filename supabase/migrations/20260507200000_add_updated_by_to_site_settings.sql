-- Add updated_by column to site_settings table
-- This column tracks which user made the last update to site settings

ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add comment to document the column
COMMENT ON COLUMN site_settings.updated_by IS 'User who last updated this setting';
