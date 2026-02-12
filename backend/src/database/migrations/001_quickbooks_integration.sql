-- QuickBooks Integration Tables
-- Run this migration to add QuickBooks integration support

-- QuickBooks connection configuration
CREATE TABLE IF NOT EXISTS quickbooks_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    realm_id VARCHAR(255) NOT NULL, -- QuickBooks company ID
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(property_id)
);

-- QuickBooks account mappings
CREATE TABLE IF NOT EXISTS quickbooks_account_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    v2_category VARCHAR(100) NOT NULL, -- room_revenue, food_revenue, spa_revenue, etc.
    qb_account_id VARCHAR(255) NOT NULL,
    qb_account_name VARCHAR(255),
    qb_account_type VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, v2_category)
);

-- QuickBooks sync log
CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'sales', 'customers', 'invoices', 'full'
    status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
    records_processed INTEGER DEFAULT 0,
    records_synced INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id)
);

-- QuickBooks synced transactions (for audit trail)
CREATE TABLE IF NOT EXISTS quickbooks_synced_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    v2_transaction_id UUID NOT NULL,
    v2_transaction_type VARCHAR(50) NOT NULL, -- 'payment', 'refund', 'invoice'
    qb_transaction_id VARCHAR(255),
    qb_transaction_type VARCHAR(50), -- 'SalesReceipt', 'Invoice', 'JournalEntry'
    amount DECIMAL(12, 2),
    sync_status VARCHAR(50) DEFAULT 'pending',
    synced_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QuickBooks customer mappings
CREATE TABLE IF NOT EXISTS quickbooks_customer_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    v2_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    qb_customer_id VARCHAR(255) NOT NULL,
    qb_customer_name VARCHAR(255),
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, v2_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qb_connections_property ON quickbooks_connections(property_id);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_connection ON quickbooks_sync_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_status ON quickbooks_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_qb_synced_tx_connection ON quickbooks_synced_transactions(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_synced_tx_status ON quickbooks_synced_transactions(sync_status);
CREATE INDEX IF NOT EXISTS idx_qb_customer_mappings_user ON quickbooks_customer_mappings(v2_user_id);

-- RLS Policies
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_synced_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_customer_mappings ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admin access to QB connections" ON quickbooks_connections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin', 'accountant')
        )
    );

CREATE POLICY "Admin access to QB account mappings" ON quickbooks_account_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quickbooks_connections qc
            JOIN users u ON u.id = auth.uid()
            WHERE qc.id = connection_id
            AND u.role IN ('admin', 'super_admin', 'accountant')
        )
    );

CREATE POLICY "Admin access to QB sync log" ON quickbooks_sync_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quickbooks_connections qc
            JOIN users u ON u.id = auth.uid()
            WHERE qc.id = connection_id
            AND u.role IN ('admin', 'super_admin', 'accountant')
        )
    );

CREATE POLICY "Admin access to QB synced transactions" ON quickbooks_synced_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quickbooks_connections qc
            JOIN users u ON u.id = auth.uid()
            WHERE qc.id = connection_id
            AND u.role IN ('admin', 'super_admin', 'accountant')
        )
    );

CREATE POLICY "Admin access to QB customer mappings" ON quickbooks_customer_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quickbooks_connections qc
            JOIN users u ON u.id = auth.uid()
            WHERE qc.id = connection_id
            AND u.role IN ('admin', 'super_admin', 'accountant')
        )
    );

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_quickbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_qb_connections_timestamp
    BEFORE UPDATE ON quickbooks_connections
    FOR EACH ROW EXECUTE FUNCTION update_quickbooks_updated_at();

CREATE TRIGGER update_qb_account_mappings_timestamp
    BEFORE UPDATE ON quickbooks_account_mappings
    FOR EACH ROW EXECUTE FUNCTION update_quickbooks_updated_at();
