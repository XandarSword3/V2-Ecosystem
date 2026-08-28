-- Engine A — digital delivery is a FULFILLMENT MODE of instant_transaction,
-- not a sixth engine type.
--
-- The digital fulfillment ADAPTER (adapters/digital/fulfillment.ts) is kept —
-- it is the proof that Engine A can fulfill through radically different
-- adapters. But the digital_delivery ENGINE (registered in
-- 20260821160000) is reverted: digital delivery rides on Engine A's
-- capability contract as one more mode/destination option with its own
-- machine binding. No new engine semantics.
--
-- This migration:
--   1. reverts the engine_type CHECK constraints to the canonical 5 engines;
--   2. restructures engine_fulfillment_capabilities from per-engine rows to
--      per (engine_type, mode) rows — the initial fulfillment status is a
--      per-MODE fact (hospitality modes start at 'queued', digital_delivery
--      starts at 'provisioning' — each adapter's machine declares its own
--      initial state), and the trigger/RPC look it up per mode;
--   3. reseeds the registry mirror per mode, mirroring the TypeScript
--      engine registry's modeMachines bindings;
--   4. rewrites ensure_fulfillment + the confirm trigger to look up the
--      capability row by (engine_type, mode) — still zero hardcoded engine
--      or status literals in the persistence layer.

-- ============================================================
-- 1. engine_type CHECK constraints — back to the 5 engines
-- ============================================================

ALTER TABLE "public"."engine_state_transitions" DROP CONSTRAINT IF EXISTS "chk_est_engine_type";
ALTER TABLE "public"."engine_state_transitions" ADD CONSTRAINT "chk_est_engine_type" CHECK (("engine_type" = ANY (ARRAY['instant_transaction'::"text", 'time_exclusive_reservation'::"text", 'shared_capacity_access'::"text", 'ongoing_entitlement'::"text", 'platform_entitlement'::"text"])));

ALTER TABLE "public"."modules" DROP CONSTRAINT IF EXISTS "chk_modules_engine_type";
ALTER TABLE "public"."modules" ADD CONSTRAINT "chk_modules_engine_type" CHECK (((("engine_type")::"text") = ANY ((ARRAY['instant_transaction'::character varying, 'time_exclusive_reservation'::character varying, 'shared_capacity_access'::character varying, 'ongoing_entitlement'::character varying, 'platform_entitlement'::character varying])::"text"[])));

-- ============================================================
-- 2. engine_fulfillment_capabilities → per (engine_type, mode)
-- ============================================================

ALTER TABLE "public"."engine_fulfillment_capabilities" DROP CONSTRAINT IF EXISTS "engine_fulfillment_capabilities_pkey";
ALTER TABLE "public"."engine_fulfillment_capabilities" ADD COLUMN IF NOT EXISTS "mode" text;

-- The digital_delivery ENGINE row is gone — digital delivery now exists as
-- a MODE of instant_transaction (seeded below). Engines with no fulfillment
-- layer carry no capability rows at all (the trigger's NOT FOUND path
-- handles them) — their per-engine rows are dropped.
DELETE FROM "public"."engine_fulfillment_capabilities" WHERE "engine_type" = 'digital_delivery';
DELETE FROM "public"."engine_fulfillment_capabilities" WHERE NOT "required";
-- The old engine-level instant_transaction row is replaced by per-mode rows.
DELETE FROM "public"."engine_fulfillment_capabilities" WHERE "engine_type" = 'instant_transaction';

ALTER TABLE "public"."engine_fulfillment_capabilities" ALTER COLUMN "mode" SET NOT NULL;
ALTER TABLE "public"."engine_fulfillment_capabilities" ADD CONSTRAINT "engine_fulfillment_capabilities_pkey" PRIMARY KEY ("engine_type", "mode");

COMMENT ON TABLE "public"."engine_fulfillment_capabilities" IS
    'Capability registry mirror for the persistence layer, keyed per (engine_type, mode): '
    'which engine/mode pairs require a fulfillment layer and in which initial status the '
    'fulfillment row is created (each adapter machine declares its own initial state — '
    'hospitality starts at queued, digital_delivery at provisioning). Seeded from the '
    'TypeScript engine registry; the confirm trigger reads this table instead of '
    'hardcoding engine types or statuses.';

-- ============================================================
-- 3. Reseed the registry mirror per (engine_type, mode)
-- ============================================================
-- Mirrors src/engines/definitions/instant-transaction.ts modeMachines: the
-- hospitality binding (on_premise/pickup/local_delivery → hospitality
-- machine, initialState 'queued', handoff modeled) and the digital binding
-- (digital_delivery → digital machine, initialState 'provisioning', delivery
-- to the digital account IS the handoff — no separate handoff step).
INSERT INTO "public"."engine_fulfillment_capabilities" ("engine_type", "mode", "required", "handoff", "initial_status") VALUES
    ('instant_transaction', 'on_premise',       true,  true,  'queued'),
    ('instant_transaction', 'pickup',           true,  true,  'queued'),
    ('instant_transaction', 'local_delivery',   true,  true,  'queued'),
    ('instant_transaction', 'digital_delivery', true,  false, 'provisioning')
ON CONFLICT ("engine_type", "mode") DO UPDATE SET
    "required" = EXCLUDED."required",
    "handoff" = EXCLUDED."handoff",
    "initial_status" = EXCLUDED."initial_status",
    "updated_at" = now();

-- ============================================================
-- 4. ensure_fulfillment — per-mode initial status
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

    -- The initial state comes from the capability table, keyed by
    -- (engine_type, mode) — the persistence layer never hardcodes a vertical
    -- status literal (queued is hospitality's, provisioning is digital's).
    SELECT initial_status INTO v_initial_status
    FROM engine_fulfillment_capabilities
    WHERE engine_type = p_engine_type AND mode = p_mode;

    IF v_initial_status IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT,
            format('No fulfillment capability declared for engine %L mode %L — cannot initialize', p_engine_type, p_mode)::TEXT;
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
-- 5. The generic confirm trigger — per-mode capability lookup
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
    IF NEW.status <> 'confirmed' THEN
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
            -- A mode-less confirm is only legal for engines without a
            -- fulfillment layer (they carry no capability rows at all).
            SELECT required INTO v_required
            FROM engine_fulfillment_capabilities
            WHERE engine_type = NEW.engine_type
            LIMIT 1;
            IF FOUND AND v_required THEN
                RAISE EXCEPTION
                    'Fulfillment selection missing for confirmed transaction % (engine %): fulfillment_mode must be snapshotted before confirmation',
                    NEW.id, NEW.engine_type;
            END IF;
            RETURN NEW;
        END IF;

        -- Required-fulfillment intent AND the initial status come from the
        -- CAPABILITY TABLE, keyed by (engine_type, mode) — never a hardcoded
        -- engine list or status literal.
        SELECT required, initial_status INTO v_required, v_initial_status
        FROM engine_fulfillment_capabilities
        WHERE engine_type = NEW.engine_type AND mode = v_mode;

        IF NOT FOUND THEN
            -- The engine does not offer this mode. If it requires fulfillment
            -- at all, the snapshotted selection violates the capability
            -- contract — fail the confirm rather than create an unroutable row.
            SELECT required INTO v_required
            FROM engine_fulfillment_capabilities
            WHERE engine_type = NEW.engine_type
            LIMIT 1;
            IF FOUND AND v_required THEN
                RAISE EXCEPTION
                    'Fulfillment mode % is not offered by engine % — the snapshotted selection violates the capability contract',
                    v_mode, NEW.engine_type;
            END IF;
            RETURN NEW;
        END IF;

        IF NOT v_required THEN
            RETURN NEW;
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
