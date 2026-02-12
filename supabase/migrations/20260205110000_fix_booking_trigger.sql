-- Fix trigger that references wrong column names
-- The trigger record_booking_price() uses total_price and base_price
-- but the actual columns are total_amount and base_amount

BEGIN;

-- Drop the old trigger
DROP TRIGGER IF EXISTS trigger_record_booking_price ON chalet_bookings;

-- Recreate the function with corrected column names
CREATE OR REPLACE FUNCTION record_booking_price()
RETURNS TRIGGER AS $$
BEGIN
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
        NEW.chalet_id,
        COALESCE(NEW.base_amount, NEW.total_amount), -- Changed from base_price/total_price
        NEW.total_amount, -- Changed from total_price
        COALESCE(NEW.pricing_rules_applied, '[]'::jsonb),
        CURRENT_DATE,
        NEW.check_in_date
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_record_booking_price
    AFTER INSERT ON chalet_bookings
    FOR EACH ROW
    EXECUTE FUNCTION record_booking_price();

COMMIT;
