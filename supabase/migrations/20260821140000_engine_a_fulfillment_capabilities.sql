-- Engine A — capability-driven fulfillment boundary (plan Stage 6 fix).
--
-- Two corrections to the confirm trigger:
--
-- 1. NO hardcoded engine list in the persistence layer. The trigger no
--    longer contains `engine_type = 'instant_transaction'`. Required-
--    fulfillment intent lives in the engine_fulfillment_capabilities table
--    (a controlled registry mirror, seeded here from the TypeScript engine
--    registry). A future engine that declares required fulfillment adds a
--    capability row — the generic trigger needs no change.
--
-- 2. Selection is mandatory before confirmation and snapshotted AT
--    confirmation. Order creation resolves a typed, capability-validated
--    selection and writes it to transactions.metadata (fulfillment_mode /
--    fulfillment_destination_type / fulfillment_destination_ref). This
--    trigger copies that snapshot verbatim into the fulfillment row in the
--    SAME statement as the confirm — and REFUSES to confirm an order whose
--    selection is missing. NULL mode never means "we haven't decided yet".
--
-- The trigger fires on INSERT too (staff can create orders directly as
-- 'confirmed'), not just UPDATE.

-- ============================================================
-- 1. engine_fulfillment_capabilities — capability registry
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."engine_fulfillment_capabilities" (
    "engine_type" text NOT NULL,
    "required" boolean NOT NULL DEFAULT false,
    "handoff" boolean NOT NULL DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "engine_fulfillment_capabilities_pkey" PRIMARY KEY ("engine_type")
);

ALTER TABLE "public"."engine_fulfillment_capabilities" OWNER TO "postgres";

COMMENT ON TABLE "public"."engine_fulfillment_capabilities" IS
    'Capability registry mirror for the persistence layer: which engines require a fulfillment '
    'layer. Seeded from the TypeScript engine registry; the confirm trigger reads this table '
    'instead of hardcoding engine types.';

-- Seed from the current TypeScript registry (see src/engines/registry.ts).
-- Only instant_transaction declares required fulfillment today.
INSERT INTO "public"."engine_fulfillment_capabilities" ("engine_type", "required", "handoff") VALUES
    ('instant_transaction',       true,  true),
    ('time_exclusive_reservation', false, false),
    ('shared_capacity_access',     false, false),
    ('ongoing_entitlement',        false, false),
    ('platform_entitlement',       false, false)
ON CONFLICT ("engine_type") DO UPDATE SET
    "required" = EXCLUDED."required",
    "handoff" = EXCLUDED."handoff",
    "updated_at" = now();

-- ============================================================
-- 2. Backfill mode/destination for historical rows
-- ============================================================
-- Existing fulfillment rows were created with NULL mode/destination. Derive
-- the canonical selection from the transaction's commercial snapshot (order
-- type + location), defaulting to on_premise — the hospitality default.
UPDATE "public"."fulfillments" f
SET
    "mode" = CASE
        WHEN t.metadata->>'order_type' IN ('takeaway', 'counter') THEN 'pickup'
        WHEN t.metadata->>'order_type' = 'delivery' THEN 'local_delivery'
        ELSE 'on_premise'
    END,
    "destination_type" = CASE
        WHEN t.metadata->>'order_type' IN ('takeaway', 'counter') THEN 'pickup_location'
        WHEN t.metadata->>'order_type' = 'delivery' THEN 'address'
        ELSE 'on_premise_location'
    END,
    "destination_ref" = COALESCE(
        t.service_location_id::text,
        t.metadata->>'table_number',
        f.destination_ref
    ),
    "updated_at" = now()
FROM "public"."transactions" t
WHERE f.transaction_id = t.id
  AND f.mode IS NULL;

-- ============================================================
-- 3. Mandatory selection — mode/destination_type are never null
-- ============================================================
-- The invariant: a fulfillment selection is snapshotted before confirmation
-- and cannot be lost or "resolved differently" later. After the backfill
-- above and the trigger below (which refuses to confirm without a
-- selection), every row carries one.
ALTER TABLE "public"."fulfillments" ALTER COLUMN "mode" SET NOT NULL;
ALTER TABLE "public"."fulfillments" ALTER COLUMN "destination_type" SET NOT NULL;

-- ============================================================
-- 4. ensure_fulfillment — explicit create API requires a selection
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
BEGIN
    IF p_mode IS NULL OR p_mode = '' THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT,
            'Fulfillment mode is mandatory — a selection must be snapshotted before confirmation, never left null'::TEXT;
        RETURN;
    END IF;

    INSERT INTO fulfillments (transaction_id, engine_type, module_id, property_id, tenant_id, status, mode, destination_type, destination_ref, queued_at)
    VALUES (p_transaction_id, p_engine_type, p_module_id, p_property_id, p_tenant_id, 'queued', p_mode, p_destination_type, p_destination_ref, now())
    ON CONFLICT (transaction_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM fulfillments WHERE transaction_id = p_transaction_id;
        RETURN QUERY SELECT true, v_id, 'existing'::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    INSERT INTO fulfillment_events (fulfillment_id, from_status, to_status, action, actor, metadata)
    VALUES (v_id, 'none', 'queued', 'queue_fulfillment', 'system', '{"reason": "transaction confirmed"}'::jsonb);

    RETURN QUERY SELECT true, v_id, 'queued'::TEXT, NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."ensure_fulfillment"("p_transaction_id" "uuid", "p_engine_type" text, "p_module_id" "uuid", "p_property_id" "uuid", "p_tenant_id" "uuid", "p_mode" text, "p_destination_type" text, "p_destination_ref" text) OWNER TO "postgres";

-- ============================================================
-- 5. The generic confirm trigger (replaces the hardcoded one)
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."_ensure_fulfillment_on_confirm"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
    v_required boolean;
    v_fulfillment_id "uuid";
    v_mode text;
    v_destination_type text;
    v_destination_ref text;
BEGIN
    -- Required-fulfillment intent comes from the CAPABILITY TABLE, never a
    -- hardcoded engine list (generic persistence boundary).
    SELECT required INTO v_required
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
            (NEW.id, NEW.engine_type, NEW.module_id, NEW.property_id, NEW.tenant_id, 'queued',
             v_mode, v_destination_type, v_destination_ref, now())
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id INTO v_fulfillment_id;

        IF v_fulfillment_id IS NOT NULL THEN
            INSERT INTO fulfillment_events (fulfillment_id, from_status, to_status, action, actor, metadata)
            VALUES (v_fulfillment_id, 'none', 'queued', 'queue_fulfillment', 'system',
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
