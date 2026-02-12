-- GDPR Compliance Tables
-- Run this migration to add GDPR data management support

-- Data export requests
CREATE TABLE IF NOT EXISTS gdpr_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, expired, failed
    file_path TEXT,
    file_expires_at TIMESTAMPTZ,
    error_message TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    downloaded_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Data deletion requests (Right to be Forgotten)
CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, processing, completed, rejected
    reason TEXT,
    rejection_reason TEXT,
    data_categories TEXT[], -- which data to delete
    retention_exceptions TEXT[], -- data that must be retained (legal requirements)
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Consent management
CREATE TABLE IF NOT EXISTS gdpr_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL, -- marketing_email, marketing_sms, analytics, third_party_sharing
    granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    source VARCHAR(100), -- registration, settings, popup
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, consent_type)
);

-- Data processing activities log (for audit)
CREATE TABLE IF NOT EXISTS gdpr_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL, -- data_access, data_export, data_deletion, consent_change
    description TEXT,
    data_categories TEXT[],
    legal_basis VARCHAR(100), -- consent, contract, legal_obligation, legitimate_interest
    processor VARCHAR(255), -- who/what processed the data
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data retention policies
CREATE TABLE IF NOT EXISTS gdpr_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_category VARCHAR(100) NOT NULL UNIQUE,
    retention_period_days INTEGER NOT NULL,
    legal_basis TEXT,
    description TEXT,
    auto_delete BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Third-party data sharing log
CREATE TABLE IF NOT EXISTS gdpr_data_sharing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    third_party VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    data_shared TEXT[],
    legal_basis VARCHAR(100),
    shared_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_export_user ON gdpr_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_status ON gdpr_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_user ON gdpr_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_status ON gdpr_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user ON gdpr_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_processing_user ON gdpr_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_processing_type ON gdpr_processing_log(activity_type);

-- RLS Policies
ALTER TABLE gdpr_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_data_sharing_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own export requests
CREATE POLICY "Users can view own export requests" ON gdpr_export_requests
    FOR SELECT USING (user_id = auth.uid());

-- Users can create their own export requests
CREATE POLICY "Users can create export requests" ON gdpr_export_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can see their own deletion requests
CREATE POLICY "Users can view own deletion requests" ON gdpr_deletion_requests
    FOR SELECT USING (user_id = auth.uid());

-- Users can create their own deletion requests
CREATE POLICY "Users can create deletion requests" ON gdpr_deletion_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can manage their own consents
CREATE POLICY "Users can manage own consents" ON gdpr_consents
    FOR ALL USING (user_id = auth.uid());

-- Admin access to all GDPR tables
CREATE POLICY "Admin access to export requests" ON gdpr_export_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to deletion requests" ON gdpr_deletion_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to processing log" ON gdpr_processing_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to retention policies" ON gdpr_retention_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
        )
    );

-- Insert default retention policies
INSERT INTO gdpr_retention_policies (data_category, retention_period_days, legal_basis, description, auto_delete) VALUES
    ('user_profile', 1095, 'Contract fulfillment', 'Basic user account information', false),
    ('booking_history', 2555, 'Legal obligation', 'Booking records for tax/accounting (7 years)', false),
    ('payment_records', 2555, 'Legal obligation', 'Financial records for tax compliance (7 years)', false),
    ('marketing_data', 730, 'Consent', 'Marketing preferences and history (2 years)', true),
    ('session_logs', 90, 'Legitimate interest', 'Login and session data for security', true),
    ('support_tickets', 1095, 'Contract fulfillment', 'Customer support history (3 years)', false),
    ('analytics_data', 365, 'Legitimate interest', 'Anonymous usage analytics (1 year)', true)
ON CONFLICT (data_category) DO NOTHING;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_gdpr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_gdpr_consents_timestamp
    BEFORE UPDATE ON gdpr_consents
    FOR EACH ROW EXECUTE FUNCTION update_gdpr_updated_at();

CREATE TRIGGER update_gdpr_retention_timestamp
    BEFORE UPDATE ON gdpr_retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_gdpr_updated_at();
