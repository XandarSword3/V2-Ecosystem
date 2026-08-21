/**
 * Hospitality resource adapter (plan Phase 5).
 *
 * The FIRST implementation of the generic resource-consumption contract.
 * Resolves a hospitality transaction's commercial lines into typed generic
 * ResourceRequirement[] — the hospitality BOM:
 *
 *   order_items → menu_item_ingredients → inventory_item requirements
 *
 * ALL vertical vocabulary (menu_item_ingredients, recipe ingredients, order
 * items) lives HERE, in the adapter — never in engines/ (the generic
 * resource-contract and ResourceConsumptionService know only
 * ResourceRequirement { kind: 'inventory_item', ref, quantity }).
 *
 * A future capacity adapter resolves to kind 'capacity_slot', a staff adapter
 * to 'staff_time' — the same generic service consumes them all.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResourceRequirement } from '../../engines/types.js';
import type { ResourceRequirementResolver } from '../../modules/resource/resource-consumption.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Resolve a transaction's order items into inventory requirements via the
 * recipe/BOM join. Reads ONLY the hospitality tables this adapter owns.
 *
 * Fail-closed on a read error: an error THROWS so the caller surfaces it —
 * a requirements-resolution failure must never be silently treated as "no
 * resources consumed" (which would let stock go undeducted).
 */
export const hospitalityResourceResolver: ResourceRequirementResolver = {
  async resolveRequirements(
    supabase: SupabaseClient,
    transactionId: string,
  ): Promise<ResourceRequirement[]> {
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, quantity, catalog_item_id')
      .eq('transaction_id', transactionId);

    if (itemsError) {
      logger.error('[HospitalityResources] Failed to read order items', { transactionId, error: itemsError.message });
      throw new Error(`Failed to read order items for transaction ${transactionId}: ${itemsError.message}`);
    }
    if (!orderItems || orderItems.length === 0) {
      return [];
    }

    const requirements: ResourceRequirement[] = [];
    for (const item of orderItems) {
      const { data: ingredients, error: recipeError } = await supabase
        .from('menu_item_ingredients')
        .select('inventory_item_id, quantity_required, unit')
        .eq('catalog_item_id', item.catalog_item_id);

      if (recipeError) {
        logger.error('[HospitalityResources] Failed to read recipe ingredients', {
          transactionId,
          catalogItemId: item.catalog_item_id,
          error: recipeError.message,
        });
        throw new Error(
          `Failed to read recipe ingredients for catalog item ${item.catalog_item_id}: ${recipeError.message}`,
        );
      }
      if (!ingredients || ingredients.length === 0) continue;

      for (const ingredient of ingredients) {
        requirements.push({
          kind: 'inventory_item',
          ref: ingredient.inventory_item_id,
          quantity: Number(ingredient.quantity_required) * Number(item.quantity),
          unit: ingredient.unit ?? undefined,
        });
      }
    }

    logger.info('[HospitalityResources] Resolved resource requirements', {
      transactionId,
      requirements: requirements.length,
    });
    return requirements;
  },
};
