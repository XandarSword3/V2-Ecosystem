-- =============================================
-- Fix schema gaps causing integration test failures:
-- 1. bookable_units view: missing deleted_at and base_price columns
-- 2. sessions view: ensure name column is exposed
-- 3. transactions: ensure schema-qualified access works
-- =============================================

BEGIN;

-- =============================================
-- 1. FIX bookable_units VIEW
-- Add deleted_at and base_price (in addition to price alias)
-- The app queries both .is('deleted_at', null) and .select('base_price')
-- =============================================

DROP VIEW IF EXISTS bookable_units CASCADE;

CREATE VIEW bookable_units AS
SELECT
    id,
    name,
    description,
    base_price,                          -- expose directly (not aliased)
    base_price AS price,                 -- keep alias for backward compat
    weekend_price,
    capacity,
    is_active,
    deleted_at,                          -- required for soft-delete filtering
    module_id,
    created_at,
    updated_at
FROM accommodation_units;

-- Recreate the INSTEAD OF trigger so view remains writable
CREATE OR REPLACE FUNCTION bookable_units_view_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO accommodation_units (
            name, description,
            base_price, weekend_price, capacity,
            is_active, module_id
        ) VALUES (
            NEW.name, NEW.description,
            COALESCE(NEW.base_price, NEW.price), NEW.weekend_price, NEW.capacity,
            COALESCE(NEW.is_active, true), NEW.module_id
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE accommodation_units SET
            name          = NEW.name,
            description   = NEW.description,
            base_price    = COALESCE(NEW.base_price, NEW.price, OLD.base_price),
            weekend_price = NEW.weekend_price,
            capacity      = NEW.capacity,
            is_active     = NEW.is_active,
            deleted_at    = NEW.deleted_at,
            module_id     = NEW.module_id,
            updated_at    = NOW()
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM accommodation_units WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookable_units_view_trigger ON bookable_units;
CREATE TRIGGER bookable_units_view_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON bookable_units
    FOR EACH ROW EXECUTE FUNCTION bookable_units_view_trigger();

-- =============================================
-- 2. FIX sessions VIEW
-- Ensure name is properly exposed; recreate cleanly
-- The DO block in the previous migration silently fails if sessions
-- already exists as a table, leaving the view absent.
-- =============================================

-- Drop view if it exists; if sessions is a table, leave it alone
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'sessions'
    ) THEN
        DROP VIEW sessions CASCADE;
    END IF;
END $$;

-- Only create the sessions VIEW if sessions is not already a base table
DO $outer$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sessions'
          AND table_type = 'BASE TABLE'
    ) THEN
        CREATE VIEW sessions AS
        SELECT
            id,
            name,
            date,
            start_time,
            end_time,
            max_capacity,
            COALESCE(
                (SELECT SUM(COALESCE((t.metadata->>'number_of_guests')::integer, 1))::integer
                 FROM transactions t
                 WHERE (t.metadata->>'session_id')::UUID = capacity_windows.id
                   AND t.engine_type = 'shared_capacity_access'
                   AND t.status NOT IN ('cancelled', 'expired')),
                0
            ) AS current_count,
            adult_price  AS price,
            child_price,
            gender_restriction,
            is_active,
            module_id,
            created_at,
            updated_at
        FROM capacity_windows;

        -- Recreate INSTEAD OF trigger
        CREATE OR REPLACE FUNCTION sessions_view_trigger()
        RETURNS TRIGGER AS $fn$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO capacity_windows (
                    name, date, start_time, end_time, max_capacity,
                    adult_price, child_price, gender_restriction, is_active, module_id
                ) VALUES (
                    NEW.name, NEW.date, NEW.start_time, NEW.end_time, NEW.max_capacity,
                    COALESCE(NEW.price, NEW.adult_price), NEW.child_price,
                    NEW.gender_restriction, COALESCE(NEW.is_active, true), NEW.module_id
                ) RETURNING id INTO NEW.id;
                RETURN NEW;
            ELSIF TG_OP = 'UPDATE' THEN
                UPDATE capacity_windows SET
                    name              = NEW.name,
                    date              = NEW.date,
                    start_time        = NEW.start_time,
                    end_time          = NEW.end_time,
                    max_capacity      = NEW.max_capacity,
                    adult_price       = COALESCE(NEW.price, NEW.adult_price),
                    child_price       = NEW.child_price,
                    gender_restriction = NEW.gender_restriction,
                    is_active         = NEW.is_active,
                    module_id         = NEW.module_id,
                    updated_at        = NOW()
                WHERE id = OLD.id;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                DELETE FROM capacity_windows WHERE id = OLD.id;
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $fn$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS sessions_view_trigger ON sessions;
        CREATE TRIGGER sessions_view_trigger
            INSTEAD OF INSERT OR UPDATE OR DELETE ON sessions
            FOR EACH ROW EXECUTE FUNCTION sessions_view_trigger();
    END IF;
END $outer$;

-- =============================================
-- 3. ENSURE capacity_windows HAS name COLUMN
-- base_schema_shim has name VARCHAR(255) but later migrations
-- may have dropped or missed it; add if absent
-- =============================================

DO $col$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'capacity_windows'
          AND column_name  = 'name'
    ) THEN
        ALTER TABLE capacity_windows ADD COLUMN name VARCHAR(255);
    END IF;
END $col$;

-- =============================================
-- 4. ENSURE accommodation_units HAS deleted_at
-- Was added to chalets before rename; confirm it survived
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'accommodation_units'
          AND column_name  = 'deleted_at'
    ) THEN
        ALTER TABLE accommodation_units ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_accommodation_units_deleted_at
            ON accommodation_units(deleted_at) WHERE deleted_at IS NULL;
    END IF;
END $$;

-- =============================================
-- 5. ENSURE transactions TABLE EXISTS
-- Migration 20260506 creates it, but if it was skipped or
-- the schema is wrong, re-ensure the table is present.
-- =============================================

CREATE TABLE IF NOT EXISTS transactions (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id         UUID         REFERENCES modules(id) ON DELETE SET NULL,
    engine_type       VARCHAR(50)  NOT NULL,
    property_id       UUID         NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    status            VARCHAR(50)  NOT NULL DEFAULT 'pending',
    amount            DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
    service_charge    DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency          VARCHAR(3)   NOT NULL DEFAULT 'USD',
    customer_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
    reference_id      UUID         NOT NULL,
    reference_table   VARCHAR(50)  NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    metadata          JSONB        DEFAULT '{}'
);

-- Indexes (IF NOT EXISTS so safe to re-run)
CREATE INDEX IF NOT EXISTS idx_transactions_property_id      ON transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_transactions_engine_type      ON transactions(engine_type);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id      ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status           ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at       ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference        ON transactions(reference_table, reference_id);

-- RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy (re-create idempotently)
DROP POLICY IF EXISTS transactions_property_isolation ON transactions;
CREATE POLICY transactions_property_isolation ON transactions
    FOR ALL
    USING (property_id IN (
        SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    ));

COMMIT;
