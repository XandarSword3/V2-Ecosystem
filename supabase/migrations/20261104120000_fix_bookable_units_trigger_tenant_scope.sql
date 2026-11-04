-- Fix bookable_units INSTEAD OF trigger: stamp tenant_id/property_id on insert.
--
-- Defect: accommodation_units requires tenant_id and property_id (both NOT
-- NULL, no defaults), but the bookable_units view trigger inserted rows
-- without either — every INSERT through the view failed with 23502. The
-- commit handler in dynamic-module.router.ts worked around nothing: it also
-- passed tenant_id/property_id to the VIEW, which does not expose those
-- columns (PGRST204), so Engine B (time_exclusive_reservation) unit creation
-- via /import/commit silently failed per item while reporting success.
--
-- Fix: resolve tenant/property from the mounted module (the scope carrier,
-- same as every other engine write path) inside the trigger, and fail with a
-- clear message when the module is unknown.

CREATE OR REPLACE FUNCTION "public"."bookable_units_view_trigger"() RETURNS "trigger"
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        DECLARE
            v_tenant_id UUID;
            v_property_id UUID;
        BEGIN
            SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
            FROM modules WHERE id = NEW.module_id;

            IF v_tenant_id IS NULL THEN
                RAISE EXCEPTION 'bookable_units insert: module % not found; cannot resolve tenant scope', NEW.module_id;
            END IF;

            INSERT INTO accommodation_units (
                name, description,
                base_price, weekend_price, capacity,
                is_active, module_id,
                tenant_id, property_id
            ) VALUES (
                NEW.name, NEW.description,
                COALESCE(NEW.base_price, NEW.price), NEW.weekend_price, NEW.capacity,
                COALESCE(NEW.is_active, true), NEW.module_id,
                v_tenant_id, v_property_id
            ) RETURNING id INTO NEW.id;
            RETURN NEW;
        END;
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
$$;
