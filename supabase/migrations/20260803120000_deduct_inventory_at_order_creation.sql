-- =============================================================================
-- Migration: Deduct inventory at order-creation time, not at 'confirm'
--
-- Problem:
--   Engine A (instant_transaction) orders are created with status = 'pending'
--   and inventory is only ever deducted by deductInventorySideEffect, which is
--   registered on the 'confirm' state-machine action. In practice no code path
--   ever persists a 'confirm' transition for instant_transaction orders (the
--   live Stripe webhook only updates payment_status; the one endpoint that can
--   drive the state machine never passes orderId/transactionId in its context,
--   so the side effect's own guard clause skips it). Net effect: inventory is
--   never deducted for real orders, so concurrent orders against limited stock
--   can all be accepted even when only some of them can actually be fulfilled.
--
--   Separately, the side effect's primary RPC (deduct_inventory_for_order_v2)
--   does not exist anywhere in this schema and always falls back to a legacy
--   path that queries an `order_items` table — but POST /orders never writes
--   to `order_items` either, so that fallback finds nothing even when reached.
--
-- Fix:
--   Move the check to order-creation time, where it can actually reject an
--   order before it's created, instead of silently accepting orders that can
--   never all be fulfilled. This is called directly from POST /orders with
--   the catalog_item_id/quantity pairs already in hand — no order_items table
--   needed.
--
--   deduct_inventory_for_order_items() loops each line item's recipe
--   ingredients (menu_item_ingredients) and calls the already-race-safe
--   deduct_stock_fifo() (locks inventory_items FOR UPDATE, pre-checks
--   current_stock, never goes negative). If any ingredient comes back
--   insufficient, this function RAISEs, which rolls back every deduction
--   already made within this same call — so a multi-item order either fully
--   reserves its ingredients or reserves none of them.
--
--   restore_inventory_for_order_items() is the compensating action for the
--   rare case where inventory was deducted but the order row itself then
--   failed to insert (mirrors the existing reverseDiscounts() pattern already
--   used for coupons/gift cards in POST /orders).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION "public"."deduct_inventory_for_order_items"(
  "p_items" "jsonb",
  "p_user_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS "jsonb"
LANGUAGE plpgsql
AS $$
DECLARE
  v_item            jsonb;
  v_catalog_item_id uuid;
  v_quantity        numeric;
  v_ingredient      RECORD;
  v_required        numeric;
  v_deduct_result   jsonb;
  v_deducted_count  integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', true, 'ingredients_deducted', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_catalog_item_id := (v_item->>'catalog_item_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    -- Items with no recipe rows (e.g. no inventory tracking configured)
    -- simply have nothing to loop over here — not an error.
    FOR v_ingredient IN
      SELECT inventory_item_id, quantity_required
      FROM menu_item_ingredients
      WHERE catalog_item_id = v_catalog_item_id
    LOOP
      v_required := v_ingredient.quantity_required * v_quantity;

      -- Explicit cast to character varying pins this call to the
      -- jsonb-returning deduct_stock_fifo overload (there is also an
      -- older text-parameter/void-returning overload in this schema).
      v_deduct_result := "public"."deduct_stock_fifo"(
        v_ingredient.inventory_item_id,
        v_required,
        'order'::character varying,
        p_user_id
      );

      IF NOT COALESCE((v_deduct_result->>'success')::boolean, false) THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: %', v_deduct_result::text
          USING ERRCODE = 'P0001';
      END IF;

      v_deducted_count := v_deducted_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'ingredients_deducted', v_deducted_count);
END;
$$;

ALTER FUNCTION "public"."deduct_inventory_for_order_items"("jsonb", "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."deduct_inventory_for_order_items"("jsonb", "uuid") IS
  'Atomically checks and deducts recipe-ingredient stock for a set of {catalog_item_id, quantity} line items before an order is created. Raises (rolling back all deductions made in this call) on first insufficient-stock ingredient. Called from POST /orders before the transactions row is inserted.';

-- Compensating action: order row failed to insert after inventory was
-- already reserved. Restores directly against inventory_items.current_stock
-- (not FIFO-batch-precise — good enough for a rare rollback path; the
-- forward path above remains the FIFO-accurate one).
CREATE OR REPLACE FUNCTION "public"."restore_inventory_for_order_items"(
  "p_items" "jsonb",
  "p_user_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS "jsonb"
LANGUAGE plpgsql
AS $$
DECLARE
  v_item            jsonb;
  v_catalog_item_id uuid;
  v_quantity        numeric;
  v_ingredient      RECORD;
  v_required        numeric;
  v_restored_count  integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', true, 'ingredients_restored', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_catalog_item_id := (v_item->>'catalog_item_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    FOR v_ingredient IN
      SELECT inventory_item_id, quantity_required
      FROM menu_item_ingredients
      WHERE catalog_item_id = v_catalog_item_id
    LOOP
      v_required := v_ingredient.quantity_required * v_quantity;

      UPDATE inventory_items
      SET current_stock = current_stock + v_required,
          updated_at = now()
      WHERE id = v_ingredient.inventory_item_id;

      v_restored_count := v_restored_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'ingredients_restored', v_restored_count);
END;
$$;

ALTER FUNCTION "public"."restore_inventory_for_order_items"("jsonb", "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."restore_inventory_for_order_items"("jsonb", "uuid") IS
  'Compensating action for deduct_inventory_for_order_items(): restores the same recipe-ingredient quantities directly to inventory_items.current_stock. Used when inventory was deducted but the order row itself then failed to insert.';

COMMIT;