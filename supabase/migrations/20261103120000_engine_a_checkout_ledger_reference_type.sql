-- ═══════════════════════════════════════════════════════════════════════════
-- Engine A — cancelled customer-route checkouts never restored their stock
--
-- Problem (found by the real-DB integration run, 2026-11-03):
--   deduct_inventory_for_checkout_atomic (F13) writes its consumption ledger
--   row with reference_type 'order'. The cancellation counterpart
--   restore_inventory_for_order (20260805072810) reverses ONLY
--   reference_type 'transaction' rows — the convention every other deduction
--   writer uses (deduct_inventory_for_order / deduct_inventory_for_order_items).
--   Zero rows matched, so cancelling a storefront (customer-route) order
--   released its resource allocation but never returned the deducted stock.
--   No error was surfaced: the restore RPC returned success (items_restored 0).
--   (The dedication/restore convention mismatch already shipped once before —
--   the 20260805072810 header notes the same class of bug in the restore path.)
--
-- Fix (3 parts):
--   1. Re-define deduct_inventory_for_checkout_atomic to write the ledger row
--      with reference_type 'transaction' (canonical convention), everything
--      else identical to the F13 version (lease fencing, tenant/property
--      scoping, NEGATIVE-quantity 'sale' rows, variance-visible).
--   2. Relink historical checkout ledger rows that carry reference_id
--      (order id) from 'order' to 'transaction', so a future cancellation of
--      a pending legacy row (e.g. an offline-queue replay) restores correctly.
--      Rows with NULL reference_id (pre-link era) keep 'order' and remain
--      variance-visible via the updated CTE.
--   3. Widen get_ingredient_variance.actual to count ALL sale-row
--      reference_types ('order','order_customization','transaction') so the
--      relink cannot change historical variance aggregates.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Checkout deduction: unified reference_type
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_inventory_for_checkout_atomic(
  p_key TEXT,
  p_claim_token UUID,
  p_items JSONB,
  p_user_id UUID DEFAULT NULL::UUID,
  p_order_id UUID DEFAULT NULL::UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease RECORD;
  v_item JSONB;
  v_catalog_item_id UUID;
  v_quantity NUMERIC;
  v_ingredient RECORD;
  v_required NUMERIC;
  v_deduct_result JSONB;
  v_deducted_count INTEGER := 0;
  v_stock_before NUMERIC;
  v_stock_after NUMERIC;
  v_tenant_id UUID;
  v_property_id UUID;
  v_transaction_id UUID;
BEGIN
  IF p_key IS NOT NULL AND p_claim_token IS NOT NULL THEN
    SELECT * INTO v_lease
    FROM idempotency_records
    WHERE key = p_key
    FOR UPDATE;

    IF NOT FOUND OR v_lease.claim_token != p_claim_token OR v_lease.status != 'in_progress' OR v_lease.expires_at <= NOW() THEN
      RETURN jsonb_build_object('success', false, 'error', 'LEASE_LOST', 'message', 'Active checkout lease expired or taken over.');
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', true, 'ingredients_deducted', 0);
  END IF;

  -- Scope columns for the ledger rows come from the first catalog item's
  -- module (tenant/property are uniform within one property-wide checkout).
  SELECT c.tenant_id, c.property_id
  INTO v_tenant_id, v_property_id
  FROM catalog_items c
  WHERE c.id = (SELECT (j->>'catalog_item_id')::UUID
                FROM jsonb_array_elements(p_items) j
                LIMIT 1);

  -- When p_order_id IS NULL (deduction genuinely preceding the transactions
  -- INSERT), rows carry reference_id NULL; variance analytics aggregate by
  -- window and do not need the link. The router passes the created order id.
  IF p_order_id IS NOT NULL THEN
    v_transaction_id := p_order_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_catalog_item_id := (v_item->>'catalog_item_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    FOR v_ingredient IN
      SELECT inventory_item_id, quantity_required
      FROM menu_item_ingredients
      WHERE catalog_item_id = v_catalog_item_id
    LOOP
      v_required := v_ingredient.quantity_required * v_quantity;

      SELECT current_stock INTO v_stock_before
      FROM inventory_items
      WHERE id = v_ingredient.inventory_item_id;

      v_deduct_result := "public"."deduct_stock_fifo"(
        v_ingredient.inventory_item_id,
        v_required,
        'order'::character varying,
        p_user_id
      );

      IF NOT COALESCE((v_deduct_result->>'success')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_STOCK', 'message', 'One or more items in your order are out of stock', 'details', v_deduct_result);
      END IF;

      v_stock_after := v_stock_before - v_required;

      -- Consumption ledger row (negative quantity = stock out), reference_type
      -- matches the canonical reversal convention used by
      -- restore_inventory_for_order ('transaction'), so a cancelled order
      -- gives its stock back.
      INSERT INTO inventory_transactions (
        item_id, transaction_type, quantity, stock_before, stock_after,
        reference_type, reference_id, notes, performed_by, tenant_id, property_id
      ) VALUES (
        v_ingredient.inventory_item_id, 'sale', -v_required,
        v_stock_before, v_stock_after,
        'transaction', v_transaction_id,
        'Checkout deduction: ' || v_quantity || ' x ' || v_catalog_item_id,
        p_user_id, v_tenant_id, v_property_id
      );

      v_deducted_count := v_deducted_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'ingredients_deducted', v_deducted_count);
END;
$$;

COMMENT ON FUNCTION deduct_inventory_for_checkout_atomic IS 'Atomic BOM deduction with lease fencing (F4) plus consumption ledger rows (F13): every successful FIFO deduction writes an inventory_transactions sale row (negative quantity, reference_type transaction — per-order-reversible convention shared with the other deduction writers). reference_id is the transaction id when the caller passes p_order_id; NULL-id rows remain. Added 2026-09-16; reference_type unified to transaction on 2026-11-03 so cancellation restores stock (previously reference_type order, invisible to restore_inventory_for_order).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Relink historical rows that carry an order id under the legacy type
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE inventory_transactions
SET reference_type = 'transaction'
WHERE reference_type = 'order'
  AND transaction_type = 'sale'
  AND reference_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Variance helper: count all sale-row conventions in `actual`
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_ingredient_variance(
  p_property_id UUID,
  p_tenant_id UUID,          -- NULL = unscoped platform operator
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  inventory_item_id UUID,
  item_name VARCHAR,
  unit VARCHAR,
  units_sold NUMERIC,
  theoretical_consumption NUMERIC,
  actual_consumption NUMERIC,
  variance NUMERIC,
  variance_pct NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH sold AS (
    SELECT oi.catalog_item_id, SUM(oi.quantity) AS units
    FROM order_items oi
    JOIN transactions t ON t.id = oi.transaction_id
    WHERE oi.property_id = p_property_id
      AND (p_tenant_id IS NULL OR oi.tenant_id = p_tenant_id)
      AND t.status NOT IN ('cancelled', 'void', 'refunded')
      AND oi.created_at >= p_since
      AND oi.created_at < p_until
    GROUP BY oi.catalog_item_id
  ),
  theoretical AS (
    SELECT m.inventory_item_id, SUM(s.units * m.quantity_required) AS qty
    FROM sold s
    JOIN menu_item_ingredients m ON m.catalog_item_id = s.catalog_item_id
    WHERE m.property_id = p_property_id
    GROUP BY m.inventory_item_id
  ),
  actual AS (
    SELECT t.item_id, ABS(SUM(t.quantity)) AS qty
    FROM inventory_transactions t
    WHERE t.property_id = p_property_id
      AND (p_tenant_id IS NULL OR t.tenant_id = p_tenant_id)
      AND t.transaction_type = 'sale'
      AND t.reference_type IN ('order', 'order_customization', 'transaction')
      AND t.created_at >= p_since
      AND t.created_at < p_until
    GROUP BY t.item_id
  ),
  sold_units_by_item AS (
    SELECT m.inventory_item_id, SUM(s.units) AS units
    FROM sold s
    JOIN menu_item_ingredients m ON m.catalog_item_id = s.catalog_item_id
    WHERE m.property_id = p_property_id
    GROUP BY m.inventory_item_id
  )
  SELECT
    i.id,
    i.name,
    i.unit,
    COALESCE(su.units, 0),
    COALESCE(th.qty, 0),
    COALESCE(ac.qty, 0),
    COALESCE(ac.qty, 0) - COALESCE(th.qty, 0),
    CASE WHEN COALESCE(th.qty, 0) > 0
         THEN ROUND(((COALESCE(ac.qty,0) - COALESCE(th.qty,0)) / COALESCE(th.qty,0) * 100)::numeric, 1)
         ELSE NULL END
  FROM inventory_items i
  LEFT JOIN theoretical th ON th.inventory_item_id = i.id
  LEFT JOIN actual ac ON ac.item_id = i.id
  LEFT JOIN sold_units_by_item su ON su.inventory_item_id = i.id
  WHERE i.property_id = p_property_id
    AND i.deleted_at IS NULL
    AND (th.qty IS NOT NULL OR ac.qty IS NOT NULL);
$$;
