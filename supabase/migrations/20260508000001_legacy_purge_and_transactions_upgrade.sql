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

-- Removed PART D: UPDATE METADATA USAGE
-- The legacy_export table was missing and this logic is not needed for clean deployments or where data has already been migrated.

COMMIT;
