/**
 * Inventory Side Effects for Engine State Transitions
 * 
 * Automatically deducts inventory when transactions reach states
 * that indicate items have been consumed/used.
 */

import type { StateTransition } from './types.js';
import type { SideEffectFn } from './state-machine.js';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

// ============================================
// Inventory Deduction Side Effect
// ============================================

/**
 * Deduct inventory for a transaction based on its order items and recipes.
 * Called when a transaction reaches a state that indicates items are being consumed.
 */
export const deductInventorySideEffect: SideEffectFn = async (
  transition: StateTransition,
  context: Record<string, unknown>,
) => {
  const transactionId = context.transactionId as string | undefined;
  const orderId = context.orderId as string | undefined;
  const referenceTable = context.referenceTable as string | undefined;
  
  if (!transactionId && !orderId) {
    logger.warn('[INVENTORY SIDE EFFECT] No transactionId or orderId in context, skipping inventory deduction');
    return;
  }

  try {
    const supabase = getSupabase();
    
    // Find the order items associated with this transaction
    const targetOrderId = orderId || transactionId;
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, quantity, menu_item_id')
      .eq('order_id', targetOrderId);

    if (itemsError || !orderItems || orderItems.length === 0) {
      logger.info(`[INVENTORY SIDE EFFECT] No order items found for order ${targetOrderId}`);
      return;
    }

    // For each order item, find recipe ingredients and deduct
    let totalDeductions = 0;
    const deductionErrors: string[] = [];

    for (const item of orderItems) {
      // Find recipe for this menu item
      const { data: recipeIngredients, error: recipeError } = await supabase
        .from('menu_item_ingredients')
        .select('inventory_item_id, quantity_required, unit')
        .eq('menu_item_id', item.menu_item_id || item.product_id);

      if (recipeError || !recipeIngredients || recipeIngredients.length === 0) {
        continue; // No recipe for this item
      }

      // Deduct each ingredient
      for (const ingredient of recipeIngredients) {
        const deductQty = ingredient.quantity_required * item.quantity;
        
        try {
          // Call the inventory deduction RPC
          const { error: deductError } = await supabase.rpc('deduct_stock_fifo', {
            p_inventory_item_id: ingredient.inventory_item_id,
            p_quantity: deductQty,
            p_reference_type: 'order',
            p_reference_id: targetOrderId,
            p_notes: `Auto-deducted on order ${transition.to} state`,
          });

          if (deductError) {
            deductionErrors.push(`Failed to deduct ${ingredient.inventory_item_id}: ${deductError.message}`);
          } else {
            totalDeductions++;
          }
        } catch (err) {
          deductionErrors.push(`Exception deducting ${ingredient.inventory_item_id}: ${err}`);
        }
      }
    }

    // Log results
    if (totalDeductions > 0) {
      logger.info(`[INVENTORY SIDE EFFECT] Deducted inventory for ${totalDeductions} ingredients`, {
        orderId: targetOrderId,
        transition: `${transition.from} → ${transition.to}`,
      });
    }

    if (deductionErrors.length > 0) {
      logger.error(`[INVENTORY SIDE EFFECT] Some deductions failed`, {
        orderId: targetOrderId,
        errors: deductionErrors,
      });
      
      // Create alert for failed deductions
      await supabase.from('inventory_alerts').insert({
        alert_type: 'deduction_failed',
        message: `Inventory deduction failed for order ${targetOrderId}: ${deductionErrors.join(', ')}`,
        severity: 'warning',
        reference_id: targetOrderId,
        reference_table: 'orders',
      });
    }

  } catch (error) {
    logger.error('[INVENTORY SIDE EFFECT] Unexpected error', { error, orderId, transactionId });
    // Don't throw - side effects are fire-and-forget
  }
};

// ============================================
// Inventory Restoration Side Effect (for cancellations)
// ============================================

/**
 * Restore inventory when an order is cancelled.
 * Reverses previous deductions.
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

    // Find previous deductions for this order
    const { data: deductions, error: findError } = await supabase
      .from('inventory_transactions')
      .select('id, item_id, quantity')
      .eq('reference_type', 'order')
      .eq('reference_id', targetOrderId)
      .eq('type', 'out');

    if (findError || !deductions || deductions.length === 0) {
      logger.info(`[INVENTORY SIDE EFFECT] No previous deductions found for order ${targetOrderId}`);
      return;
    }

    // Restore each deducted quantity
    let totalRestored = 0;
    
    for (const deduction of deductions) {
      const { error: restoreError } = await supabase.rpc('adjust_stock', {
        p_inventory_item_id: deduction.item_id,
        p_quantity: deduction.quantity, // Add back the deducted amount
        p_reason: 'restoration',
        p_notes: `Restored due to order cancellation (reversal of transaction ${deduction.id})`,
        p_reference_type: 'order',
        p_reference_id: targetOrderId,
      });

      if (!restoreError) {
        totalRestored++;
      }
    }

    logger.info(`[INVENTORY SIDE EFFECT] Restored ${totalRestored} items for cancelled order ${targetOrderId}`);

  } catch (error) {
    logger.error('[INVENTORY SIDE EFFECT] Error restoring inventory', { error, orderId, transactionId });
  }
};
