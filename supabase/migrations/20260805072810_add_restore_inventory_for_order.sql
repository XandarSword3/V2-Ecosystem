-- Adds restore_inventory_for_order, the missing counterpart to the live
-- deduct_inventory_for_order function.
--
-- Context: inventory-side-effects.ts's restoreInventorySideEffect called a
-- function named adjust_stock, which does not exist anywhere in this
-- database. Every cancellation-triggered restoration call has therefore been
-- failing silently (caught, logged as a warning, never surfaced). Separately,
-- it filtered inventory_transactions on reference_type = 'order', but the
-- real deduct_inventory_for_order writes reference_type = 'transaction' — so
-- even with a working RPC name, the lookup would have matched zero rows.
--
-- This function mirrors deduct_inventory_for_order's locking pattern
-- (FOR UPDATE on the rows being touched, to prevent concurrent double-
-- restoration) and reads/writes reference_type = 'transaction' to match what
-- deduction actually records. It is idempotent: a transaction_id that has
-- already been restored returns items_restored = 0 rather than restoring
-- twice.
--
-- This migration only adds a new function — it does not alter
-- deduct_inventory_for_order or deduct_stock_fifo, so it carries no risk to
-- any currently-working code path.

CREATE OR REPLACE FUNCTION "public"."restore_inventory_for_order"("p_transaction_id" "uuid")
RETURNS TABLE("success" boolean, "items_restored" integer, "error_message" "text")
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deduction RECORD;
    v_restore_count INTEGER := 0;
    v_current_stock DECIMAL;
BEGIN
    -- Idempotency guard: if this transaction has already been restored,
    -- do nothing rather than double-crediting stock.
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
        -- Lock the inventory_items row before touching it, same as
        -- deduct_stock_fifo's serialization point.
        SELECT current_stock INTO v_current_stock
        FROM inventory_items
        WHERE id = v_deduction.item_id
        FOR UPDATE;

        UPDATE inventory_items
        SET current_stock = current_stock + ABS(v_deduction.quantity),
            updated_at = NOW()
        WHERE id = v_deduction.item_id;

        INSERT INTO inventory_transactions(
            item_id, transaction_type, quantity, stock_before, stock_after,
            reference_type, reference_id, notes
        ) VALUES (
            v_deduction.item_id, 'restoration', ABS(v_deduction.quantity),
            v_current_stock, v_current_stock + ABS(v_deduction.quantity),
            'transaction', p_transaction_id, 'Restored due to order cancellation'
        );

        v_restore_count := v_restore_count + 1;
    END LOOP;

    RETURN QUERY SELECT true, v_restore_count, NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."restore_inventory_for_order"("p_transaction_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."restore_inventory_for_order"("p_transaction_id" "uuid") TO "service_role";
