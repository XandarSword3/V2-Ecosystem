-- V2 Resort: Webhook Failures Table Migration
-- Stores failed webhook events for retry processing
-- Production Hardening Phase 1.2

-- Create enum for webhook status
DO $$ BEGIN
    CREATE TYPE webhook_status AS ENUM (
      'pending',
      'retrying',
      'resolved',
      'failed',
      'manual_review'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for webhook source
DO $$ BEGIN
    CREATE TYPE webhook_source AS ENUM (
      'stripe',
      'twilio',
      'sendgrid',
      'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create webhook_failures table
CREATE TABLE IF NOT EXISTS webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  source webhook_source NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  status webhook_status NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_failures_status ON webhook_failures(status);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_source ON webhook_failures(source);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_event_type ON webhook_failures(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_next_retry_at ON webhook_failures(next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_failures_created_at ON webhook_failures(created_at DESC);

-- Unique constraint to prevent duplicate event processing
-- Using explicit constraint syntax to avoid errors if it exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idx_webhook_failures_event_unique') THEN
    CREATE UNIQUE INDEX idx_webhook_failures_event_unique ON webhook_failures(source, event_id);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE webhook_failures IS 'Stores failed webhook events for retry processing with exponential backoff';

-- Enable RLS
ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins can view webhook failures" ON webhook_failures;
CREATE POLICY "Admins can view webhook failures"
  ON webhook_failures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins can update webhook failures" ON webhook_failures;
CREATE POLICY "Admins can update webhook failures"
  ON webhook_failures FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Service role has full access to webhook_failures" ON webhook_failures;
CREATE POLICY "Service role has full access to webhook_failures"
  ON webhook_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_webhook_failures_updated_at ON webhook_failures;
CREATE TRIGGER set_webhook_failures_updated_at
  BEFORE UPDATE ON webhook_failures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
