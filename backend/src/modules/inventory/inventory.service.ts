
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';

export interface IngredientDeduction {
    inventory_item_id: string;
    quantity: number;
}

export class InventoryService {
    /**
     * Deducts stock for a list of ingredients based on a reference (order/ticket).
     * This is a generic method that can be used by any module.
     */
    async deductIngredients(
        referenceId: string,
        referenceType: 'order' | 'ticket' | 'manual',
        deductions: IngredientDeduction[],
        supabase: SupabaseClient
    ) {
        if (deductions.length === 0) return;

        for (const deduction of deductions) {
            try {
                const { inventory_item_id, quantity } = deduction;

                // Try RPC first for FIFO deduction (assuming it exists in DB)
                const { error: rpcError } = await supabase.rpc('deduct_stock_fifo', {
                    p_item_id: inventory_item_id,
                    p_quantity: quantity,
                    p_reason: `${referenceType.toUpperCase()} #${referenceId}`
                });

                if (rpcError) {
                    logger.warn(`[INVENTORY SERVICE] RPC deduct_stock_fifo failed/unavailable, using fallback. Error: ${rpcError.message}`);

                    // Fallback: Direct update of current_stock
                    const { data: currentItem, error: fetchError } = await supabase
                        .from('inventory_items')
                        .select('current_stock')
                        .eq('id', inventory_item_id)
                        .single();

                    if (fetchError) {
                        logger.error(`[INVENTORY SERVICE] Failed to fetch item ${inventory_item_id} for fallback:`, fetchError);
                        continue;
                    }

                    const stockBefore = currentItem.current_stock || 0;
                    const newStock = Math.max(0, stockBefore - quantity);

                    const { error: updateError } = await supabase
                        .from('inventory_items')
                        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
                        .eq('id', inventory_item_id);

                    if (updateError) {
                        logger.error(`[INVENTORY SERVICE] Fallback update failed for item ${inventory_item_id}:`, updateError);
                    } else {
                        // Log transaction
                        // FIX: Iteration 11 - Correct column names to match DB schema
                        await supabase.from('inventory_transactions').insert({
                            item_id: inventory_item_id,
                            transaction_type: 'consumption',
                            quantity: quantity,
                            stock_before: stockBefore,
                            stock_after: newStock,
                            reference_type: referenceType,
                            reference_id: referenceId,
                            notes: `${referenceType} consumption`,
                        }).then(({ error: insertError }) => {
                            if (insertError) logger.warn('[INVENTORY SERVICE] Failed to log inventory transaction:', insertError.message);
                        });
                    }
                }
            } catch (err) {
                logger.error(`[INVENTORY SERVICE] Error processing deduction for item ${deduction.inventory_item_id}:`, err);
            }
        }
    }

    /**
     * Processes deductions for a list of items (menu items or sessions).
     * @param recipeTable The table to fetch recipes from ('menu_item_ingredients' or 'session_ingredients')
     * @param foreignKey The column name for the item ID in the recipe table ('catalog_item_id' or 'session_id')
     */
    async processDeductions(
        referenceId: string,
        referenceType: 'order' | 'ticket',
        items: Array<{ id: string; quantity: number }>,
        recipeTable: 'menu_item_ingredients' | 'session_ingredients',
        foreignKey: string,
        supabase: SupabaseClient
    ) {
        const itemIds = items.map(i => i.id);
        if (itemIds.length === 0) return;

        // 1. Fetch recipes
        const { data: recipes, error: recipeError } = await supabase
            .from(recipeTable)
            .select(`${foreignKey}, inventory_item_id, quantity_required`)
            .in(foreignKey, itemIds);

        if (recipeError || !recipes || recipes.length === 0) {
            if (recipeError) logger.warn(`[INVENTORY SERVICE] Error fetching recipes from ${recipeTable}:`, recipeError.message);
            return;
        }

        // 2. Aggregate deductions
        const deductionsMap = new Map<string, number>();

        // Type assertion for dynamic query result - use unknown first due to Supabase parser inference
        type RecipeRow = { inventory_item_id: string; quantity_required: number; [key: string]: any };
        const typedRecipes = recipes as unknown as RecipeRow[];

        for (const item of items) {
            const itemRecipes = typedRecipes.filter((r) => r[foreignKey] === item.id);
            for (const recipe of itemRecipes) {
                const currentTotal = deductionsMap.get(recipe.inventory_item_id) || 0;
                deductionsMap.set(recipe.inventory_item_id, currentTotal + (recipe.quantity_required * item.quantity));
            }
        }

        // 3. Convert to array and deduct
        const deductions: IngredientDeduction[] = Array.from(deductionsMap.entries()).map(([id, qty]) => ({
            inventory_item_id: id,
            quantity: qty
        }));

        await this.deductIngredients(referenceId, referenceType, deductions, supabase);
    }
}

export const inventoryService = new InventoryService();
