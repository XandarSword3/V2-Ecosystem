const fs = require('fs');
const path = require('path');

const content = `-- V2 Resort: Chargebacks Table Migration
-- Stores Stripe dispute and chargeback records
-- Production Hardening Phase 1.1

-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create enum for chargeback status
DO $$ BEGIN
  CREATE TYPE chargeback_status AS ENUM (
    'needs_response',
    'under_review',
    'charge_refunded',
    'won',
    'lost'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create enum for chargeback outcome
DO $$ BEGIN
  CREATE TYPE chargeback_outcome AS ENUM (
    'won',
    'lost',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create chargebacks table
CREATE TABLE IF NOT EXISTS chargebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_ledger(id) ON DELETE RESTRICT,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  reason TEXT NOT NULL,
  status chargeback_status NOT NULL DEFAULT 'needs_response',
  evidence_submitted JSONB,
  due_date TIMESTAMPTZ NOT NULL,
  outcome chargeback_outcome,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chargebacks_payment_id ON chargebacks(payment_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_stripe_dispute_id ON chargebacks(stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks(status);
CREATE INDEX IF NOT EXISTS idx_chargebacks_created_at ON chargebacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chargebacks_due_date ON chargebacks(due_date) WHERE status = 'needs_response';

-- Add comment for documentation
COMMENT ON TABLE chargebacks IS 'Stores Stripe dispute and chargeback records for payment disputes';

-- Enable RLS
ALTER TABLE chargebacks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can view all chargebacks
DROP POLICY IF EXISTS "Admins can view all chargebacks" ON chargebacks;
CREATE POLICY "Admins can view all chargebacks"
  ON chargebacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager', 'super_admin')
    )
  );

-- Admin can insert chargebacks
DROP POLICY IF EXISTS "Admins can insert chargebacks" ON chargebacks;
CREATE POLICY "Admins can insert chargebacks"
  ON chargebacks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager', 'super_admin')
    )
  );

-- Admin can update chargebacks
DROP POLICY IF EXISTS "Admins can update chargebacks" ON chargebacks;
CREATE POLICY "Admins can update chargebacks"
  ON chargebacks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager', 'super_admin')
    )
  );

-- Service role has full access (for webhook handlers)
DROP POLICY IF EXISTS "Service role has full access to chargebacks" ON chargebacks;
CREATE POLICY "Service role has full access to chargebacks"
  ON chargebacks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_chargebacks_updated_at ON chargebacks;
CREATE TRIGGER set_chargebacks_updated_at
  BEFORE UPDATE ON chargebacks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

fs.writeFileSync(path.join(__dirname, 'supabase', 'migrations', '20260124160000_chargebacks_table.sql'), content);
console.log('File written successfully');
