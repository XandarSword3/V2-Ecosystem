-- =============================================================================
-- Migration: Fix inventory deduction race condition in deduct_stock_fifo
-- Date: 2026-04-24
--
-- Problem:
--   The original function (20260126160000_inventory_recipes_bom.sql) iterates
--   inventory batches using a plain SELECT cursor — no FOR UPDATE lock.
--   Two concurrent orders can both read the same remaining_quantity value,
--   both pass the capacity check, and both deduct from the same batch,
--   resulting in stock going negative or more items being served than available.
--
-- Fix:
--   1. Lock the parent inventory_items row FOR UPDATE first — this is the
--      serialization point. All concurrent calls for the same item queue here.
--   2. Use FOR UPDATE on the batch cursor so no other transaction can modify
--      a batch row we are about to deduct from.
--   3. Return a proper error (success: false) when stock is insufficient rather
--      than silently serving from depleted stock.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_item_id UUID,
  p_quantity DECIMAL,
  p_reason  VARCHAR,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_item           RECORD;
  v_remaining      DECIMAL := p_quantity;
  v_batch          RECORD;
  v_deduct_from_batch DECIMAL;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than zero');
  END IF;

  -- ── Serialization point ──────────────────────────────────────────────────
  -- Lock the inventory_items row FOR UPDATE. All concurrent calls for the
  -- same item will queue here. This prevents the TOCTOU race where two
  -- transactions both read current_stock = 5 and both think they can deduct 5.
  SELECT * INTO v_item
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory item not found');
  END IF;

  -- Quick pre-check: is there enough total stock before touching batches?
  IF v_item.current_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success',         false,
      'error',           'Insufficient stock',
      'available',       v_item.current_stock,
      'requested',       p_quantity
    );
  END IF;

  -- ── Batch deduction (FIFO) ───────────────────────────────────────────────
  -- FOR UPDATE on the cursor locks each batch row before we read its quantity,
  -- so no concurrent transaction can read the same remaining_quantity.
  FOR v_batch IN
    SELECT *
    FROM   inventory_batches
    WHERE  item_id           = p_item_id
      AND  status            = 'active'
      AND  remaining_quantity > 0
    ORDER BY received_date ASC, created_at ASC
    FOR UPDATE           -- ← the fix: lock each batch row before inspecting it
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_deduct_from_batch := LEAST(v_batch.remaining_quantity, v_remaining);

    UPDATE inventory_batches
    SET
      remaining_quantity = remaining_quantity - v_deduct_from_batch,
      status = CASE
                 WHEN remaining_quantity - v_deduct_from_batch <= 0 THEN 'depleted'
                 ELSE status
               END
    WHERE id = v_batch.id;

    v_remaining := v_remaining - v_deduct_from_batch;
  END LOOP;

  -- ── Update summary stock on parent item ───────────────────────────────────
  -- We already hold the FOR UPDATE lock on this row.
  UPDATE inventory_items
  SET current_stock = GREATEST(0, current_stock - (p_quantity - v_remaining))
  WHERE id = p_item_id;

  IF v_remaining > 0 THEN
    -- Batches ran out before we fulfilled the full quantity.
    -- This should not happen given the pre-check above, but guard defensively.
    RETURN jsonb_build_object(
      'success',           false,
      'error',             'Batch stock exhausted before deduction completed',
      'requested_quantity', p_quantity,
      'unfulfilled',        v_remaining
    );
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'requested_quantity', p_quantity,
    'remaining_quantity', 0
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deduct_stock_fifo(UUID, DECIMAL, VARCHAR, UUID) IS
  'FIFO batch stock deduction. Serialized via FOR UPDATE on inventory_items + '
  'FOR UPDATE cursor on inventory_batches to prevent double-deduction races. '
  'Fixed 2026-04-24 (was missing both locks).';

COMMIT;
