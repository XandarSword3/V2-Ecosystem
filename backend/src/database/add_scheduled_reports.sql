-- Migration: Add scheduled_reports table
-- This table stores configuration for automated email reports

CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly')),
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('revenue', 'occupancy', 'orders', 'customers', 'overview')),
    recipients TEXT[] NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_sent TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for finding enabled reports efficiently
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_enabled ON scheduled_reports(enabled) WHERE enabled = true;

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created ON scheduled_reports(created_at DESC);

-- Enable RLS
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage scheduled reports
CREATE POLICY "Super admins can manage scheduled reports" ON scheduled_reports
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() 
            AND r.name = 'super_admin'
        )
    );

-- Add comment
COMMENT ON TABLE scheduled_reports IS 'Stores configuration for automated email reports sent on schedule';
