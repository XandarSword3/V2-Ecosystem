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

-- NOTE: The real 'transactions' table already exists with proper schema:
-- engine_type, amount, customer_id, staff_id, reference_id, reference_table, metadata, etc.
-- DO NOT recreate it here. This migration only cleans up the regressions.

COMMIT;
