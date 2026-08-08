-- =============================================================================
-- Migration: Unified Inventory Deduction, Audit Trail, & Cascading Auto-86
-- =============================================================================

BEGIN;

-- 1. Ensure 'restoration' is accepted in inventory_transactions.transaction_type
ALTER TABLE "public"."inventory_transactions"
  DROP CONSTRAINT IF EXISTS "inventory_transactions_transaction_type_check";

ALTER TABLE "public"."inventory_transactions"
  ADD CONSTRAINT "inventory_transactions_transaction_type_check"
  CHECK (((transaction_type)::text = ANY (ARRAY[
    'purchase'::character varying,
    'sale'::character varying,
    'adjustment'::character varying,
    'transfer'::character varying,
    'waste'::character varying,
    'return'::character varying,
    'restoration'::character varying
  ]::text[])));

-- 2. Enhanced deduct_inventory_for_order_items function
CREATE OR REPLACE FUNCTION "public"."deduct_inventory_for_order_items"(
  "p_items" "jsonb",
  "p_user_id" "uuid" DEFAULT NULL::"uuid",
  "p_order_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS "jsonb"
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item            jsonb;
  v_catalog_item_id uuid;
  v_quantity        numeric;
  v_ingredient      RECORD;
  v_required        numeric;
  v_deduct_result   jsonb;
  v_deducted_count  integer := 0;
  v_stock_before    numeric;
  v_stock_after     numeric;
  v_tenant_id       uuid;
  v_property_id     uuid;
  v_affected_items  uuid[] := '{}';
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', true, 'ingredients_deducted', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_catalog_item_id := (v_item->>'catalog_item_id')::uuid;
    IF v_catalog_item_id IS NULL AND (v_item->>'menuItemId') IS NOT NULL THEN
      v_catalog_item_id := (v_item->>'menuItemId')::uuid;
    END IF;
    IF v_catalog_item_id IS NULL AND (v_item->>'itemId') IS NOT NULL THEN
      v_catalog_item_id := (v_item->>'itemId')::uuid;
    END IF;

    v_quantity := COALESCE((v_item->>'quantity')::numeric, (v_item->>'qty')::numeric, 1);

    IF v_catalog_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    FOR v_ingredient IN
      SELECT inventory_item_id, quantity_required, COALESCE(is_optional, false) as is_optional
      FROM menu_item_ingredients
      WHERE catalog_item_id = v_catalog_item_id
    LOOP
      v_required := v_ingredient.quantity_required * v_quantity;

      -- Lock inventory item & fetch tenant/property info
      SELECT current_stock, tenant_id, property_id
        INTO v_stock_before, v_tenant_id, v_property_id
        FROM inventory_items
       WHERE id = v_ingredient.inventory_item_id
         FOR UPDATE;

      IF v_stock_before IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Inventory item % not found', v_ingredient.inventory_item_id
          USING ERRCODE = 'P0001';
      END IF;

      -- Perform stock deduction via race-safe deduct_stock_fifo
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

      SELECT current_stock INTO v_stock_after
        FROM inventory_items
       WHERE id = v_ingredient.inventory_item_id;

      -- Record audit trail in inventory_transactions
      IF p_order_id IS NOT NULL THEN
        INSERT INTO inventory_transactions(
          item_id, transaction_type, quantity, stock_before, stock_after,
          reference_type, reference_id, notes, performed_by, tenant_id, property_id
        ) VALUES (
          v_ingredient.inventory_item_id, 'sale', -v_required,
          v_stock_before, v_stock_after,
          'transaction', p_order_id, 'Deducted for order', p_user_id, v_tenant_id, v_property_id
        );
      END IF;

      v_deducted_count := v_deducted_count + 1;
      v_affected_items := array_append(v_affected_items, v_ingredient.inventory_item_id);
    END LOOP;
  END LOOP;

  -- Auto-86 Cascading: Flip is_available = false for any catalog item whose
  -- non-optional recipe ingredient has insufficient current stock
  IF array_length(v_affected_items, 1) > 0 THEN
    UPDATE catalog_items ci
       SET is_available = false
     WHERE ci.is_available = true
       AND ci.id IN (
         SELECT DISTINCT mii.catalog_item_id
           FROM menu_item_ingredients mii
           JOIN inventory_items ii ON ii.id = mii.inventory_item_id
          WHERE mii.inventory_item_id = ANY(v_affected_items)
            AND COALESCE(mii.is_optional, false) = false
            AND ii.current_stock < mii.quantity_required
       );
  END IF;

  RETURN jsonb_build_object('success', true, 'ingredients_deducted', v_deducted_count);
END;
$$;

ALTER FUNCTION "public"."deduct_inventory_for_order_items"("jsonb", "uuid", "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."deduct_inventory_for_order_items"("jsonb", "uuid", "uuid") TO "service_role";

-- Backward compatibility overload for 2-parameter callers
CREATE OR REPLACE FUNCTION "public"."deduct_inventory_for_order_items"(
  "p_items" "jsonb",
  "p_user_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS "jsonb"
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN "public"."deduct_inventory_for_order_items"(p_items, p_user_id, NULL::uuid);
END;
$$;

-- 3. Enhanced restore_inventory_for_order function with Auto-86 Flip-Back
CREATE OR REPLACE FUNCTION "public"."restore_inventory_for_order"("p_transaction_id" "uuid")
RETURNS TABLE("success" boolean, "items_restored" integer, "error_message" "text")
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deduction RECORD;
    v_restore_count INTEGER := 0;
    v_current_stock DECIMAL;
    v_tenant_id UUID;
    v_property_id UUID;
    v_affected_items UUID[] := '{}';
BEGIN
    -- Idempotency guard: if this transaction has already been restored, do nothing
    IF EXISTS (
        SELECT 1 FROM inventory_transactions
        WHERE reference_type = 'transaction'
          AND reference_id = p_transaction_id
          AND transaction_type = 'restoration'
    ) THEN
        RETURN QUERY SELECT true, 0, 'Already restored'::TEXT;
        RETURN;
    END IF;

    FOR v_deduction IN
        SELECT item_id, quantity
        FROM inventory_transactions
        WHERE reference_type = 'transaction'
          AND reference_id = p_transaction_id
          AND transaction_type = 'sale'
        FOR UPDATE OF inventory_transactions
    LOOP
        -- Lock the inventory_items row & retrieve tenant_id / property_id
        SELECT current_stock, tenant_id, property_id
          INTO v_current_stock, v_tenant_id, v_property_id
          FROM inventory_items
         WHERE id = v_deduction.item_id
           FOR UPDATE;

        IF v_current_stock IS NOT NULL THEN
          UPDATE inventory_items
             SET current_stock = current_stock + ABS(v_deduction.quantity),
                 updated_at = NOW()
           WHERE id = v_deduction.item_id;

          INSERT INTO inventory_transactions(
              item_id, transaction_type, quantity, stock_before, stock_after,
              reference_type, reference_id, notes, tenant_id, property_id
          ) VALUES (
              v_deduction.item_id, 'restoration', ABS(v_deduction.quantity),
              v_current_stock, v_current_stock + ABS(v_deduction.quantity),
              'transaction', p_transaction_id, 'Restored due to order cancellation',
              v_tenant_id, v_property_id
          );

          v_restore_count := v_restore_count + 1;
          v_affected_items := array_append(v_affected_items, v_deduction.item_id);
        END IF;
    END LOOP;

    -- Auto-86 Flip-Back: Flip is_available = true for catalog items whose
    -- non-optional recipe ingredients now ALL have sufficient stock again
    IF array_length(v_affected_items, 1) > 0 THEN
      UPDATE catalog_items ci
         SET is_available = true
       WHERE ci.is_available = false
         AND ci.id IN (
           SELECT DISTINCT mii.catalog_item_id
             FROM menu_item_ingredients mii
            WHERE mii.inventory_item_id = ANY(v_affected_items)
         )
         AND NOT EXISTS (
           SELECT 1
             FROM menu_item_ingredients mii2
             JOIN inventory_items ii2 ON ii2.id = mii2.inventory_item_id
            WHERE mii2.catalog_item_id = ci.id
              AND COALESCE(mii2.is_optional, false) = false
              AND ii2.current_stock < mii2.quantity_required
         );
    END IF;

    RETURN QUERY SELECT true, v_restore_count, NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."restore_inventory_for_order"("p_transaction_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."restore_inventory_for_order"("p_transaction_id" "uuid") TO "service_role";

COMMIT;
