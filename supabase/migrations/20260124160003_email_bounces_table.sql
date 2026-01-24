-- V2 Resort: Email Bounces and Suppression Table Migration
-- Stores email bounce records and suppression list
-- Production Hardening Phase 1.4

-- Create enum for bounce type
DO $$ BEGIN
    CREATE TYPE bounce_type AS ENUM (
      'hard',
      'soft',
      'complaint',
      'unsubscribe'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create email_bounces table
CREATE TABLE IF NOT EXISTS email_bounces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  bounce_type bounce_type NOT NULL,
  bounce_subtype TEXT,
  reason TEXT NOT NULL,
  provider_message_id TEXT,
  bounced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for email_bounces
CREATE INDEX IF NOT EXISTS idx_email_bounces_email ON email_bounces(email);
CREATE INDEX IF NOT EXISTS idx_email_bounces_type ON email_bounces(bounce_type);
CREATE INDEX IF NOT EXISTS idx_email_bounces_bounced_at ON email_bounces(bounced_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_bounces_soft_recent ON email_bounces(email, bounced_at) 
  WHERE bounce_type = 'soft';

-- Add comment for documentation
COMMENT ON TABLE email_bounces IS 'Stores email bounce events for tracking and suppression management';

-- Enable RLS
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_bounces
DROP POLICY IF EXISTS "Admins can view email bounces" ON email_bounces;
CREATE POLICY "Admins can view email bounces"
  ON email_bounces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Service role has full access to email_bounces" ON email_bounces;
CREATE POLICY "Service role has full access to email_bounces"
  ON email_bounces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create suppression reason type
DO $$ BEGIN
    CREATE TYPE suppression_reason AS ENUM (
      'hard',
      'soft',
      'complaint',
      'unsubscribe',
      'manual'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create email_suppression_list table
CREATE TABLE IF NOT EXISTS email_suppression_list (
  email TEXT PRIMARY KEY,
  reason suppression_reason NOT NULL,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES users(id)
);

-- Create indexes for suppression list
CREATE INDEX IF NOT EXISTS idx_suppression_list_reason ON email_suppression_list(reason);
CREATE INDEX IF NOT EXISTS idx_suppression_list_added_at ON email_suppression_list(added_at DESC);

-- Add comment for documentation
COMMENT ON TABLE email_suppression_list IS 'Stores emails that should not receive marketing or transactional emails';

-- Enable RLS
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_suppression_list
DROP POLICY IF EXISTS "Admins can view suppression list" ON email_suppression_list;
CREATE POLICY "Admins can view suppression list"
  ON email_suppression_list FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins can manage suppression list" ON email_suppression_list;
CREATE POLICY "Admins can manage suppression list"
  ON email_suppression_list FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Service role has full access to suppression_list" ON email_suppression_list;
CREATE POLICY "Service role has full access to suppression_list"
  ON email_suppression_list FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_suppression_list
    WHERE email = LOWER(check_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get suppression stats
CREATE OR REPLACE FUNCTION get_suppression_stats()
RETURNS TABLE (
  reason suppression_reason,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT esl.reason, COUNT(*)::BIGINT
  FROM email_suppression_list esl
  GROUP BY esl.reason
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
