-- =============================================
-- Update Transaction Sync Triggers for Economics Columns
-- Add staff_id, cancellation_reason, promo_code_used to all sync triggers
-- =============================================

BEGIN;

-- Update restaurant_orders → transactions trigger
CREATE OR REPLACE FUNCTION sync_transaction_from_restaurant_order()
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

    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, service_charge, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata, staff_id, cancellation_reason, promo_code_used)
    VALUES (
        NEW.module_id,
        v_engine_type,
        COALESCE(NEW.property_id, v_property_id),
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
        jsonb_build_object('order_number', NEW.order_number, 'order_type', NEW.order_type),
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        tax_amount = EXCLUDED.tax_amount,
        service_charge = EXCLUDED.service_charge,
        discount_amount = EXCLUDED.discount_amount,
        net_amount = EXCLUDED.net_amount,
        completed_at = EXCLUDED.completed_at,
        metadata = EXCLUDED.metadata,
        staff_id = EXCLUDED.staff_id,
        cancellation_reason = EXCLUDED.cancellation_reason,
        promo_code_used = EXCLUDED.promo_code_used;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction ON restaurant_orders;
CREATE TRIGGER trg_sync_transaction
    AFTER INSERT OR UPDATE OF status, payment_status, total_amount ON restaurant_orders
    FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_restaurant_order();

-- Update chalet_bookings → transactions trigger
CREATE OR REPLACE FUNCTION sync_transaction_from_chalet_booking()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata, staff_id, cancellation_reason, promo_code_used)
    VALUES (
        NULL,
        'time_exclusive_reservation',
        NEW.property_id,
        COALESCE(NEW.payment_status, NEW.status, 'pending'),
        COALESCE(NEW.total_amount, 0),
        COALESCE(NEW.total_amount, 0),
        'USD',
        NEW.customer_id,
        NEW.id,
        'chalet_bookings',
        NEW.created_at,
        CASE WHEN NEW.status IN ('checked_out', 'CHECKED_OUT') THEN NEW.updated_at ELSE NULL END,
        jsonb_build_object('booking_number', NEW.booking_number, 'chalet_id', NEW.chalet_id),
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        net_amount = EXCLUDED.net_amount,
        completed_at = EXCLUDED.completed_at,
        metadata = EXCLUDED.metadata,
        staff_id = EXCLUDED.staff_id,
        cancellation_reason = EXCLUDED.cancellation_reason,
        promo_code_used = EXCLUDED.promo_code_used;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction ON chalet_bookings;
CREATE TRIGGER trg_sync_transaction
    AFTER INSERT OR UPDATE OF status, payment_status, total_amount ON chalet_bookings
    FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_chalet_booking();

-- Update pool_tickets → transactions trigger
CREATE OR REPLACE FUNCTION sync_transaction_from_pool_ticket()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, metadata, staff_id, cancellation_reason, promo_code_used)
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
        jsonb_build_object('ticket_number', NEW.ticket_number, 'session_id', NEW.session_id),
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        net_amount = EXCLUDED.net_amount,
        metadata = EXCLUDED.metadata,
        staff_id = EXCLUDED.staff_id,
        cancellation_reason = EXCLUDED.cancellation_reason,
        promo_code_used = EXCLUDED.promo_code_used;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction ON pool_tickets;
CREATE TRIGGER trg_sync_transaction
    AFTER INSERT OR UPDATE OF status, payment_status, total_price ON pool_tickets
    FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_pool_ticket();

-- Update snack_orders → transactions trigger (if table exists)
-- Update snack_orders → transactions trigger (if table exists)
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

    INSERT INTO transactions (module_id, engine_type, property_id, status, amount, tax_amount, discount_amount, net_amount, currency, customer_id, reference_id, reference_table, created_at, completed_at, metadata, staff_id, cancellation_reason, promo_code_used)
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
        jsonb_build_object('order_number', NEW.order_number),
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        tax_amount = EXCLUDED.tax_amount,
        discount_amount = EXCLUDED.discount_amount,
        net_amount = EXCLUDED.net_amount,
        completed_at = EXCLUDED.completed_at,
        metadata = EXCLUDED.metadata,
        staff_id = EXCLUDED.staff_id,
        cancellation_reason = EXCLUDED.cancellation_reason,
        promo_code_used = EXCLUDED.promo_code_used;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_orders') THEN
        DROP TRIGGER IF EXISTS trg_sync_transaction ON snack_orders;
        CREATE TRIGGER trg_sync_transaction
            AFTER INSERT OR UPDATE OF status, payment_status, total_amount ON snack_orders
            FOR EACH ROW EXECUTE FUNCTION sync_transaction_from_snack_order();
    END IF;
END $$;

COMMIT;
