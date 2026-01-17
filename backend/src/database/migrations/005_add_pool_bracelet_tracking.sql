-- Migration: Add bracelet tracking fields to pool tickets
-- Allows tracking of wristband/bracelet assignment for pool access

-- Add bracelet-related columns to pool_tickets
ALTER TABLE pool_tickets 
ADD COLUMN IF NOT EXISTS bracelet_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bracelet_color VARCHAR(30),
ADD COLUMN IF NOT EXISTS bracelet_assigned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS bracelet_assigned_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS bracelet_returned_at TIMESTAMP;

-- Create index for bracelet lookups
CREATE INDEX IF NOT EXISTS idx_pool_tickets_bracelet ON pool_tickets(bracelet_number) WHERE bracelet_number IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN pool_tickets.bracelet_number IS 'Unique identifier for the wristband/bracelet assigned to guest';
COMMENT ON COLUMN pool_tickets.bracelet_color IS 'Color of the bracelet for visual identification (e.g., red, blue, green)';
COMMENT ON COLUMN pool_tickets.bracelet_assigned_at IS 'Timestamp when the bracelet was assigned to the guest';
COMMENT ON COLUMN pool_tickets.bracelet_assigned_by IS 'Staff member who assigned the bracelet';
COMMENT ON COLUMN pool_tickets.bracelet_returned_at IS 'Timestamp when the bracelet was returned (on exit)';
