-- Clean transactions table creation (no legacy table dependencies)
-- Replaces archived 20260506000000_create_transactions_table.sql

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    engine_type VARCHAR(50) NOT NULL,
    property_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    service_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    customer_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reference_id UUID,
    reference_table VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- NOTE: property_id is intentionally nullable for engine-only inserts
-- NOTE: reference_id and reference_table are nullable (no legacy backfill needed)

CREATE INDEX IF NOT EXISTS idx_transactions_engine_type ON transactions(engine_type);
CREATE INDEX IF NOT EXISTS idx_transactions_module_id ON transactions(module_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_property_id ON transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_transactions_property_engine ON transactions(property_id, engine_type);
CREATE INDEX IF NOT EXISTS idx_transactions_property_date ON transactions(property_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_property_engine_date ON transactions(property_id, engine_type, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_table, reference_id);

-- RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow all access in test/dev; production should tighten via property_id
DO $$ BEGIN
  CREATE POLICY transactions_allow_all ON transactions FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
