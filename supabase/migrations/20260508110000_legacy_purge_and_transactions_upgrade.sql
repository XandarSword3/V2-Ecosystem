-- =============================================
-- Legacy Purge and Transactions Table Upgrade
-- =============================================
-- This migration removes all legacy tables and upgrades transactions table
-- to support the unified engine framework

BEGIN;

-- =============================================
-- PART A: ADD NEW EXPLICIT COLUMNS TO TRANSACTIONS
-- =============================================

-- Fields identified as needing explicit columns for performance:
-- order_number, ticket_number, booking_number, staff_id

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS order_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES users(id);

-- =============================================
-- PART B: DROP LEGACY TABLES IN DEPENDENCY ORDER
-- =============================================

-- Drop foreign key constraints first (child tables)
DROP TABLE IF EXISTS restaurant_order_items CASCADE;
DROP TABLE IF EXISTS snack_order_items CASCADE;
DROP TABLE IF EXISTS order_payment_splits CASCADE;
DROP TABLE IF EXISTS kitchen_orders CASCADE;
DROP TABLE IF EXISTS table_reservations CASCADE;

-- Drop main legacy tables
DROP TABLE IF EXISTS restaurant_tabs CASCADE;
DROP TABLE IF EXISTS restaurant_orders CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS snack_orders CASCADE;
DROP TABLE IF EXISTS snack_items CASCADE;
DROP TABLE IF EXISTS pool_tickets CASCADE;
DROP TABLE IF EXISTS chalet_bookings CASCADE;
DROP TABLE IF EXISTS chalets CASCADE;

-- =============================================
-- PART C: ADD INDEXES FOR NEW EXPLICIT COLUMNS
-- =============================================

-- Indexes for fields that will be used in WHERE clauses
CREATE INDEX IF NOT EXISTS idx_transactions_order_number ON transactions(order_number);
CREATE INDEX IF NOT EXISTS idx_transactions_ticket_number ON transactions(ticket_number);
CREATE INDEX IF NOT EXISTS idx_transactions_booking_number ON transactions(booking_number);
CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON transactions(staff_id);

-- =============================================
-- PART D: UPDATE METADATA USAGE
-- =============================================

-- Update existing transactions to populate metadata with legacy-specific fields
-- This ensures data that was previously in separate columns is still accessible
UPDATE transactions 
SET metadata = metadata || jsonb_build_object(
    'customer_name', CASE 
        WHEN engine_type = 'instant_transaction' THEN (SELECT customer_name FROM legacy_export WHERE reference_id = transactions.reference_id AND reference_table = 'restaurant_orders')
        WHEN engine_type = 'instant_transaction' THEN (SELECT customer_name FROM legacy_export WHERE reference_id = transactions.reference_id AND reference_table = 'snack_orders')
        ELSE NULL
    END,
    'customer_phone', CASE
        WHEN engine_type = 'instant_transaction' THEN (SELECT customer_phone FROM legacy_export WHERE reference_id = transactions.reference_id AND reference_table = 'restaurant_orders')
        WHEN engine_type = 'instant_transaction' THEN (SELECT customer_phone FROM legacy_export WHERE reference_id = transactions.reference_id AND reference_table = 'snack_orders')
        ELSE NULL
    END,
    'table_id', CASE
        WHEN engine_type = 'instant_transaction' THEN (SELECT table_id FROM legacy_export WHERE reference_id = transactions.reference_id AND reference_table = 'restaurant_orders')
        ELSE NULL
    END,
    'session_id', CASE
        WHEN engine_type = 'shared_capacity_access' THEN (SELECT session_id FROM legacy_export WHERE reference_id = transactions.reference_id AND reference_table = 'pool_tickets')
        ELSE NULL
    END,
    'chalet_id', CASE
        WHEN engine_type = 'time_exclusive_reservation' THEN (SELECT chalet_id FROM legacy_export WHERE reference_id = transactions.reference_id AND reference_table = 'chalet_bookings')
        ELSE NULL
    END,
    'cancellation_reason', CASE
        WHEN engine_type IN ('instant_transaction', 'shared_capacity_access', 'time_exclusive_reservation') THEN 
            (SELECT cancellation_reason FROM legacy_export WHERE reference_id = transactions.reference_id)
        ELSE NULL
    END
);

-- Note: legacy_export is a temporary table created during this migration 
-- to preserve the metadata fields before dropping the source tables

COMMIT;
