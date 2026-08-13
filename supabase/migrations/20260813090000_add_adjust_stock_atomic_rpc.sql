-- Add adjust_stock_atomic: closes the TOCTOU race in recordTransaction and
-- bulkTransaction (backend/src/modules/inventory/inventory.controller.ts),
-- which both did SELECT current_stock -> compute in JS -> UPDATE current_stock
-- = <absolute value> with no row lock. Two concurrent transactions on the
-- same item (two staff members, or a manual transaction racing an
-- order-driven deduction) could both read the same stock value and one
-- write would silently clobber the other.
--
-- A new function rather than modifying deduct_stock_fifo: that function's
-- contract (FIFO batch tracking, no-op on non-positive input) is depended on
-- by the order-deduction path — see its own comment: "Serialized via FOR
-- UPDATE on inventory_items + FOR UPDATE cursor on inventory_batches to
-- prevent double-deduction races." adjust_stock_atomic mirrors that same
-- serialization point (FOR UPDATE on inventory_items) for the simpler
-- relative-adjustment case that doesn't touch batches: manual in/out/
-- waste/return transactions and PO receiving increments.
--
-- p_tenant_id/p_property_id are required and re-verified against the locked
-- row (not just trusted from the caller) — the Node layer already tenant/
-- property-scopes its SELECT before calling this, but the RPC checks again
-- so a mismatched id can't be used to write a transaction row stamped with
-- the wrong tenant/property, or adjust another tenant's stock, even if
-- called directly.
CREATE OR REPLACE FUNCTION "public"."adjust_stock_atomic"(
    "p_item_id" "uuid",
    "p_delta" numeric,              -- positive = add, negative = remove
    "p_tenant_id" "uuid",
    "p_property_id" "uuid",
    "p_reason" character varying DEFAULT 'adjustment',
    "p_reference_type" character varying DEFAULT NULL,
    "p_reference_id" "uuid" DEFAULT NULL,
    "p_notes" "text" DEFAULT NULL,
    "p_performed_by" "uuid" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_item           RECORD;
  v_stock_before   numeric;
  v_stock_after    numeric;
  v_transaction_id uuid;
BEGIN
  IF p_delta = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delta must be non-zero');
  END IF;

  -- Serialization point — same idiom as deduct_stock_fifo: lock the
  -- inventory_items row FOR UPDATE so concurrent callers for the same item
  -- queue here instead of racing on a stale read.
  SELECT * INTO v_item
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory item not found');
  END IF;

  IF v_item.tenant_id IS DISTINCT FROM p_tenant_id
     OR v_item.property_id IS DISTINCT FROM p_property_id THEN
    -- Same 404-shaped response as a genuine not-found, not 403 — don't
    -- reveal that an item with this id exists under a different tenant.
    RETURN jsonb_build_object('success', false, 'error', 'Inventory item not found');
  END IF;

  v_stock_before := v_item.current_stock;
  v_stock_after  := v_stock_before + p_delta;

  IF v_stock_after < 0 THEN
    RETURN jsonb_build_object(
      'success',   false,
      'error',     'Insufficient stock',
      'available', v_stock_before,
      'requested', abs(p_delta)
    );
  END IF;

  UPDATE inventory_items
  SET current_stock = v_stock_after, updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO inventory_transactions (
    item_id, transaction_type, quantity, stock_before, stock_after,
    reference_type, reference_id, notes, performed_by, tenant_id, property_id
  ) VALUES (
    p_item_id, p_reason, abs(p_delta), v_stock_before, v_stock_after,
    p_reference_type, p_reference_id, p_notes, p_performed_by, p_tenant_id, p_property_id
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success',        true,
    'stock_before',   v_stock_before,
    'stock_after',    v_stock_after,
    'transaction_id', v_transaction_id
  );
END;
$$;

ALTER FUNCTION "public"."adjust_stock_atomic"("p_item_id" "uuid", "p_delta" numeric, "p_tenant_id" "uuid", "p_property_id" "uuid", "p_reason" character varying, "p_reference_type" character varying, "p_reference_id" "uuid", "p_notes" "text", "p_performed_by" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."adjust_stock_atomic"("p_item_id" "uuid", "p_delta" numeric, "p_tenant_id" "uuid", "p_property_id" "uuid", "p_reason" character varying, "p_reference_type" character varying, "p_reference_id" "uuid", "p_notes" "text", "p_performed_by" "uuid") IS 'Atomic relative stock adjustment (add or remove) with row-level locking via FOR UPDATE on inventory_items, mirroring deduct_stock_fifo''s serialization point. Used by recordTransaction/bulkTransaction (in/out/waste/return) and receivePurchaseOrder, replacing prior unlocked SELECT-then-UPDATE races. Re-verifies tenant_id/property_id against the locked row. Added 2026-08-13.';
