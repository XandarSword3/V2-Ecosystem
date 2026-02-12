-- Add missing 'content' column to reviews table if it doesn't exist
-- The original table may have been created with 'comment' instead of 'content'
DO $$ 
BEGIN
    -- Add content column if missing
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content TEXT;
    
    -- If there's a 'comment' column, migrate data to 'content'
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reviews' AND column_name = 'comment') THEN
        UPDATE reviews SET content = comment WHERE content IS NULL AND comment IS NOT NULL;
    END IF;
EXCEPTION WHEN undefined_table THEN
    NULL; -- Table doesn't exist, skip
END $$;

-- Also ensure customer_id column exists (some versions use user_id)
DO $$
BEGIN
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id);
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;
