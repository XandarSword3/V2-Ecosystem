-- Create gdpr_data_sharing_log table
-- This table tracks data sharing with third parties for GDPR compliance
CREATE TABLE IF NOT EXISTS gdpr_data_sharing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    third_party TEXT NOT NULL,
    purpose TEXT,
    data_shared TEXT[] DEFAULT '{}',
    legal_basis TEXT,
    shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE gdpr_data_sharing_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own data sharing log
CREATE POLICY gdpr_data_sharing_log_read ON gdpr_data_sharing_log
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')
    ));

-- Allow system/admin to insert
CREATE POLICY gdpr_data_sharing_log_insert ON gdpr_data_sharing_log
    FOR INSERT TO authenticated
    WITH CHECK (true);
