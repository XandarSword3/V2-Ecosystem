-- Fix shared_capacity_access ticket initial status: 'confirmed' → 'valid'.
--
-- Defect: the engine's state machine (shared-capacity-access.ts) defines
-- states ['valid','active','used','expired','cancelled'] with initialState
-- 'valid' and the entry/exit actions validate_entry (valid→active) and
-- record_exit (active→used). But purchase_shared_capacity_atomic inserted
-- new tickets with status 'confirmed' — a state that does not exist on this
-- engine's machine. Every entry/exit/validate transition then failed with
-- "invalid transition" (400), stranding tickets at 'confirmed' forever:
-- guests could never check in, and capacity occupancy never cleared.
--
-- 'confirmed' is the initial state of OTHER engines' fulfillment machines
-- (hospitality, shipment) — it was copy-pasted here. The engine registry is
-- the source of truth for an engine's lifecycle (ARCHITECTURE_LAW.md).
--
-- Fix: insert 'valid' (the engine's initialState) and migrate existing
-- stranded 'confirmed' capacity tickets to 'valid' so they become operable.

CREATE OR REPLACE FUNCTION "public"."purchase_shared_capacity_atomic"("p_session_id" "uuid", "p_module_id" "uuid", "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_customer_id" "uuid" DEFAULT NULL::"uuid", "p_quantity" integer DEFAULT 1, "p_ticket_date" "date" DEFAULT CURRENT_DATE, "p_amount" numeric DEFAULT 0, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("success" boolean, "transaction_id" "uuid", "total_amount" numeric, "available_capacity" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session RECORD;
  v_sold INTEGER;
  v_max_capacity INTEGER;
  v_new_id UUID;
  v_meta JSONB;
  v_module_id UUID;
  v_tenant_id UUID;
  v_property_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'quantity must be at least 1'::TEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_session
  FROM capacity_windows
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session not found'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(v_session.is_active, true) = false THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session is not active'::TEXT;
    RETURN;
  END IF;

  v_max_capacity := COALESCE(v_session.max_capacity, v_session.capacity, 0);
  IF v_max_capacity <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session has no capacity configured'::TEXT;
    RETURN;
  END IF;

  v_module_id := COALESCE(p_module_id, v_session.module_id);

  SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
  FROM modules WHERE id = v_module_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Module not found'::TEXT;
    RETURN;
  END IF;

  v_property_id := COALESCE(p_property_id, v_property_id);

  SELECT COALESCE(SUM(
    GREATEST(
      COALESCE(NULLIF(t.metadata->>'quantity', '')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'number_of_guests', '')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'adults', '')::INTEGER, 0)
        + COALESCE(NULLIF(t.metadata->>'children', '')::INTEGER, 0),
      1
    )
  ), 0)::INTEGER
  INTO v_sold
  FROM transactions t
  WHERE t.engine_type = 'shared_capacity_access'
    AND (
      t.reference_id = p_session_id
      OR (t.metadata->>'session_id')::UUID = p_session_id
    )
    AND COALESCE(t.metadata->>'ticket_date', t.metadata->>'date', '') = p_ticket_date::TEXT
    AND t.status NOT IN ('cancelled', 'expired', 'no_show');

  IF v_sold + p_quantity > v_max_capacity THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      0::DECIMAL,
      GREATEST(0, v_max_capacity - v_sold),
      'Not enough capacity available'::TEXT;
    RETURN;
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'session_id', p_session_id::TEXT,
      'quantity', p_quantity,
      'ticket_date', p_ticket_date::TEXT,
      'date', p_ticket_date::TEXT
    );

  INSERT INTO transactions (
    engine_type,
    module_id,
    tenant_id,
    property_id,
    customer_id,
    status,
    amount,
    net_amount,
    reference_id,
    reference_table,
    metadata
  )
  VALUES (
    'shared_capacity_access',
    v_module_id,
    v_tenant_id,
    v_property_id,
    p_customer_id,
    'valid',  -- engine initialState (was 'confirmed': not a state on this engine's machine)
    p_amount,
    p_amount,
    p_session_id,
    'capacity_windows',
    v_meta
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT
    true,
    v_new_id,
    p_amount,
    GREATEST(0, v_max_capacity - v_sold - p_quantity),
    NULL::TEXT;
END;
$$;

-- Migrate stranded tickets: 'confirmed' is unreachable on this engine's
-- machine, so no legitimate in-flight state is lost by this rewrite.
UPDATE transactions
SET status = 'valid', updated_at = NOW()
WHERE engine_type = 'shared_capacity_access'
  AND status = 'confirmed';

ALTER FUNCTION "public"."purchase_shared_capacity_atomic"("p_session_id" "uuid", "p_module_id" "uuid", "p_property_id" "uuid", "p_customer_id" "uuid", "p_quantity" integer, "p_ticket_date" "date", "p_amount" numeric, "p_metadata" "jsonb") OWNER TO "postgres";
