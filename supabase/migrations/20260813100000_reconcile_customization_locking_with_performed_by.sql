-- Reconcile the customization-locking fix (20260812090000, pending) with the
-- performed_by/audit-trail fix (20260812100000, currently live).
--
-- 20260812090000 was written on a branch that forked before 20260812100000
-- landed; a history rewrite/merge (see git log) pulled it into main after
-- the fact, so it's still pending on remote while 100000 already went live
-- with a signature change 090000 doesn't know about:
--
--   090000: process_customization_inventory_safe(text, uuid, uuid, jsonb, integer)
--   100000 (LIVE): ...(text, uuid, uuid, jsonb, integer, uuid) — p_performed_by
--     added, forwarded from create_order_customization_snapshot (which the
--     real order flow calls) and from customization.service.ts's direct RPC
--     call.
--
-- Pushing 090000 as-is would DROP/CREATE the function back down to 5 params
-- and break both call sites at runtime ("function ... does not exist").
--
-- This migration keeps 090000's real fix -- routing add/upgrade/swap
-- deduction through the already-audited deduct_stock_fifo() primitive
-- instead of the hand-rolled, unlocked FIFO loop that let every
-- modifier-bearing order since 20260810174000 deduct stock through an
-- unlocked, unguarded path -- and layers 100000's p_performed_by param and
-- stock_before/stock_after audit fields back on top, end to end:
--   * p_performed_by re-added as a 6th param (default NULL, same position),
--     forwarded into deduct_stock_fifo() and every inventory_transactions
--     insert.
--   * stock_before/stock_after captured for add/upgrade and swap (exact,
--     not re-read: deduct_stock_fifo only reports success when the full
--     quantity was deducted, so stock_after = stock_before - qty), and
--     added to 'remove', which never had them in any prior version.
--   * 090000's new insufficient-stock guard on 'swap' and its
--     unhandled-customization-type safety net for 'replace' (CASE with no
--     ELSE previously raised CASE_NOT_FOUND, surfaced to customers as a
--     misleading "out of stock" error) are both kept as-is.
--
-- create_order_customization_snapshot is untouched: it already has the
-- 6-param signature and already forwards p_performed_by positionally in
-- the same order used here.

DROP FUNCTION IF EXISTS "public"."process_customization_inventory_safe" CASCADE;

CREATE FUNCTION "public"."process_customization_inventory_safe"(
    "p_order_type" "text",
    "p_order_id" "uuid",
    "p_order_item_id" "uuid",
    "p_selections" "jsonb",
    "p_base_quantity" integer DEFAULT 1,
    "p_performed_by" "uuid" DEFAULT NULL
) RETURNS TABLE(
    "success" boolean,
    "items_added" integer,
    "items_removed" integer,
    "items_swapped" integer,
    "deduction_log" "jsonb"
)
LANGUAGE "plpgsql"
AS $$
DECLARE
    v_selection JSONB;
    v_inv_item_id UUID;
    v_qty_to_deduct DECIMAL(10,3);
    v_min_stock DECIMAL(10,3);
    v_item_name TEXT;
    v_log JSONB := '[]'::JSONB;
    v_added INTEGER := 0;
    v_removed INTEGER := 0;
    v_swapped INTEGER := 0;
    v_tenant_id UUID;
    v_property_id UUID;
    v_deduct_result JSONB;
    v_current_stock DECIMAL(10,3);
    v_stock_after DECIMAL(10,3);
BEGIN
    -- Get tenant_id and property_id from the order
    SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
    FROM transactions
    WHERE id = p_order_id;

    IF v_tenant_id IS NULL THEN
        SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
        FROM inventory_items
        WHERE id = (SELECT (p_selections->0->>'inventoryItemId')::UUID LIMIT 1);
    END IF;

    FOR v_selection IN SELECT * FROM jsonb_array_elements(COALESCE(p_selections, '[]'::JSONB))
    LOOP
        v_inv_item_id := (v_selection->>'inventoryItemId')::UUID;

        CASE (v_selection->>'customizationType')
            WHEN 'add', 'upgrade' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1)
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;

                    SELECT current_stock, min_stock_level, name INTO v_current_stock, v_min_stock, v_item_name
                    FROM inventory_items WHERE id = v_inv_item_id;

                    -- Race-safe deduction: locks inventory_items and the
                    -- inventory_batches cursor internally, pre-checks total
                    -- stock, and only mutates rows on success.
                    v_deduct_result := "public"."deduct_stock_fifo"(
                        v_inv_item_id, v_qty_to_deduct, 'order_customization'::character varying, p_performed_by
                    );

                    IF COALESCE((v_deduct_result->>'success')::boolean, false) THEN
                        v_stock_after := v_current_stock - v_qty_to_deduct;

                        INSERT INTO inventory_transactions(
                            item_id, transaction_type, quantity,
                            stock_before, stock_after,
                            reference_type, reference_id, notes,
                            performed_by, tenant_id, property_id
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            v_current_stock, v_stock_after,
                            p_order_type || '_customization', p_order_id,
                            'Customization: ' || (v_selection->>'optionName'),
                            p_performed_by, v_tenant_id, v_property_id
                        );

                        UPDATE order_customizations
                        SET inventory_quantity_used = v_qty_to_deduct,
                            inventory_deducted = true
                        WHERE order_type = p_order_type
                        AND order_id = p_order_id
                        AND (p_order_item_id IS NULL OR order_item_id = p_order_item_id)
                        AND customization_option_id = (v_selection->>'optionId')::UUID;

                        v_added := v_added + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'deducted',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );

                        IF v_stock_after <= COALESCE(v_min_stock, 0) THEN
                            INSERT INTO customization_events (event_type, payload, tenant_id, property_id)
                            VALUES (
                                'inventory.warning',
                                jsonb_build_object(
                                    'warning_type', 'low_stock',
                                    'inventory_item_id', v_inv_item_id,
                                    'item_name', v_item_name,
                                    'remaining_stock', v_stock_after,
                                    'min_stock_level', v_min_stock
                                ),
                                v_tenant_id, v_property_id
                            );
                        END IF;
                    ELSE
                        -- Out-of-stock modifiers are flagged instead of
                        -- silently under-deducted. Non-fatal by design.
                        INSERT INTO customization_events (event_type, payload, tenant_id, property_id)
                        VALUES (
                            'inventory.warning',
                            jsonb_build_object(
                                'warning_type', 'insufficient_stock',
                                'inventory_item_id', v_inv_item_id,
                                'item_name', v_item_name,
                                'required', v_qty_to_deduct,
                                'available', v_deduct_result->>'available',
                                'order_id', p_order_id
                            ),
                            v_tenant_id, v_property_id
                        );
                        v_log := v_log || jsonb_build_object(
                            'action', 'insufficient_stock',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'requested', v_qty_to_deduct
                        );
                    END IF;
                END IF;

            WHEN 'swap' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1)
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;

                    SELECT current_stock INTO v_current_stock
                    FROM inventory_items WHERE id = v_inv_item_id;

                    v_deduct_result := "public"."deduct_stock_fifo"(
                        v_inv_item_id, v_qty_to_deduct, 'order_customization_swap'::character varying, p_performed_by
                    );

                    IF COALESCE((v_deduct_result->>'success')::boolean, false) THEN
                        v_stock_after := v_current_stock - v_qty_to_deduct;

                        INSERT INTO inventory_transactions(
                            item_id, transaction_type, quantity,
                            stock_before, stock_after,
                            reference_type, reference_id, notes,
                            performed_by, tenant_id, property_id
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            v_current_stock, v_stock_after,
                            p_order_type || '_customization', p_order_id,
                            'Swap (added): ' || (v_selection->>'optionName'),
                            p_performed_by, v_tenant_id, v_property_id
                        );

                        UPDATE order_customizations
                        SET inventory_quantity_used = v_qty_to_deduct,
                            inventory_deducted = true
                        WHERE order_type = p_order_type
                        AND order_id = p_order_id
                        AND (p_order_item_id IS NULL OR order_item_id = p_order_item_id)
                        AND customization_option_id = (v_selection->>'optionId')::UUID;

                        v_swapped := v_swapped + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'swapped',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );
                    ELSE
                        -- New protection: swap had no stock guard at all in
                        -- any prior version.
                        INSERT INTO customization_events (event_type, payload, tenant_id, property_id)
                        VALUES (
                            'inventory.warning',
                            jsonb_build_object(
                                'warning_type', 'insufficient_stock',
                                'inventory_item_id', v_inv_item_id,
                                'required', v_qty_to_deduct,
                                'available', v_deduct_result->>'available',
                                'order_id', p_order_id
                            ),
                            v_tenant_id, v_property_id
                        );
                        v_log := v_log || jsonb_build_object(
                            'action', 'insufficient_stock',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'requested', v_qty_to_deduct
                        );
                    END IF;
                END IF;

            WHEN 'remove' THEN
                -- Restore the ingredient's base-recipe quantity. Plain +=
                -- is atomic per-row in Postgres, and this restores onto the
                -- aggregate count rather than a specific batch, so no
                -- explicit lock or FIFO primitive is needed here.
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1)
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;

                    SELECT current_stock INTO v_current_stock
                    FROM inventory_items WHERE id = v_inv_item_id;

                    UPDATE inventory_items
                    SET current_stock = current_stock + v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id;

                    IF FOUND THEN
                        v_stock_after := v_current_stock + v_qty_to_deduct;

                        INSERT INTO inventory_transactions(
                            item_id, transaction_type, quantity,
                            stock_before, stock_after,
                            reference_type, reference_id, notes,
                            performed_by, tenant_id, property_id
                        ) VALUES (
                            v_inv_item_id, 'restoration', v_qty_to_deduct,
                            v_current_stock, v_stock_after,
                            p_order_type || '_customization', p_order_id,
                            'Removed base ingredient: ' || (v_selection->>'optionName'),
                            p_performed_by, v_tenant_id, v_property_id
                        );

                        v_removed := v_removed + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'restored',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );
                    END IF;
                END IF;

            ELSE
                -- Safety net: CustomizationType in TS also includes
                -- 'replace' (customization.service.ts, CustomizationSelector.tsx),
                -- which no version of this function has ever handled. A CASE
                -- with no matching WHEN and no ELSE raises CASE_NOT_FOUND,
                -- which the caller (dynamic-module.router.ts) surfaces to the
                -- customer as a misleading "out of stock" error. This logs
                -- it instead of crashing the order and does not attempt a
                -- stock deduction, since 'replace' has no defined semantics
                -- anywhere else in the codebase -- that's a product decision,
                -- not one to guess inside a migration.
                v_log := v_log || jsonb_build_object(
                    'action', 'unhandled_customization_type',
                    'customizationType', v_selection->>'customizationType',
                    'optionName', v_selection->>'optionName'
                );
        END CASE;
    END LOOP;

    RETURN QUERY SELECT
        true,
        v_added,
        v_removed,
        v_swapped,
        v_log;
END;
$$;

ALTER FUNCTION "public"."process_customization_inventory_safe"(
  "text", "uuid", "uuid", "jsonb", integer, "uuid"
) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."process_customization_inventory_safe"(
  "text", "uuid", "uuid", "jsonb", integer, "uuid"
) TO "service_role";
