-- Add category column if it doesn't exist
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';

-- Drop the specific unique constraint on key if it exists
ALTER TABLE site_settings DROP CONSTRAINT IF EXISTS site_settings_key_key;

-- Add new constraint
DO $$ BEGIN
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_category_key_key UNIQUE (category, key);
EXCEPTION WHEN duplicate_object THEN 
    NULL;
END $$;
