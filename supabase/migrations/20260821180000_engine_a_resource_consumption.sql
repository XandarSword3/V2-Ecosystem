-- Engine A — Phase 5: generic resource-consumption persistence.
--
-- The generic resource/consumption system (plan Phase 5). Transactions with a
-- resource-consuming engine get typed allocations: allocate (reserve) at the
-- engine's allocation point, consume (deduct) at its consumption point,
-- release (restore) on cancellation — all driven by the engine's DECLARED
-- resource model, never by vertical logic in the DB.
--
-- Hardened from day one (learned from the fiscal/fulfillment RLS review):
-- RLS enabled with tenant/property-scoped policies using the schema's access
-- helpers, anon revoked, events append-only, SECURITY DEFINER RPCs
-- service_role-only. No USING (true) anywhere.

-- ============================================================
-- 1. resource_allocations
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."resource_allocations" (
    "id" uuid DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" uuid NOT NULL,
    "engine_type" character varying(50) NOT NULL,
    "kind" character varying(50) NOT NULL,
    "resource_ref" text NOT NULL,
    "quantity" numeric(12,4) NOT NULL,
    "unit" character varying(30),
    "status" character varying(20) NOT NULL DEFAULT 'allocated',
    "property_id" uuid,
    "tenant_id" uuid,
    "allocated_at" timestamp with time zone,
    "consumed_at" timestamp with time zone,
    "released_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "resource_allocations_status_check" CHECK (("status" = ANY (ARRAY['allocated'::character varying, 'consumed'::character varying, 'released'::character varying]::"text"[]))),
    CONSTRAINT "resource_allocations_kind_check" CHECK (("kind" = ANY (ARRAY['inventory_item'::character varying, 'capacity_slot'::character varying, 'staff_time'::character varying, 'equipment'::character varying]::"text"[])))
);
CREATE UNIQUE INDEX IF NOT EXISTS "resource_allocations_tx_kind_ref_key" ON "public"."resource_allocations" ("transaction_id", "kind", "resource_ref");

ALTER TABLE "public"."resource_allocations" OWNER TO "postgres";

-- ============================================================
-- 2. resource_allocation_events — append-only audit
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."resource_allocation_events" (
    "id" uuid DEFAULT "gen_random_uuid"() NOT NULL,
    "allocation_id" uuid NOT NULL,
    "from_status" character varying(20) NOT NULL DEFAULT 'none',
    "to_status" character varying(20) NOT NULL,
    "action" text NOT NULL,
    "actor" character varying(20) NOT NULL,
    "actor_id" uuid,
    "metadata" jsonb DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resource_allocation_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "resource_allocation_events_allocation_id_idx" ON "public"."resource_allocation_events" ("allocation_id");

ALTER TABLE "public"."resource_allocation_events" OWNER TO "postgres";

-- Append-only: no UPDATE/DELETE on the event log.
CREATE OR REPLACE FUNCTION "public"."_resource_allocation_events_immutability"()
RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
BEGIN
    RAISE EXCEPTION 'resource_allocation_events is append-only — UPDATE/DELETE forbidden';
END;
$$;
ALTER FUNCTION "public"."_resource_allocation_events_immutability"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "resource_allocation_events_immutability" ON "public"."resource_allocation_events";
CREATE TRIGGER "resource_allocation_events_immutability"
    BEFORE UPDATE OR DELETE ON "public"."resource_allocation_events"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."_resource_allocation_events_immutability"();

-- ============================================================
-- 3. RLS — hardened from day one
-- ============================================================
ALTER TABLE "public"."resource_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."resource_allocation_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_allocations_isolation" ON "public"."resource_allocations"
  FOR SELECT TO "authenticated"
  USING (
    "public"."user_has_tenant_access"("auth"."uid"(), "tenant_id")
    AND "public"."user_has_property_access"("auth"."uid"(), "property_id")
  );

CREATE POLICY "resource_allocation_events_isolation" ON "public"."resource_allocation_events"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."resource_allocations" a
      WHERE a.id = resource_allocation_events.allocation_id
        AND "public"."user_has_tenant_access"("auth"."uid"(), a.tenant_id)
        AND "public"."user_has_property_access"("auth"."uid"(), a.property_id)
    )
  );

-- The schema default-privilege flip (20260821150000) means new tables get no
-- anon/authenticated SELECT by default — but grant explicitly anyway so the
-- intent is auditable, and revoke anon defensively for pre-flip databases.
REVOKE SELECT ON "public"."resource_allocations" FROM "anon";
REVOKE SELECT ON "public"."resource_allocation_events" FROM "anon";

-- ============================================================
-- 4. RPCs — service_role only, fail-closed
-- ============================================================

-- allocate_resources: idempotent insert of allocation rows + events.
CREATE OR REPLACE FUNCTION "public"."allocate_resources"(
    "p_transaction_id" "uuid",
    "p_engine_type" text,
    "p_property_id" "uuid" DEFAULT NULL::"uuid",
    "p_tenant_id" "uuid" DEFAULT NULL::"uuid",
    "p_requirements" jsonb DEFAULT '[]'::"jsonb"
)
RETURNS TABLE("success" boolean, "allocated" integer, "error_message" text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req jsonb;
    v_kind text;
    v_ref text;
    v_qty numeric;
    v_unit text;
    v_allocation_id uuid;
    v_count integer := 0;
BEGIN
    IF jsonb_typeof(p_requirements) <> 'array' THEN
        RETURN QUERY SELECT false, 0, 'p_requirements must be a JSON array'::TEXT;
        RETURN;
    END IF;

    FOR v_req IN SELECT * FROM jsonb_array_elements(p_requirements) LOOP
        v_kind := v_req->>'kind';
        v_ref := v_req->>'ref';
        v_qty := COALESCE((v_req->>'quantity')::numeric, 0);
        v_unit := v_req->>'unit';

        IF v_kind IS NULL OR v_ref IS NULL OR v_qty <= 0 THEN
            RETURN QUERY SELECT false, v_count,
                format('Invalid resource requirement: kind=%L ref=%L qty=%s', v_kind, v_ref, v_qty)::TEXT;
            RETURN;
        END IF;

        INSERT INTO resource_allocations
            (transaction_id, engine_type, kind, resource_ref, quantity, unit, status, property_id, tenant_id, allocated_at)
        VALUES
            (p_transaction_id, p_engine_type, v_kind, v_ref, v_qty, v_unit, 'allocated', p_property_id, p_tenant_id, now())
        ON CONFLICT (transaction_id, kind, resource_ref) DO NOTHING
        RETURNING id INTO v_allocation_id;

        IF v_allocation_id IS NULL THEN
            SELECT id INTO v_allocation_id
            FROM resource_allocations
            WHERE transaction_id = p_transaction_id AND kind = v_kind AND resource_ref = v_ref;
        END IF;

        INSERT INTO resource_allocation_events (allocation_id, from_status, to_status, action, actor, metadata)
        VALUES (v_allocation_id, 'none', 'allocated', 'allocate', 'system', jsonb_build_object('quantity', v_qty));
        v_count := v_count + 1;
    END LOOP;

    RETURN QUERY SELECT true, v_count, NULL::TEXT;
END;
$$;
ALTER FUNCTION "public"."allocate_resources"("p_transaction_id" "uuid", "p_engine_type" text, "p_property_id" "uuid", "p_tenant_id" "uuid", "p_requirements" jsonb) OWNER TO "postgres";

-- consume_resources: mark all 'allocated' rows for the transaction consumed.
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
    UPDATE resource_allocations
    SET status = 'consumed', consumed_at = now(), updated_at = now()
    WHERE transaction_id = p_transaction_id
      AND engine_type = p_engine_type
      AND status = 'allocated';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO resource_allocation_events (allocation_id, from_status, to_status, action, actor, actor_id)
    SELECT id, 'allocated', 'consumed', p_action, p_actor, p_actor_id
    FROM resource_allocations
    WHERE transaction_id = p_transaction_id AND engine_type = p_engine_type AND status = 'consumed';

    RETURN QUERY SELECT true, v_count, NULL::TEXT;
END;
$$;
ALTER FUNCTION "public"."consume_resources"("p_transaction_id" "uuid", "p_engine_type" text, "p_action" text, "p_actor" text, "p_actor_id" "uuid") OWNER TO "postgres";

-- release_resources: reverse on cancellation (compensation).
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
    UPDATE resource_allocations
    SET status = 'released', released_at = now(), updated_at = now()
    WHERE transaction_id = p_transaction_id
      AND engine_type = p_engine_type
      AND status IN ('allocated', 'consumed');

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO resource_allocation_events (allocation_id, from_status, to_status, action, actor, actor_id)
    SELECT id, status, 'released', p_action, p_actor, p_actor_id
    FROM resource_allocations
    WHERE transaction_id = p_transaction_id AND engine_type = p_engine_type AND status = 'released';

    RETURN QUERY SELECT true, v_count, NULL::TEXT;
END;
$$;
ALTER FUNCTION "public"."release_resources"("p_transaction_id" "uuid", "p_engine_type" text, "p_action" text, "p_actor" text, "p_actor_id" "uuid") OWNER TO "postgres";

-- SECURITY DEFINER RPCs: service_role only. No other role performs these writes.
REVOKE ALL ON FUNCTION "public"."allocate_resources"("uuid", text, "uuid", "uuid", jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."consume_resources"("uuid", text, text, text, "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."release_resources"("uuid", text, text, text, "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."allocate_resources"("uuid", text, "uuid", "uuid", jsonb) TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."consume_resources"("uuid", text, text, text, "uuid") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."release_resources"("uuid", text, text, text, "uuid") TO "service_role";

-- Trigger functions: fire under the role performing the DML — service_role only.
REVOKE EXECUTE ON FUNCTION "public"."_resource_allocation_events_immutability"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."_resource_allocation_events_immutability"() TO "service_role";
