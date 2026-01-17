-- Migration: Add gender restriction field to pool sessions
-- This allows sessions to be restricted to specific genders (e.g., women-only, men-only)

-- Create the gender restriction enum type
DO $$ BEGIN
  CREATE TYPE pool_gender_restriction AS ENUM ('mixed', 'male', 'female');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add gender_restriction column to pool_sessions
ALTER TABLE pool_sessions 
ADD COLUMN IF NOT EXISTS gender_restriction pool_gender_restriction DEFAULT 'mixed';

-- Create index for gender-based queries
CREATE INDEX IF NOT EXISTS idx_pool_sessions_gender ON pool_sessions(gender_restriction);

-- Add comment explaining the column
COMMENT ON COLUMN pool_sessions.gender_restriction IS 'Restricts session access by gender: mixed (all genders), male (men only), female (women only)';
