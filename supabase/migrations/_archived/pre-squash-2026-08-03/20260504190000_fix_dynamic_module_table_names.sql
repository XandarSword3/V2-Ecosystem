-- Fix table name mismatches for dynamic module system
-- Dynamic router expects generic names, database has legacy/accommodation names

BEGIN;

-- Add missing columns to capacity_windows that the sessions view and trigger require.
-- The base schema stub only has id/name/start_time/end_time/capacity/price/is_active.
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS max_capacity       INTEGER;
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS adult_price        DECIMAL(10,2);
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS child_price        DECIMAL(10,2);
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS gender_restriction VARCHAR(20);
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS date               DATE;
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS module_id          UUID REFERENCES modules(id);

-- =====================================================
-- 1. ACCOMMODATION/CHALET MODULE
-- Router queries: bookable_units
-- Database has: accommodation_units (renamed from chalets)
-- =====================================================

-- Create view to alias accommodation_units as bookable_units
DROP VIEW IF EXISTS bookable_units;
CREATE VIEW bookable_units AS
SELECT 
    id,
    name,
    description,
    base_price as price,
    weekend_price,
    capacity,
    is_active,
    created_at,
    updated_at
FROM accommodation_units;

-- Make view insertable/updatable via trigger
CREATE OR REPLACE FUNCTION bookable_units_view_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO accommodation_units (
            name, name_ar, name_fr, description, description_ar, description_fr,
            base_price, weekend_price, capacity, bedroom_count, bathroom_count,
            size_sqm, amenities, images, is_active, is_featured, display_order,
            image_url, module_id
        ) VALUES (
            NEW.name, NEW.name_ar, NEW.name_fr, NEW.description, NEW.description_ar, NEW.description_fr,
            NEW.price, NEW.weekend_price, NEW.capacity, NEW.bedroom_count, NEW.bathroom_count,
            NEW.size_sqm, NEW.amenities, NEW.images, NEW.is_active, NEW.is_featured, NEW.display_order,
            NEW.image_url, NEW.module_id
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE accommodation_units SET
            name = NEW.name,
            name_ar = NEW.name_ar,
            name_fr = NEW.name_fr,
            description = NEW.description,
            description_ar = NEW.description_ar,
            description_fr = NEW.description_fr,
            base_price = NEW.price,
            weekend_price = NEW.weekend_price,
            capacity = NEW.capacity,
            bedroom_count = NEW.bedroom_count,
            bathroom_count = NEW.bathroom_count,
            size_sqm = NEW.size_sqm,
            amenities = NEW.amenities,
            images = NEW.images,
            is_active = NEW.is_active,
            is_featured = NEW.is_featured,
            display_order = NEW.display_order,
            image_url = NEW.image_url,
            module_id = NEW.module_id,
            updated_at = NOW()
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

-- =====================================================
-- 2. SESSION ACCESS MODULE (CAPACITY ACCESS)
-- Router queries: sessions, tickets
-- sessions aliases capacity_windows; tickets queries transactions
-- =====================================================

DO $$ BEGIN
    DROP VIEW IF EXISTS sessions;
EXCEPTION WHEN wrong_object_type THEN
    NULL;
END $$;

DO $$ BEGIN
    CREATE VIEW sessions AS
    SELECT
        id,
        name,
        start_time,
        end_time,
        max_capacity,
        COALESCE(
            (SELECT SUM(COALESCE((metadata->>'number_of_guests')::int, 1))
             FROM transactions t
             WHERE (t.metadata->>'session_id')::UUID = capacity_windows.id
             AND t.engine_type = 'shared_capacity_access'
             AND t.status IN ('confirmed', 'active', 'used')),
             0
             ) AS current_count,
             adult_price AS price,
             child_price,
             gender_restriction,
             is_active,
             module_id,
             created_at,
             updated_at
FROM capacity_windows;
EXCEPTION WHEN duplicate_table THEN
    NULL;
END $$;

-- tickets view reads from transactions (shared_capacity_access)
DROP VIEW IF EXISTS tickets;
CREATE VIEW tickets AS
SELECT
    id,
    module_id,
    (metadata->>'session_id')::UUID    AS session_id,
    customer_id,
    status,
    amount                             AS total_amount,
    COALESCE((metadata->>'number_of_guests')::int, 1) AS number_of_guests,
    metadata->>'ticket_number'         AS ticket_number,
    metadata->>'qr_code'               AS qr_code,
    (metadata->>'entry_time')::TIMESTAMPTZ AS entry_time,
    (metadata->>'exit_time')::TIMESTAMPTZ  AS exit_time,
    (metadata->>'used_at')::TIMESTAMPTZ    AS used_at,
    metadata->>'payment_status'        AS payment_status,
    metadata->>'payment_method'        AS payment_method,
    created_at,
    updated_at
FROM transactions
WHERE engine_type = 'shared_capacity_access';

-- sessions view trigger (writes to capacity_windows)
CREATE OR REPLACE FUNCTION sessions_view_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO capacity_windows (
            name, date, start_time, end_time, max_capacity,
            adult_price, child_price, gender_restriction, is_active, module_id
        ) VALUES (
            NEW.name, NEW.date, NEW.start_time, NEW.end_time, NEW.max_capacity,
            NEW.adult_price, NEW.child_price, NEW.gender_restriction, NEW.is_active, NEW.module_id
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE capacity_windows SET
            name = NEW.name, date = NEW.date,
            start_time = NEW.start_time, end_time = NEW.end_time,
            max_capacity = NEW.max_capacity, adult_price = NEW.adult_price,
            child_price = NEW.child_price, gender_restriction = NEW.gender_restriction,
            is_active = NEW.is_active, module_id = NEW.module_id, updated_at = NOW()
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM capacity_windows WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS sessions_view_trigger ON sessions;
    CREATE TRIGGER sessions_view_trigger
        INSTEAD OF INSERT OR UPDATE OR DELETE ON sessions
        FOR EACH ROW EXECUTE FUNCTION sessions_view_trigger();
EXCEPTION WHEN wrong_object_type THEN
    NULL;
END $$;

-- =====================================================
-- 3. CREATE INDEXES FOR VIEW PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_transactions_session_id
  ON transactions((metadata->>'session_id'))
  WHERE engine_type = 'shared_capacity_access';
CREATE INDEX IF NOT EXISTS idx_transactions_shared_customer
  ON transactions(customer_id)
  WHERE engine_type = 'shared_capacity_access';
CREATE INDEX IF NOT EXISTS idx_accommodation_units_module_id
  ON accommodation_units(module_id);

COMMIT;
