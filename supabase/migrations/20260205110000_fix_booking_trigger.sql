-- Fix trigger that references wrong column names
-- The trigger record_booking_price() uses total_price and base_price
-- but the actual columns are total_amount and base_amount

BEGIN;

-- Recreate the function with corrected column names
CREATE OR REPLACE FUNCTION record_booking_price()
RETURNS TRIGGER AS $$
DECLARE
    v_chalet_id UUID;
    v_check_in_date DATE;
    v_base_amount NUMERIC;
    v_total_amount NUMERIC;
    v_rules JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'price_history'
    ) THEN
        RETURN NEW;
    END IF;

    v_chalet_id := COALESCE(
        NULLIF(to_jsonb(NEW)->>'chalet_id', '')::UUID,
        NULLIF(to_jsonb(NEW)->>'unit_id', '')::UUID
    );
    v_check_in_date := COALESCE(
        NULLIF(to_jsonb(NEW)->>'check_in_date', '')::DATE,
        NULLIF(to_jsonb(NEW)->>'start_date', '')::DATE
    );
    v_base_amount := COALESCE(
        NULLIF(to_jsonb(NEW)->>'base_amount', '')::NUMERIC,
        NULLIF(to_jsonb(NEW)->>'base_price', '')::NUMERIC,
        NULLIF(to_jsonb(NEW)->>'total_amount', '')::NUMERIC,
        NULLIF(to_jsonb(NEW)->>'total_price', '')::NUMERIC
    );
    v_total_amount := COALESCE(
        NULLIF(to_jsonb(NEW)->>'total_amount', '')::NUMERIC,
        NULLIF(to_jsonb(NEW)->>'total_price', '')::NUMERIC,
        v_base_amount
    );
    v_rules := COALESCE(to_jsonb(NEW)->'pricing_rules_applied', '[]'::jsonb);

    INSERT INTO price_history (
        item_type,
        item_id,
        base_price,
        final_price,
        applied_rules,
        booking_date,
        check_in_date
    ) VALUES (
        'chalets',
        v_chalet_id,
        v_base_amount,
        v_total_amount,
        v_rules,
        CURRENT_DATE,
        v_check_in_date
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'chalet_bookings'
    ) THEN
        DROP TRIGGER IF EXISTS trigger_record_booking_price ON chalet_bookings;
        CREATE TRIGGER trigger_record_booking_price
            AFTER INSERT ON chalet_bookings
            FOR EACH ROW
            EXECUTE FUNCTION record_booking_price();
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bookings'
    ) THEN
        DROP TRIGGER IF EXISTS trigger_record_booking_price ON bookings;
        CREATE TRIGGER trigger_record_booking_price
            AFTER INSERT ON bookings
            FOR EACH ROW
            EXECUTE FUNCTION record_booking_price();
    END IF;
END $$;

COMMIT;
