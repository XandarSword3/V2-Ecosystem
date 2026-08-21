-- Engine A — capability-declared initial fulfillment status (Phase 4 fix).
--
-- The confirm trigger and ensure_fulfillment RPC hardcoded 'queued' as the
-- initial fulfillment status. 'queued' is the HOSPITALITY machine's initial
-- state — the digital second vertical (Phase 4) starts at 'provisioning'.
-- A hardcoded 'queued' row would be rejected by the digital machine, so the
-- persistence layer must not assume one vertical's vocabulary.
--
-- Fix: the capability table now declares `initial_status` per engine
-- (mirroring the TypeScript registry's fulfillment machine initialState),
-- and the trigger/RPC read it from there — no status literal in the
-- persistence layer.

-- ============================================================
-- 1. Capability table gains initial_status
-- ============================================================

ALTER TABLE "public"."engine_fulfillment_capabilities"
    ADD COLUMN IF NOT EXISTS "initial_status" text NOT NULL DEFAULT 'queued';

COMMENT ON COLUMN "public"."engine_fulfillment_capabilities"."initial_status" IS
    'The fulfillment machine''s declared initial state (mirrors the TypeScript registry). '
    'The confirm trigger and ensure RPC create rows in THIS state, never a hardcoded '
    'vertical status like queued.';

-- ============================================================
-- 2. Reseed with the registry's initial states
-- ============================================================

INSERT INTO "public"."engine_fulfillment_capabilities" ("engine_type", "required", "handoff", "initial_status") VALUES
    ('instant_transaction',       true,  true,  'queued'),
    ('time_exclusive_reservation', false, false, 'queued'),
    ('shared_capacity_access',     false, false, 'queued'),
    ('ongoing_entitlement',        false, false, 'queued'),
    ('platform_entitlement',       false, false, 'queued'),
    ('digital_delivery',           true,  false, 'provisioning')
ON CONFLICT ("engine_type") DO UPDATE SET
    "required" = EXCLUDED."required",
    "handoff" = EXCLUDED."handoff",
    "initial_status" = EXCLUDED."initial_status",
    "updated_at" = now();

-- ============================================================
-- 3. ensure_fulfillment — read initial status from the capability table
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."ensure_fulfillment"(
    "p_transaction_id" "uuid",
    "p_engine_type" text,
    "p_module_id" "uuid" DEFAULT NULL::"uuid",
    "p_property_id" "uuid" DEFAULT NULL::"uuid",
    "p_tenant_id" "uuid" DEFAULT NULL::"uuid",
    "p_mode" text DEFAULT NULL::text,
    "p_destination_type" text DEFAULT NULL::text,
    "p_destination_ref" text DEFAULT NULL::text
)
RETURNS TABLE("success" boolean, "fulfillment_id" "uuid", "status" text, "error_message" text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_initial_status text;
BEGIN
    IF p_mode IS NULL OR p_mode = '' THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT,
            'Fulfillment mode is mandatory — a selection must be snapshotted before confirmation, never left null'::TEXT;
        RETURN;
    END IF;

    -- The initial state comes from the capability table — the persistence
    -- layer never hardcodes a vertical status literal.
    SELECT initial_status INTO v_initial_status
    FROM engine_fulfillment_capabilities
    WHERE engine_type = p_engine_type;

    IF v_initial_status IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT,
            format('No fulfillment capability declared for engine %L — cannot initialize', p_engine_type)::TEXT;
        RETURN;
    END IF;

    INSERT INTO fulfillments (transaction_id, engine_type, module_id, property_id, tenant_id, status, mode, destination_type, destination_ref, queued_at)
    VALUES (p_transaction_id, p_engine_type, p_module_id, p_property_id, p_tenant_id, v_initial_status, p_mode, p_destination_type, p_destination_ref, now())
    ON CONFLICT (transaction_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM fulfillments WHERE transaction_id = p_transaction_id;
        RETURN QUERY SELECT true, v_id, 'existing'::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    INSERT INTO fulfillment_events (fulfillment_id, from_status, to_status, action, actor, metadata)
    VALUES (v_id, 'none', v_initial_status, 'queue_fulfillment', 'system', '{"reason": "transaction confirmed"}'::jsonb);

    RETURN QUERY SELECT true, v_id, v_initial_status::TEXT, NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."ensure_fulfillment"("p_transaction_id" "uuid", "p_engine_type" text, "p_module_id" "uuid", "p_property_id" "uuid", "p_tenant_id" "uuid", "p_mode" text, "p_destination_type" text, "p_destination_ref" text) OWNER TO "postgres";

-- ============================================================
-- 4. The generic confirm trigger — initial status from capability
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."_ensure_fulfillment_on_confirm"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
    v_required boolean;
    v_initial_status text;
    v_fulfillment_id "uuid";
    v_mode text;
    v_destination_type text;
    v_destination_ref text;
BEGIN
    -- Required-fulfillment intent AND the initial status come from the
    -- CAPABILITY TABLE, never a hardcoded engine list or status literal.
    SELECT required, initial_status INTO v_required, v_initial_status
    FROM engine_fulfillment_capabilities
    WHERE engine_type = NEW.engine_type;

    IF NOT FOUND OR NOT v_required OR NEW.status <> 'confirmed' THEN
        RETURN NEW;
    END IF;

    -- Fires on INSERT (staff create orders directly as 'confirmed') and on
    -- UPDATE pending → confirmed. The DISTINCT guard prevents re-firing when
    -- status is re-set to the same value.
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed' THEN
        -- The selection was snapshotted at order creation (typed,
        -- capability-validated). Copy it VERBATIM — confirmation and its
        -- selection are one atomic act. Absence is a contract violation:
        -- the confirm FAILS rather than create an ambiguous row.
        v_mode := NEW.metadata->>'fulfillment_mode';
        v_destination_type := NEW.metadata->>'fulfillment_destination_type';
        v_destination_ref := NEW.metadata->>'fulfillment_destination_ref';

        IF v_mode IS NULL OR v_mode = '' THEN
            RAISE EXCEPTION
                'Fulfillment selection missing for confirmed transaction % (engine %): fulfillment_mode must be snapshotted before confirmation',
                NEW.id, NEW.engine_type;
        END IF;

        INSERT INTO fulfillments
            (transaction_id, engine_type, module_id, property_id, tenant_id, status,
             mode, destination_type, destination_ref, queued_at)
        VALUES
            (NEW.id, NEW.engine_type, NEW.module_id, NEW.property_id, NEW.tenant_id, v_initial_status,
             v_mode, v_destination_type, v_destination_ref, now())
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id INTO v_fulfillment_id;

        IF v_fulfillment_id IS NOT NULL THEN
            INSERT INTO fulfillment_events (fulfillment_id, from_status, to_status, action, actor, metadata)
            VALUES (v_fulfillment_id, 'none', v_initial_status, 'queue_fulfillment', 'system',
                    jsonb_build_object('reason', 'transaction confirmed (trigger)', 'mode', v_mode));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."_ensure_fulfillment_on_confirm"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "ensure_fulfillment_on_confirm" ON "public"."transactions";
CREATE TRIGGER "ensure_fulfillment_on_confirm"
    AFTER INSERT OR UPDATE OF "status" ON "public"."transactions"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."_ensure_fulfillment_on_confirm"();
