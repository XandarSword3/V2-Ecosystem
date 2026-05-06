-- Fix table name mismatches for dynamic module system
-- Dynamic router expects generic names, database has legacy/accommodation names

BEGIN;

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
    name_ar,
    name_fr,
    description,
    description_ar,
    description_fr,
    base_price as price,
    weekend_price,
    capacity,
    bedroom_count,
    bathroom_count,
    size_sqm,
    amenities,
    images,
    is_active,
    is_featured,
    display_order,
    image_url,
    module_id,
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
-- 2. SESSION ACCESS MODULE (POOL)
-- Router queries: sessions, tickets
-- Database has: pool_sessions, pool_tickets
-- =====================================================

-- Create view to alias pool_sessions as sessions
DROP VIEW IF EXISTS sessions;
CREATE VIEW sessions AS
SELECT 
    id,
    name,
    date,
    start_time,
    end_time,
    max_capacity,
    COALESCE(
        (SELECT COUNT(*) FROM pool_tickets pt WHERE pt.session_id = pool_sessions.id AND pt.status != 'cancelled'),
        0
    ) as current_count,
    adult_price as price,
    adult_price,
    child_price,
    gender_restriction,
    is_active,
    module_id,
    created_at,
    updated_at
FROM pool_sessions;

-- Create view to alias pool_tickets as tickets
DROP VIEW IF EXISTS tickets;
CREATE VIEW tickets AS
SELECT 
    id,
    module_id,
    session_id,
    COALESCE(customer_id, user_id) as customer_id,
    status,
    COALESCE(total_amount, total_price, 0) as total_amount,
    number_of_guests,
    ticket_number,
    qr_code,
    entry_time,
    exit_time,
    used_at,
    payment_status,
    payment_method,
    created_at,
    updated_at
FROM pool_tickets;

-- Make sessions view insertable/updatable
CREATE OR REPLACE FUNCTION sessions_view_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pool_sessions (
            name, date, start_time, end_time, max_capacity,
            adult_price, child_price, gender_restriction, is_active, module_id
        ) VALUES (
            NEW.name, NEW.date, NEW.start_time, NEW.end_time, NEW.max_capacity,
            NEW.adult_price, NEW.child_price, NEW.gender_restriction, NEW.is_active, NEW.module_id
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE pool_sessions SET
            name = NEW.name,
            date = NEW.date,
            start_time = NEW.start_time,
            end_time = NEW.end_time,
            max_capacity = NEW.max_capacity,
            adult_price = NEW.adult_price,
            child_price = NEW.child_price,
            gender_restriction = NEW.gender_restriction,
            is_active = NEW.is_active,
            module_id = NEW.module_id,
            updated_at = NOW()
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM pool_sessions WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_view_trigger ON sessions;
CREATE TRIGGER sessions_view_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON sessions
    FOR EACH ROW EXECUTE FUNCTION sessions_view_trigger();

-- Make tickets view insertable
CREATE OR REPLACE FUNCTION tickets_view_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pool_tickets (
            module_id, session_id, customer_id, user_id, status,
            total_amount, total_price, number_of_guests, quantity,
            ticket_number, qr_code, payment_status
        ) VALUES (
            NEW.module_id, NEW.session_id, NEW.customer_id, NEW.customer_id, NEW.status,
            NEW.total_amount, NEW.total_amount, NEW.number_of_guests, NEW.number_of_guests,
            NEW.ticket_number, NEW.qr_code, COALESCE(NEW.payment_status, 'pending')
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE pool_tickets SET
            module_id = NEW.module_id,
            session_id = NEW.session_id,
            customer_id = NEW.customer_id,
            user_id = NEW.customer_id,
            status = NEW.status,
            total_amount = NEW.total_amount,
            total_price = NEW.total_amount,
            number_of_guests = NEW.number_of_guests,
            quantity = NEW.number_of_guests,
            ticket_number = NEW.ticket_number,
            qr_code = NEW.qr_code,
            entry_time = NEW.entry_time,
            exit_time = NEW.exit_time,
            used_at = NEW.used_at,
            payment_status = NEW.payment_status,
            updated_at = NOW()
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM pool_tickets WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_view_trigger ON tickets;
CREATE TRIGGER tickets_view_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON tickets
    FOR EACH ROW EXECUTE FUNCTION tickets_view_trigger();

-- =====================================================
-- 3. CREATE INDEXES FOR VIEW PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pool_tickets_session_id ON pool_tickets(session_id);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_customer_id ON pool_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_module_id ON pool_tickets(module_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_units_module_id ON accommodation_units(module_id);

COMMIT;
