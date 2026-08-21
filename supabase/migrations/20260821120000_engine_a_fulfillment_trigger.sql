-- Engine A — Fulfillment initialization coupled to economic confirmation
-- (plan Stage 6 fix).
--
-- Requirement: fulfillment initialization must be TRANSACTIONALLY coupled to
-- the confirm transition — never "confirm first, self-heal later". This
-- trigger makes the fulfillment row's creation part of the SAME statement as
-- the transactions.status UPDATE to 'confirmed'. If the insert fails for any
-- reason, the whole confirm UPDATE rolls back and the order stays 'pending':
-- an order can never be economically confirmed without its fulfillment layer
-- initialized, and the two can never diverge.
--
-- mode/destination are intentionally NOT copied from arbitrary metadata here:
-- a trigger cannot validate selections against the engine capability
-- contract. The row is created queued with NULL mode/destination; selections
-- are validated (typed domain values, per the engine's declared options) by
-- the explicit create API (FulfillmentService.ensure) when a caller supplies
-- them, before any write.

CREATE OR REPLACE FUNCTION "public"."_ensure_fulfillment_on_confirm"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
    v_fulfillment_id "uuid";
BEGIN
    -- Only the economic confirm of a required-fulfillment engine. The
    -- DISTINCT guard means re-setting status to the same value never
    -- re-fires; a second insert is impossible anyway (unique
    -- transaction_id + ON CONFLICT DO NOTHING).
    IF NEW.engine_type = 'instant_transaction'
       AND NEW.status = 'confirmed'
       AND OLD.status IS DISTINCT FROM 'confirmed' THEN

        INSERT INTO fulfillments
            (transaction_id, engine_type, module_id, property_id, tenant_id, status, queued_at)
        VALUES
            (NEW.id, NEW.engine_type, NEW.module_id, NEW.property_id, NEW.tenant_id, 'queued', now())
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id INTO v_fulfillment_id;

        IF v_fulfillment_id IS NOT NULL THEN
            INSERT INTO fulfillment_events (fulfillment_id, from_status, to_status, action, actor, metadata)
            VALUES (v_fulfillment_id, 'none', 'queued', 'queue_fulfillment', 'system',
                    jsonb_build_object('reason', 'transaction confirmed (trigger)'));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."_ensure_fulfillment_on_confirm"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "ensure_fulfillment_on_confirm" ON "public"."transactions";
CREATE TRIGGER "ensure_fulfillment_on_confirm"
    AFTER UPDATE OF "status" ON "public"."transactions"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."_ensure_fulfillment_on_confirm"();
