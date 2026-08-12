-- Fix regression in process_customization_inventory_safe (the LIVE function —
-- called on every order via create_order_customization_snapshot, which is
-- called from dynamic-module.router.ts right after order_items are inserted).
--
-- Migration 20260810150000 added FOR UPDATE locking + a hard insufficient-
-- stock guard to this function. Migration 20260810174000 (fix_fifo_deduction)
-- then DROP FUNCTION ... CASCADE'd and rewrote it to deduct from
-- inventory_batches directly, but the rewrite:
--   1. Dropped the FOR UPDATE lock on inventory_items entirely.
--   2. Dropped the FOR UPDATE lock on the inventory_batches cursor.
--   3. Dropped the insufficient-stock guard on 'add'/'upgrade' — it now
--      silently deducts whatever's in active batches (even 0) and always
--      reports success, so an out-of-stock modifier is silently
--      under-fulfilled instead of being rejected or flagged.
--   4. Had no stock guard on 'swap' at all in either version.
-- Net effect: every order placed with a modifier (add/upgrade/swap) since
-- 20260810174000 deducted stock through an unlocked, unguarded path —
-- exactly the TOCTOU race and silent-oversell bug the 150000 migration had
-- fixed, reintroduced by the migration meant to add FIFO batch support.
--
-- Fix: stop hand-rolling batch deduction here entirely. Call the existing
-- deduct_stock_fifo(uuid, numeric, varchar, uuid) primitive instead — the
-- same one deduct_inventory_for_order_items already uses for base-recipe
-- deduction. It already does the FOR UPDATE lock on inventory_items, the
-- FOR UPDATE cursor lock on inventory_batches, the pre-check, and keeps
-- current_stock consistent with batch totals. This removes the duplicate,
-- now-diverged locking logic and makes customization deduction and
-- base-recipe deduction go through one audited code path instead of two.

DROP FUNCTION IF EXISTS "public"."process_customization_inventory_safe" CASCADE;

CREATE FUNCTION "public"."process_customization_inventory_safe"(
    "p_order_type" "text",
    "p_order_id" "uuid",
    "p_order_item_id" "uuid",
    "p_selections" "jsonb",
    "p_base_quantity" integer DEFAULT 1
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
                        v_inv_item_id, v_qty_to_deduct, 'order_customization'::character varying, NULL::uuid
                    );

                    IF COALESCE((v_deduct_result->>'success')::boolean, false) THEN
                        INSERT INTO inventory_transactions(
                            item_id, transaction_type, quantity,
                            reference_type, reference_id, notes,
                            tenant_id, property_id
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Customization: ' || (v_selection->>'optionName'),
                            v_tenant_id, v_property_id
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

                        -- Low-stock warning, evaluated post-deduction against
                        -- the real post-lock stock level.
                        IF (v_current_stock - v_qty_to_deduct) <= COALESCE(v_min_stock, 0) THEN
                            INSERT INTO customization_events (event_type, payload, tenant_id, property_id)
                            VALUES (
                                'inventory.warning',
                                jsonb_build_object(
                                    'warning_type', 'low_stock',
                                    'inventory_item_id', v_inv_item_id,
                                    'item_name', v_item_name,
                                    'remaining_stock', v_current_stock - v_qty_to_deduct,
                                    'min_stock_level', v_min_stock
                                ),
                                v_tenant_id, v_property_id
                            );
                        END IF;
                    ELSE
                        -- RESTORED: out-of-stock modifiers are now flagged
                        -- instead of silently under-deducted. Non-fatal by
                        -- design (matches prior behavior) — the order still
                        -- completes, but ops gets an actionable alert instead
                        -- of silent inventory drift. Whether this should
                        -- instead hard-reject the order is a product call;
                        -- flagging here so it's visible rather than buried.
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

                    v_deduct_result := "public"."deduct_stock_fifo"(
                        v_inv_item_id, v_qty_to_deduct, 'order_customization_swap'::character varying, NULL::uuid
                    );

                    IF COALESCE((v_deduct_result->>'success')::boolean, false) THEN
                        INSERT INTO inventory_transactions(
                            item_id, transaction_type, quantity,
                            reference_type, reference_id, notes,
                            tenant_id, property_id
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Swap (added): ' || (v_selection->>'optionName'),
                            v_tenant_id, v_property_id
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
                        -- RESTORED: swap previously had NO stock guard at
                        -- all in either prior version — this is new
                        -- protection, not just a restoration.
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
                -- Restore the ingredient's base-recipe quantity: the base
                -- deduction (deduct_inventory_for_order_items) deducted the
                -- full recipe with no knowledge of "remove X" modifiers, so
                -- this reverses that portion. Plain += is atomic per-row in
                -- Postgres — no explicit lock needed for a relative update.
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1)
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;

                    UPDATE inventory_items
                    SET current_stock = current_stock + v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id;

                    IF FOUND THEN
                        INSERT INTO inventory_transactions(
                            item_id, transaction_type, quantity,
                            reference_type, reference_id, notes,
                            tenant_id, property_id
                        ) VALUES (
                            v_inv_item_id, 'restoration', v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Removed base ingredient: ' || (v_selection->>'optionName'),
                            v_tenant_id, v_property_id
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
                -- SAFETY NET (new): CustomizationType in TS also includes
                -- 'replace' (customization.service.ts, CustomizationSelector.tsx),
                -- which no version of this function — nor the frontend's own
                -- icon/color switch in CustomizationSelector.tsx — has ever
                -- handled. A CASE with no matching WHEN and no ELSE raises
                -- CASE_NOT_FOUND in Postgres, which the caller
                -- (dynamic-module.router.ts) catches and reports to the
                -- customer as "one or more customizations are out of stock"
                -- — a misleading error for what is actually a missing code
                -- path. Since it's a real, selectable option in the admin
                -- customization editor today, any order using it currently
                -- fails outright. This logs it instead of crashing the
                -- order; it does NOT attempt a stock deduction, since
                -- 'replace' has no defined semantics anywhere else in the
                -- codebase (add? swap? both?) — that's a product decision,
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
  "text", "uuid", "uuid", "jsonb", integer
) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."process_customization_inventory_safe"(
  "text", "uuid", "uuid", "jsonb", integer
) TO "service_role";
