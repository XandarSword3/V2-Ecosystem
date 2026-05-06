-- =============================================
-- Engine Framework: Unified Transactions Table
-- Every completed transaction across every engine writes here.
-- The engine-specific tables remain as source of truth for their fields.
-- The transactions table is the financial record, not a replacement.
-- =============================================
BEGIN;

-- =============================================
-- 1. CREATE TRANSACTIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    engine_type VARCHAR(50) NOT NULL,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    service_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reference_id UUID NOT NULL,
    reference_table VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- =============================================
-- 2. INDEXES
-- =============================================

CREATE INDEX idx_transactions_property_id ON transactions(property_id);
CREATE INDEX idx_transactions_engine_type ON transactions(engine_type);
CREATE INDEX idx_transactions_module_id ON transactions(module_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_property_engine ON transactions(property_id, engine_type);
CREATE INDEX idx_transactions_property_date ON transactions(property_id, created_at);
CREATE INDEX idx_transactions_property_engine_date ON transactions(property_id, engine_type, created_at);
CREATE INDEX idx_transactions_reference ON transactions(reference_table, reference_id);

-- =============================================
-- 3. RLS
-- =============================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_property_isolation ON transactions
    FOR ALL
    USING (property_id IN (
        SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    ));

-- =============================================
-- 4. SYNC TRIGGERS
-- Keep transactions table in sync with source tables
-- =============================================

-- restaurant_orders → transactions
CREATE OR REPLACE FUNCTION sync_transaction_from_restaurant_order()
RETURNS TRIGGER AS $$
DECLARE
    v_engine_type VARCHAR(50);
    v_template_type module_template_type;
BEGIN
    SELECT template_type INTO v_template_type
    FROM modules WHERE id = NEW.module_id;
    
    v_engine_type := CASE v_template_type
        WHEN 'multi_day_booking' THEN 'time_exclusive_reservation'
        WHEN 'session_access' THEN 'shared_capacity_access'
        ELSE 'instant_transaction'
    END CASE;

    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
    VALUES (
        NEW.module_id,
        v_engine_type,
        COALESCE(NEW.property_id, (SELECT property_id FROM modules WHERE id = NEW.module_id)),
        COALESCE(NEW.payment_status, NEW.status, 'pending'),
        COALESCE(NEW.total_amount, 0),
        COALESCE(NEW.tax_amount, 0),
        COALESCE(NEW.service_charge, 0),
        COALESCE(NEW.discount_amount, 0),
        COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount_amount, 0),
        'USD',
        NEW.customer_id,
        NEW.id,
        'restaurant_orders',
        NEW.created_at,
        NEW.completed_at,
        jsonb_build_object('order_number', NEW.order_number, 'order_type', NEW.order_type)
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        tax_amount = EXCLUDED.tax_amount,
        service_charge = EXCLUDED.service_charge,
        discount_amount = EXCLUDED.discount_amount,
        net_amount = EXCLUDED.net_amount,
        completed_at = EXCLUDED.completed_at,
        metadata = EXCLUDED.metadata;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction ON restaurant_orders;
CREATE TRIGGER trg_sync_transaction
    AFTER INSERT OR UPDATE OF status, payment_status, total_amount, tax_amount, service_charge, discount_amount ON restaurant_orders
    FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_restaurant_order();

-- chalet_bookings → transactions
CREATE OR REPLACE FUNCTION sync_transaction_from_chalet_booking()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
    VALUES (
        NULL,
        'time_exclusive_reservation',
        NEW.property_id,
        COALESCE(NEW.payment_status, NEW.status, 'pending'),
        COALESCE(NEW.total_price, 0),
        COALESCE(NEW.total_price, 0),
        'USD',
        NEW.user_id,
        NEW.id,
        'chalet_bookings',
        NEW.created_at,
        CASE WHEN NEW.status IN ('checked_out', 'CHECKED_OUT') THEN NEW.updated_at ELSE NULL END,
        jsonb_build_object('booking_number', NEW.booking_number, 'chalet_id', NEW.chalet_id)
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        net_amount = EXCLUDED.net_amount,
        completed_at = EXCLUDED.completed_at,
        metadata = EXCLUDED.metadata;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction ON chalet_bookings;
CREATE TRIGGER trg_sync_transaction
    AFTER INSERT OR UPDATE OF status, payment_status, total_price ON chalet_bookings
    FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_chalet_booking();

-- pool_tickets → transactions
CREATE OR REPLACE FUNCTION sync_transaction_from_pool_ticket()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, metadata)
    VALUES (
        NULL,
        'shared_capacity_access',
        NEW.property_id,
        COALESCE(NEW.payment_status, NEW.status, 'pending'),
        COALESCE(NEW.total_price, 0),
        COALESCE(NEW.total_price, 0),
        'USD',
        NEW.user_id,
        NEW.id,
        'pool_tickets',
        NEW.created_at,
        jsonb_build_object('ticket_number', NEW.ticket_number, 'session_id', NEW.session_id)
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        net_amount = EXCLUDED.net_amount,
        metadata = EXCLUDED.metadata;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction ON pool_tickets;
CREATE TRIGGER trg_sync_transaction
    AFTER INSERT OR UPDATE OF status, payment_status, total_price ON pool_tickets
    FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_pool_ticket();

-- snack_orders → transactions (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_orders') THEN
        CREATE OR REPLACE FUNCTION sync_transaction_from_snack_order()
        RETURNS TRIGGER AS $$
        DECLARE
            v_engine_type VARCHAR(50);
            v_property_id UUID;
            v_template_type module_template_type;
        BEGIN
            SELECT template_type, property_id
            INTO v_template_type, v_property_id
            FROM modules WHERE id = NEW.module_id;
            
            v_engine_type := CASE v_template_type
                WHEN 'multi_day_booking' THEN 'time_exclusive_reservation'
                WHEN 'session_access' THEN 'shared_capacity_access'
                ELSE 'instant_transaction'
            END CASE;

            INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
            VALUES (
                NEW.module_id,
                v_engine_type,
                COALESCE(NEW.property_id, v_property_id),
                COALESCE(NEW.payment_status, NEW.status, 'pending'),
                COALESCE(NEW.total_amount, 0),
                COALESCE(NEW.tax_amount, 0),
                COALESCE(NEW.discount_amount, 0),
                COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount_amount, 0),
                'USD',
                NEW.customer_id,
                NEW.id,
                'snack_orders',
                NEW.created_at,
                NEW.completed_at,
                jsonb_build_object('order_number', NEW.order_number)
            )
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                amount = EXCLUDED.amount,
                tax_amount = EXCLUDED.tax_amount,
                discount_amount = EXCLUDED.discount_amount,
                net_amount = EXCLUDED.net_amount,
                completed_at = EXCLUDED.completed_at,
                metadata = EXCLUDED.metadata;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_sync_transaction ON snack_orders;
        CREATE TRIGGER trg_sync_transaction
            AFTER INSERT OR UPDATE OF status, payment_status, total_amount ON snack_orders
            FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_snack_order();
    END IF;
END $$;

-- =============================================
-- 5. BACKFILL FROM EXISTING DATA
-- =============================================

-- From restaurant_orders
INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
SELECT
    ro.module_id,
    CASE m.template_type
        WHEN 'multi_day_booking' THEN 'time_exclusive_reservation'
        WHEN 'session_access' THEN 'shared_capacity_access'
        ELSE 'instant_transaction'
    END,
    COALESCE(ro.property_id, m.property_id),
    COALESCE(ro.payment_status, ro.status, 'pending'),
    COALESCE(ro.total_amount, 0),
    COALESCE(ro.tax_amount, 0),
    COALESCE(ro.service_charge, 0),
    COALESCE(ro.discount_amount, 0),
    COALESCE(ro.total_amount, 0) - COALESCE(ro.discount_amount, 0),
    'USD',
    ro.customer_id,
    ro.id,
    'restaurant_orders',
    ro.created_at,
    ro.completed_at,
    jsonb_build_object('order_number', ro.order_number, 'order_type', ro.order_type)
FROM restaurant_orders ro
LEFT JOIN modules m ON ro.module_id = m.id
WHERE NOT EXISTS (
    SELECT 1 FROM transactions t WHERE t.reference_id = ro.id AND t.reference_table = 'restaurant_orders'
);

-- From chalet_bookings
INSERT INTO transactions (module_id, engine_type, property_id, status, amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
SELECT
    NULL,
    'time_exclusive_reservation',
    cb.property_id,
    COALESCE(cb.payment_status, cb.status, 'pending'),
    COALESCE(cb.total_price, 0),
    COALESCE(cb.total_price, 0),
    'USD',
    cb.user_id,
    cb.id,
    'chalet_bookings',
    cb.created_at,
    CASE WHEN cb.status IN ('checked_out', 'CHECKED_OUT') THEN cb.updated_at ELSE NULL END,
    jsonb_build_object('booking_number', cb.booking_number, 'chalet_id', cb.chalet_id)
FROM chalet_bookings cb
WHERE NOT EXISTS (
    SELECT 1 FROM transactions t WHERE t.reference_id = cb.id AND t.reference_table = 'chalet_bookings'
);

-- From pool_tickets
INSERT INTO transactions (module_id, engine_type, property_id, status, amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, metadata)
SELECT
    NULL,
    'shared_capacity_access',
    pt.property_id,
    COALESCE(pt.payment_status, pt.status, 'pending'),
    COALESCE(pt.total_price, 0),
    COALESCE(pt.total_price, 0),
    'USD',
    pt.user_id,
    pt.id,
    'pool_tickets',
    pt.created_at,
    jsonb_build_object('ticket_number', pt.ticket_number, 'session_id', pt.session_id)
FROM pool_tickets pt
WHERE NOT EXISTS (
    SELECT 1 FROM transactions t WHERE t.reference_id = pt.id AND t.reference_table = 'pool_tickets'
);

-- From snack_orders (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_orders') THEN
        INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata)
        SELECT
            so.module_id,
            CASE m.template_type
                WHEN 'multi_day_booking' THEN 'time_exclusive_reservation'
                WHEN 'session_access' THEN 'shared_capacity_access'
                ELSE 'instant_transaction'
            END,
            COALESCE(so.property_id, m.property_id),
            COALESCE(so.payment_status, so.status, 'pending'),
            COALESCE(so.total_amount, 0),
            COALESCE(so.tax_amount, 0),
            COALESCE(so.discount_amount, 0),
            COALESCE(so.total_amount, 0) - COALESCE(so.discount_amount, 0),
            'USD',
            so.customer_id,
            so.id,
            'snack_orders',
            so.created_at,
            so.completed_at,
            jsonb_build_object('order_number', so.order_number)
        FROM snack_orders so
        LEFT JOIN modules m ON so.module_id = m.id
        WHERE NOT EXISTS (
            SELECT 1 FROM transactions t WHERE t.reference_id = so.id AND t.reference_table = 'snack_orders'
        );
    END IF;
END $$;

COMMIT;
