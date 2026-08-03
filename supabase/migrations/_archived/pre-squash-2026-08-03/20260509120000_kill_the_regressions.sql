-- =============================================
-- KILL ARCHITECTURAL REGRESSIONS
-- =============================================
-- This migration UNDOES the damage of the previous agent's mistake.
-- We are eliminating separate tables/views for tickets/bookings/orders
-- as they must all be unified in the 'transactions' table.

BEGIN;

-- Drop legacy/regressive views and tables safely
DO $$
BEGIN
    -- pool_tickets
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pool_tickets' AND relkind = 'v') THEN
        DROP VIEW pool_tickets CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pool_tickets' AND relkind = 'r') THEN
        DROP TABLE pool_tickets CASCADE;
    END IF;

    -- chalet_bookings
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chalet_bookings' AND relkind = 'v') THEN
        DROP VIEW chalet_bookings CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chalet_bookings' AND relkind = 'r') THEN
        DROP TABLE chalet_bookings CASCADE;
    END IF;

    -- restaurant_orders
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'restaurant_orders' AND relkind = 'v') THEN
        DROP VIEW restaurant_orders CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'restaurant_orders' AND relkind = 'r') THEN
        DROP TABLE restaurant_orders CASCADE;
    END IF;

    -- tickets
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tickets' AND relkind = 'v') THEN
        DROP VIEW tickets CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tickets' AND relkind = 'r') THEN
        DROP TABLE tickets CASCADE;
    END IF;

    -- bookings
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'bookings' AND relkind = 'v') THEN
        DROP VIEW bookings CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'bookings' AND relkind = 'r') THEN
        DROP TABLE bookings CASCADE;
    END IF;

    -- orders
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders' AND relkind = 'v') THEN
        DROP VIEW orders CASCADE;
    ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders' AND relkind = 'r') THEN
        DROP TABLE orders CASCADE;
    END IF;
END $$;

-- NOTE: The real 'transactions' table already exists with proper schema:
-- engine_type, amount, customer_id, staff_id, reference_id, reference_table, metadata, etc.
-- DO NOT recreate it here. This migration only cleans up the regressions.

COMMIT;
