-- =============================================
-- KILL ARCHITECTURAL REGRESSIONS
-- =============================================
-- This migration UNDOES the damage of the previous agent's mistake.
-- We are eliminating separate tables/views for tickets/bookings/orders
-- as they must all be unified in the 'transactions' table.

BEGIN;

-- Drop legacy/regressive views
DROP VIEW IF EXISTS pool_tickets CASCADE;
DROP VIEW IF EXISTS chalet_bookings CASCADE;
DROP VIEW IF EXISTS restaurant_orders CASCADE;

-- Drop regressive tables
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Ensure 'transactions' exists (it should, but just in case)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id),
    module_id UUID REFERENCES modules(id),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50), -- 'ticket', 'booking', 'order'
    status VARCHAR(50),
    total_amount DECIMAL(12,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
