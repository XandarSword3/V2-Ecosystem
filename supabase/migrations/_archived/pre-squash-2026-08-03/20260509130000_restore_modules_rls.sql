-- =============================================
-- RESTORE MODULES RLS POLICIES
-- =============================================
-- The previous migration 20260509090000_enable_rls_core_tables.sql
-- had its RLS policies for the modules table accidentally removed.
-- This migration restores those policies.

-- Ensure RLS is enabled on modules table
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS modules_property_isolation ON modules;

-- Create property isolation policy for modules
CREATE POLICY modules_property_isolation ON modules
  FOR ALL
  USING (property_id IN (
    SELECT property_id FROM user_property_access 
    WHERE user_id = auth.uid()
  ));

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON modules TO authenticated;

-- Grant sequence usage if sequence exists (may not exist if using UUID PK)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'modules_id_seq') THEN
    GRANT USAGE ON SEQUENCE modules_id_seq TO authenticated;
  END IF;
END $$;
