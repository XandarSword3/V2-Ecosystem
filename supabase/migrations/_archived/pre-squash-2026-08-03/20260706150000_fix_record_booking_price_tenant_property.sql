-- Same NOT-NULL-column-never-populated pattern as reserve_unit_exclusive_atomic, one
-- layer deeper: record_booking_price() fires AFTER INSERT/UPDATE on transactions and
-- writes to price_history, but price_history.tenant_id/property_id are NOT NULL with
-- no default and this function never set them. Every real booking insert/confirm was
-- failing here once the transactions-level tenant_id/property_id bug was fixed.
-- Fix: pass NEW.tenant_id/NEW.property_id through — both are populated on the
-- transactions row by the time this trigger fires.
CREATE OR REPLACE FUNCTION public.record_booking_price()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only act on time_exclusive_reservation (accommodation bookings)
    IF NEW.engine_type != 'time_exclusive_reservation' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'confirmed') THEN
        INSERT INTO price_history (
            item_type,
            item_id,
            base_price,
            final_price,
            applied_rules,
            booking_date,
            check_in_date,
            tenant_id,
            property_id
        ) VALUES (
            'accommodation',
            COALESCE((NEW.metadata->>'unit_id')::UUID, NEW.module_id),
            COALESCE((NEW.metadata->>'base_price')::DECIMAL, NEW.amount),
            NEW.amount,
            COALESCE((NEW.metadata->'pricing_rules_applied'), '[]'::jsonb),
            CURRENT_DATE,
            (NEW.metadata->>'check_in_date')::DATE,
            NEW.tenant_id,
            NEW.property_id
        );
    END IF;
    RETURN NEW;
END;
$function$;
