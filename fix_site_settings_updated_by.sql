-- SQL script to add the missing updated_by column to site_settings table
-- Run this directly on your database to fix the schema issue

-- Add the missing updated_by column
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN site_settings.updated_by IS 'User who last updated this setting';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'site_settings' AND table_schema = 'public'
ORDER BY ordinal_position;
