/**
 * Inventory Side Effects for Engine State Transitions (DEPRECATED — Path B)
 *
 * PHASE 5 AUTHORITY ARCHITECTURE:
 *
 * There are two inventory mutation authorities in the Engine A order flow:
 *
 *   Path A (AUTHORITATIVE): deduct_inventory_for_order_items — called at
 *   order creation time in dynamic-module.router.ts. This is the ONE true
 *   stock authority. It deducts base stock immediately, before the order is
 *   committed. Restored by restore_inventory_for_order_items on cancel.
 *
 *   Path B (THIS FILE — DEPRECATED): deduct_inventory_for_order — called
 *   as a state machine side effect on confirmation. This is now a no-op for
 *   the normal flow because Path A already deducted at creation. Kept only
 *   as a safety net for legacy rows that predate Path A. If Path A is
 *   guaranteed to have run for every order, this entire side effect can be
 *   removed.
 *
 *   Path C (Phase 5): ResourceConsumptionService — allocation/consumption/
 *   release via resource_allocations table. This is the Phase 5 resource
 *   lifecycle authority, coexisting with Path A's inventory_transactions.
 *   Path C manages the PLANNING layer (allocation = reservation);
 *   Path A manages the PHYSICAL layer (deduction = stock movement).
 *
 * DO NOT add a third inventory authority. If a new inventory operation is
 * needed, it must go through either Path A (for direct stock mutations) or
 * Path C (for resource lifecycle planning), never as a parallel path.
 *
 * Fixed 2026-08-05: the previous version called deduct_inventory_for_order_v2
 * (does not exist in this database) and, on the fallback path, called
 * deduct_stock_fifo with p_reference_id/p_notes params that neither live
 * overload of that function accepts — so both deduction paths always
 * errored, silently, and no inventory was ever actually deducted. Now calls
 * the real live deduct_inventory_for_order(p_transaction_id) function.
 * Restoration previously called a nonexistent adjust_stock RPC filtered on
 * the wrong reference_type; it now calls restore_inventory_for_order (added
 * in migration 20260805072810), which matches what deduction actually writes.
 */

import type { StateTransition } from './types.js';
import type { SideEffectFn } from './state-machine.js';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

// ============================================
// Inventory Deduction Side Effect
// ============================================

/**
 * Deduct inventory for a transaction using the live deduct_inventory_for_order
 * function, which loops the order's items, deducts each recipe ingredient,
 * and writes an audit row per deduction (reference_type='transaction') that
 * restoreInventorySideEffect later reads to reverse on cancellation.
 * Called when a transaction reaches a state indicating items are consumed.
 */
export const deductInventorySideEffect: SideEffectFn = async (
  transition: StateTransition,
  context: Record<string, unknown>,
) => {
  const transactionId = context.transactionId as string | undefined;
  const orderId = context.orderId as string | undefined;

  if (!transactionId && !orderId) {
    logger.warn('[INVENTORY SIDE EFFECT] No transactionId or orderId in context, skipping inventory deduction');
    return;
  }

  try {
    const supabase = getSupabase();
    const targetOrderId = orderId || transactionId;
    const userId = context.userId as string | undefined;

    const { data, error } = await supabase.rpc('deduct_inventory_for_order', {
      p_transaction_id: targetOrderId,
      p_performed_by: userId,
    });

    // RETURNS TABLE(...) comes back through supabase-js as an array of rows.
    const result = Array.isArray(data) ? data[0] : data;

    if (error || (result && result.success === false)) {
      const reason = error?.message || result?.error_message || 'unknown error';
      logger.warn(`[INVENTORY SIDE EFFECT] deduct_inventory_for_order failed: ${reason}. Will attempt legacy path.`);

      // Legacy fallback: query order items and deduct base recipe only (no
      // modifier awareness). NOTE: neither live overload of deduct_stock_fifo
      // writes an inventory_transactions row, so anything deducted only
      // through this fallback cannot later be found and reversed by
      // restoreInventorySideEffect — this path is a last resort for keeping
      // stock counts roughly right, not a substitute for the primary RPC.
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, quantity, catalog_item_id')
        .eq('transaction_id', targetOrderId);

      if (itemsError || !orderItems || orderItems.length === 0) {
        logger.info(`[INVENTORY SIDE EFFECT] No order items found for order ${targetOrderId}`);
        return;
      }

      let totalDeductions = 0;
      const deductionErrors: string[] = [];

      for (const item of orderItems) {
        const { data: recipeIngredients, error: recipeError } = await supabase
          .from('menu_item_ingredients')
          .select('inventory_item_id, quantity_required, unit')
          .eq('catalog_item_id', item.catalog_item_id);

        if (recipeError || !recipeIngredients || recipeIngredients.length === 0) continue;

        for (const ingredient of recipeIngredients) {
          const deductQty = ingredient.quantity_required * item.quantity;

          // Matches the live deduct_stock_fifo signature exactly:
          // (p_item_id, p_quantity, p_reason, p_user_id). No reference_id or
          // notes param exists on either live overload.
          const { error: deductError } = await supabase.rpc('deduct_stock_fifo', {
            p_item_id: ingredient.inventory_item_id,
            p_quantity: deductQty,
            p_reason: `order`,
          });

          if (deductError) {
            deductionErrors.push(`Failed to deduct ${ingredient.inventory_item_id}: ${deductError.message}`);
          } else {
            totalDeductions++;
          }
        }
      }

      if (totalDeductions > 0) {
        logger.info(`[INVENTORY SIDE EFFECT] Legacy: deducted ${totalDeductions} ingredients`, {
          orderId: targetOrderId,
          transition: `${transition.from} → ${transition.to}`,
        });
      }

      if (deductionErrors.length > 0) {
        logger.error(`[INVENTORY SIDE EFFECT] Some legacy deductions failed`, {
          orderId: targetOrderId,
          errors: deductionErrors,
        });

        await supabase.from('inventory_alerts').insert({
          alert_type: 'deduction_failed',
          message: `Inventory deduction failed for order ${targetOrderId}: ${deductionErrors.join(', ')}`,
          severity: 'warning',
          reference_id: targetOrderId,
          reference_table: 'orders',
        });
      }
      return;
    }

    if (result) {
      logger.info(`[INVENTORY SIDE EFFECT] Deducted inventory`, {
        orderId: targetOrderId,
        itemsDeducted: result.items_deducted,
        transition: `${transition.from} → ${transition.to}`,
      });
    }

  } catch (error) {
    logger.error('[INVENTORY SIDE EFFECT] Unexpected error', { error, orderId, transactionId });
    // Don't throw — side effects are fire-and-forget
  }
};

// ============================================
// Inventory Restoration Side Effect (for cancellations)
// ============================================

/**
 * Restore inventory when an order is cancelled, via the atomic
 * restore_inventory_for_order function (migration 20260805072810), which
 * locks and reverses the exact rows deduct_inventory_for_order wrote for
 * this transaction (reference_type='transaction') and is idempotent against
 * being called twice for the same order.
 */
export const restoreInventorySideEffect: SideEffectFn = async (
  transition: StateTransition,
  context: Record<string, unknown>,
) => {
  const transactionId = context.transactionId as string | undefined;
  const orderId = context.orderId as string | undefined;

  if (!transactionId && !orderId) {
    logger.warn('[INVENTORY SIDE EFFECT] No transactionId or orderId in context, skipping inventory restoration');
    return;
  }

  try {
    const supabase = getSupabase();
    const targetOrderId = orderId || transactionId;
    const userId = context.userId as string | undefined;

    const { data, error } = await supabase.rpc('restore_inventory_for_order', {
      p_transaction_id: targetOrderId,
      p_performed_by: userId ?? null,
    });

    const result = Array.isArray(data) ? data[0] : data;

    if (error || (result && result.success === false)) {
      const reason = error?.message || result?.error_message || 'unknown error';
      logger.error(`[INVENTORY SIDE EFFECT] restore_inventory_for_order failed: ${reason}`, {
        orderId: targetOrderId,
      });
      return;
    }

    logger.info(`[INVENTORY SIDE EFFECT] Restored ${result?.items_restored ?? 0} items for cancelled order ${targetOrderId}`);

  } catch (error) {
    logger.error('[INVENTORY SIDE EFFECT] Error restoring inventory', { error, orderId, transactionId });
  }
};
