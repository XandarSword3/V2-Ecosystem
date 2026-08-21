-- Engine A — Fulfillment persistence (plan Stage 6).
--
-- Purpose: give the fulfillment layer its own persistence so that
-- `transactions.status` stops carrying fulfillment meaning. The transaction
-- layer owns transactions.status (pending/confirmed/completed/cancelled);
-- the fulfillment layer owns fulfillments.status (queued/in_progress/ready/
-- handed_off, plus terminal completed/cancelled for cross-layer outcomes).
--
--   fulfillments        — one row per transaction with a fulfillment layer
--   fulfillment_events  — append-only transition history (audit)
--
-- RPC:
--   transition_fulfillment — atomic status change + append-only event, with
--     an expected-status guard so concurrent writers cannot clobber each
--     other (the FROM state must match what the caller validated against).
--
-- Backfill: existing instant_transaction rows whose status is a legacy
-- composite (preparing/ready/delivered/served) get a fulfillment row whose
-- status is the canonical equivalent (in_progress/ready/handed_off/handed_off).
-- After this migration, nothing may read fulfillment meaning from
-- transactions.status — the legacy values remain only for historical rows
-- whose fulfillment rows were just created.

-- ============================================================
-- 1. fulfillments
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."fulfillments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "engine_type" character varying(50) NOT NULL,
    "module_id" "uuid",
    "property_id" "uuid",
    "tenant_id" "uuid",
    "status" character varying(50) NOT NULL DEFAULT 'queued',
    "mode" character varying(50),
    "destination_type" character varying(50),
    "destination_ref" text,
    "tracking_ref" text,
    "queued_at" timestamp with time zone,
    "in_progress_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "handed_off_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fulfillments_transaction_id_key" UNIQUE ("transaction_id"),
    CONSTRAINT "fulfillments_transaction_fk" FOREIGN KEY ("transaction_id")
        REFERENCES "public"."transactions" ("id") ON DELETE CASCADE,
    CONSTRAINT "chk_fulfillments_status" CHECK (
        "status" IN ('queued', 'in_progress', 'ready', 'handed_off', 'completed', 'cancelled')
    )
);

ALTER TABLE "public"."fulfillments" OWNER TO "postgres";

COMMENT ON TABLE "public"."fulfillments" IS
    'Canonical fulfillment-layer state. One row per transaction (groups: false for Engine A). '
    'transactions.status never carries fulfillment meaning once this table exists.';

-- ============================================================
-- 2. fulfillment_events (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."fulfillment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fulfillment_id" "uuid" NOT NULL,
    "from_status" character varying(50) NOT NULL,
    "to_status" character varying(50) NOT NULL,
    "action" character varying(50) NOT NULL,
    "actor" character varying(20) NOT NULL,
    "actor_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fulfillment_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fulfillment_events_fulfillment_fk" FOREIGN KEY ("fulfillment_id")
        REFERENCES "public"."fulfillments" ("id") ON DELETE CASCADE
);

ALTER TABLE "public"."fulfillment_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."fulfillment_events" IS
    'Append-only fulfillment transition history (audit trail). UPDATE/DELETE forbidden.';

-- Immutability trigger (mirrors the financial ledger's append-only rule).
CREATE OR REPLACE FUNCTION "public"."_fulfillment_events_immutability"()
RETURNS "trigger" LANGUAGE "plpgsql"
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'fulfillment_events is append-only — UPDATE is forbidden';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'fulfillment_events is append-only — DELETE is forbidden';
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."_fulfillment_events_immutability"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "fulfillment_events_immutability_trigger" ON "public"."fulfillment_events";
CREATE TRIGGER "fulfillment_events_immutability_trigger"
    BEFORE UPDATE OR DELETE ON "public"."fulfillment_events"
    FOR EACH ROW EXECUTE FUNCTION "public"."_fulfillment_events_immutability"();

-- ============================================================
-- 3. transition_fulfillment RPC
-- ============================================================
-- Atomically move a fulfillment row to a new canonical status and append the
-- event. The expected-status guard (p_expected_from) makes the write
-- optimistic: if another writer moved the row since the caller validated its
-- state-machine transition, the call fails instead of silently overwriting.
CREATE OR REPLACE FUNCTION "public"."transition_fulfillment"(
    "p_transaction_id" "uuid",
    "p_to_status" text,
    "p_action" text,
    "p_actor" text,
    "p_actor_id" "uuid" DEFAULT NULL::"uuid",
    "p_expected_from" text DEFAULT NULL::text,
    "p_metadata" "jsonb" DEFAULT '{}'::"jsonb"
)
RETURNS TABLE("success" boolean, "status" text, "error_message" text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fulfillment RECORD;
    v_from_status TEXT;
BEGIN
    SELECT * INTO v_fulfillment
    FROM fulfillments
    WHERE transaction_id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'No fulfillment row for this transaction'::TEXT;
        RETURN;
    END IF;

    v_from_status := v_fulfillment.status;

    IF p_expected_from IS NOT NULL AND p_expected_from != v_from_status THEN
        RETURN QUERY SELECT false, v_from_status,
            format('Fulfillment status changed concurrently: expected %s, found %s',
                   p_expected_from, v_from_status);
        RETURN;
    END IF;

    UPDATE fulfillments SET
        status = p_to_status,
        queued_at = CASE WHEN p_to_status = 'queued' AND queued_at IS NULL THEN now() ELSE queued_at END,
        in_progress_at = CASE WHEN p_to_status = 'in_progress' AND in_progress_at IS NULL THEN now() ELSE in_progress_at END,
        ready_at = CASE WHEN p_to_status = 'ready' AND ready_at IS NULL THEN now() ELSE ready_at END,
        handed_off_at = CASE WHEN p_to_status = 'handed_off' AND handed_off_at IS NULL THEN now() ELSE handed_off_at END,
        completed_at = CASE WHEN p_to_status = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
        cancelled_at = CASE WHEN p_to_status = 'cancelled' AND cancelled_at IS NULL THEN now() ELSE cancelled_at END,
        updated_at = now()
    WHERE id = v_fulfillment.id;

    INSERT INTO fulfillment_events (fulfillment_id, from_status, to_status, action, actor, actor_id, metadata)
    VALUES (v_fulfillment.id, v_from_status, p_to_status, p_action, p_actor, p_actor_id, p_metadata);

    RETURN QUERY SELECT true, p_to_status, NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."transition_fulfillment"("p_transaction_id" "uuid", "p_to_status" text, "p_action" text, "p_actor" text, "p_actor_id" "uuid", "p_expected_from" text, "p_metadata" "jsonb") OWNER TO "postgres";

-- ============================================================
-- 4. ensure_fulfillment RPC (idempotent create-on-confirm)
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
    INSERT INTO fulfillments (transaction_id, engine_type, module_id, property_id, tenant_id, status, mode, destination_type, destination_ref, queued_at)
    VALUES (p_transaction_id, p_engine_type, p_module_id, p_property_id, p_tenant_id, 'queued', p_mode, p_destination_type, p_destination_ref, now())
    ON CONFLICT (transaction_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        SELECT id, status INTO v_id, NULL FROM fulfillments WHERE transaction_id = p_transaction_id;
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
-- 5. Backfill: derive fulfillment rows from legacy composites
-- ============================================================
-- Existing instant_transaction rows may carry legacy fulfillment meaning in
-- transactions.status (preparing/ready/delivered/served). Create the
-- canonical fulfillment row so production code can stop reading fulfillment
-- meaning from transactions.status from now on.
INSERT INTO fulfillments (transaction_id, engine_type, module_id, property_id, tenant_id, status, queued_at, in_progress_at, ready_at, handed_off_at, completed_at, cancelled_at, created_at, updated_at)
SELECT
    t.id,
    t.engine_type,
    t.module_id,
    t.property_id,
    t.tenant_id,
    CASE t.status
        WHEN 'pending'   THEN 'queued'
        WHEN 'confirmed' THEN 'queued'
        WHEN 'preparing' THEN 'in_progress'
        WHEN 'ready'     THEN 'ready'
        WHEN 'delivered' THEN 'handed_off'
        WHEN 'served'    THEN 'handed_off'
        WHEN 'completed' THEN 'completed'
        WHEN 'cancelled' THEN 'cancelled'
        ELSE 'queued'
    END,
    now(),
    CASE WHEN t.status = 'preparing' THEN now() END,
    CASE WHEN t.status = 'ready' THEN now() END,
    CASE WHEN t.status IN ('delivered', 'served', 'completed') THEN now() END,
    CASE WHEN t.status = 'completed' THEN now() END,
    CASE WHEN t.status = 'cancelled' THEN now() END,
    now(),
    now()
FROM transactions t
WHERE t.engine_type = 'instant_transaction'
  AND NOT EXISTS (SELECT 1 FROM fulfillments f WHERE f.transaction_id = t.id);

-- Event rows for backfilled fulfillments (from 'none' to the canonical state).
INSERT INTO fulfillment_events (fulfillment_id, from_status, to_status, action, actor, metadata, occurred_at)
SELECT f.id, 'none', f.status, 'backfill', 'system', jsonb_build_object('reason', 'Stage 6 backfill from transactions.status'), now()
FROM fulfillments f
WHERE NOT EXISTS (SELECT 1 FROM fulfillment_events e WHERE e.fulfillment_id = f.id);
