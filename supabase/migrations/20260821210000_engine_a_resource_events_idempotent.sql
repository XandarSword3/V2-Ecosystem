-- Engine A, plan Phase 5: idempotent resource event recording.
--
-- The Phase-5 consume/release RPCs (20260821180000) recorded events by
-- re-selecting rows in the target status AFTER the UPDATE. That is wrong in
-- two ways, both surfaced by wiring the lifecycle driver into the order
-- choke point:
--
--   1. A repeat call (e.g. consumption fires at handoff AND again at
--      complete — both reach the handoff condition) re-inserted events for
--      rows this call did NOT transition, duplicating the audit trail.
--   2. release_resources recorded from_status = 'released' (the NEW status
--      of the re-selected rows) instead of the row's pre-release status
--      ('allocated' / 'consumed'), so the event lied about what happened.
--
-- The fix: snapshot the rows a call WILL transition (id + true from_status)
-- BEFORE the UPDATE, then drive the event insert from that snapshot. A
-- repeat call snapshots zero rows, updates zero rows, and emits zero events.
-- Allocation rows themselves were already idempotent (ON CONFLICT DO
-- NOTHING); this makes the append-only event trail honest under the same
-- exactly-once discipline.
--
-- Latest definition is the law (same pattern as the 20260821190000 trigger
-- rewrite): this CREATE OR REPLACE supersedes the 20260821180000 bodies.

CREATE OR REPLACE FUNCTION "public"."consume_resources"(
    "p_transaction_id" "uuid",
    "p_engine_type" text,
    "p_action" text,
    "p_actor" text,
    "p_actor_id" "uuid" DEFAULT NULL::"uuid"
)
RETURNS TABLE("success" boolean, "consumed" integer, "error_message" text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Snapshot ONLY the rows this call will transition ('allocated').
    -- A repeat call (handoff then complete) snapshots zero rows.
    CREATE TEMP TABLE _consumed_rows ON COMMIT DROP AS
    SELECT id
    FROM resource_allocations
    WHERE transaction_id = p_transaction_id
      AND engine_type = p_engine_type
      AND status = 'allocated';

    UPDATE resource_allocations ra
    SET status = 'consumed', consumed_at = now(), updated_at = now()
    FROM _consumed_rows c
    WHERE ra.id = c.id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO resource_allocation_events (allocation_id, from_status, to_status, action, actor, actor_id)
    SELECT id, 'allocated', 'consumed', p_action, p_actor, p_actor_id
    FROM _consumed_rows;

    RETURN QUERY SELECT true, v_count, NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."consume_resources"("p_transaction_id" "uuid", "p_engine_type" text, "p_action" text, "p_actor" text, "p_actor_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."release_resources"(
    "p_transaction_id" "uuid",
    "p_engine_type" text,
    "p_action" text,
    "p_actor" text,
    "p_actor_id" "uuid" DEFAULT NULL::"uuid"
)
RETURNS TABLE("success" boolean, "released" integer, "error_message" text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Snapshot id + TRUE pre-release status ('allocated' / 'consumed'),
    -- so the event records what the row actually was before release.
    CREATE TEMP TABLE _released_rows ON COMMIT DROP AS
    SELECT id, status AS from_status
    FROM resource_allocations
    WHERE transaction_id = p_transaction_id
      AND engine_type = p_engine_type
      AND status IN ('allocated', 'consumed');

    UPDATE resource_allocations ra
    SET status = 'released', released_at = now(), updated_at = now()
    FROM _released_rows r
    WHERE ra.id = r.id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO resource_allocation_events (allocation_id, from_status, to_status, action, actor, actor_id)
    SELECT id, from_status, 'released', p_action, p_actor, p_actor_id
    FROM _released_rows;

    RETURN QUERY SELECT true, v_count, NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."release_resources"("p_transaction_id" "uuid", "p_engine_type" text, "p_action" text, "p_actor" text, "p_actor_id" "uuid") OWNER TO "postgres";
