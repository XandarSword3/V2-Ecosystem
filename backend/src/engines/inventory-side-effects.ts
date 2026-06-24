/**
 * Inventory Side Effects for Engine State Transitions
 * 
 * Automatically deducts inventory when transactions reach states
 * that indicate items have been consumed/used.
 * Uses deduct_inventory_for_order_v2 which handles:
 *   - Base recipe ingredient deduction
 *   - 'add' modifier ingredient deduction
 *   - 'remove' modifier suppression (skips base ingredient)
 */

import type { StateTransition } from './types.js';
import type { SideEffectFn } from './state-machine.js';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

// ============================================
// Inventory Deduction Side Effect
// ============================================

/**
 * Deduct inventory for a transaction using the unified v2 function
 * which correctly accounts for modifier selections (add/remove/swap).
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

    // Use the unified v2 function that handles base ingredients + modifier deductions
    // and correctly skips ingredients suppressed by 'remove' modifiers.
    const { data, error } = await supabase.rpc('deduct_inventory_for_order_v2', {
      p_order_id: targetOrderId,
    });

    if (error) {
      logger.warn(`[INVENTORY SIDE EFFECT] deduct_inventory_for_order_v2 failed: ${error.message}. Will attempt legacy path.`);

      // Legacy fallback: query order items and deduct base recipe only (no modifier awareness)
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, catalog_item_id')
        .eq('order_id', targetOrderId);

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
          .eq('catalog_item_id', item.catalog_item_id || item.product_id);

        if (recipeError || !recipeIngredients || recipeIngredients.length === 0) continue;

        for (const ingredient of recipeIngredients) {
          const deductQty = ingredient.quantity_required * item.quantity;

          // Use correct RPC parameter name: p_item_id
          const { error: deductError } = await supabase.rpc('deduct_stock_fifo', {
            p_item_id: ingredient.inventory_item_id,
            p_quantity: deductQty,
            p_reason: `order`,
            p_reference_id: targetOrderId,
            p_notes: `Auto-deducted on order ${transition.to} state (legacy path)`,
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

    if (data) {
      logger.info(`[INVENTORY SIDE EFFECT] Deducted inventory via v2`, {
        orderId: targetOrderId,
        baseItemsDeducted: data.base_items_deducted,
        modifierItemsDeducted: data.modifier_items_deducted,
        skippedRemovals: data.skipped_removals,
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
 * Restore inventory when an order is cancelled.
 * Reverses previous deductions recorded in inventory_transactions.
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

    // FIX: correct column is 'transaction_type', not 'type'
    const { data: deductions, error: findError } = await supabase
      .from('inventory_transactions')
      .select('id, item_id, quantity')
      .eq('reference_type', 'order')
      .eq('reference_id', targetOrderId)
      .eq('transaction_type', 'sale'); // sale = consumption; also covers order_modifier entries

    if (findError || !deductions || deductions.length === 0) {
      logger.info(`[INVENTORY SIDE EFFECT] No previous deductions found for order ${targetOrderId}`);
      return;
    }

    let totalRestored = 0;

    for (const deduction of deductions) {
      const { error: restoreError } = await supabase.rpc('adjust_stock', {
        p_inventory_item_id: deduction.item_id,
        p_quantity: Math.abs(deduction.quantity), // restore the absolute amount
        p_reason: 'restoration',
        p_notes: `Restored due to order cancellation (reversal of transaction ${deduction.id})`,
        p_reference_type: 'order',
        p_reference_id: targetOrderId,
      });

      if (!restoreError) {
        totalRestored++;
      } else {
        logger.warn(`[INVENTORY SIDE EFFECT] Failed to restore item ${deduction.item_id}: ${restoreError.message}`);
      }
    }

    logger.info(`[INVENTORY SIDE EFFECT] Restored ${totalRestored}/${deductions.length} items for cancelled order ${targetOrderId}`);

  } catch (error) {
    logger.error('[INVENTORY SIDE EFFECT] Error restoring inventory', { error, orderId, transactionId });
  }
};


