/**
 * Snack Bar Import Controller
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/snack-import.parser.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { ImportedSnackItem, SnackCommitImportRequest } from '../types/snack-import.types.js';

/**
 * Parse snack import data from file, JSON, or text
 */
export const parseImport = asyncHandler(async (req: Request, res: Response) => {
  let result: { items: unknown[]; warnings: string[]; errors: string[]; totalParsed: number; successful: number } | null = null;

  try {
    if (req.file) {
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;

      if (mimeType === 'application/json' || req.file.originalname.endsWith('.json')) {
        result = parser.parseJsonImport(JSON.parse(buffer.toString()));
      } else if (mimeType === 'text/csv' || req.file.originalname.endsWith('.csv')) {
        result = await parser.parseCsvImport(buffer);
      } else {
        return res.status(400).json({ success: false, errors: ['Unsupported file type. Use JSON or CSV.'] });
      }
    } else if (req.body.text) {
      result = await parser.parseLlmImport(req.body.text);
    } else if (req.body.json) {
      result = parser.parseJsonImport(req.body.json);
    } else {
      return res.status(400).json({ success: false, errors: ['No data provided for parsing.'] });
    }

    if (result.successful === 0 && result.errors.length > 0) {
      return res.status(422).json({ success: false, ...result });
    }

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Snack Import Parse Error:', err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Helper to find or create inventory item by name
 */
async function findOrCreateInventoryItem(
  supabase: ReturnType<typeof getSupabase>,
  name: string,
  unit: string,
  warnings: string[]
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('inventory_items')
    .select('id, name, current_stock')
    .ilike('name', name)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (existing) {
    return existing.id;
  }

  const { data: newItem, error } = await supabase
    .from('inventory_items')
    .insert({
      name,
      unit,
      current_stock: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    logger.error(`Failed to create inventory item ${name}:`, error);
    return null;
  }

  warnings.push(`${name}: created with 0 stock — set opening stock in Inventory`);
  return newItem.id;
}

/**
 * Commit snack items to database
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as SnackCommitImportRequest;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Missing required items array' });
  }

  const supabase = getSupabase();

  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
    inventoryCreated: 0,
    inventoryLinked: 0,
    inventoryWarnings: [] as string[],
  };

  const importPromises = items.map(async (item: ImportedSnackItem) => {
    // Build ingredient map
    const ingredientMap = new Map<string, string>();

    if (item.ingredients && item.ingredients.length > 0) {
      for (const ingredient of item.ingredients) {
        const inventoryId = await findOrCreateInventoryItem(
          supabase,
          ingredient.name,
          ingredient.estimatedUnit,
          results.inventoryWarnings
        );

        if (inventoryId) {
          ingredientMap.set(ingredient.name.toLowerCase(), inventoryId);
          results.inventoryCreated++;
        }
      }
    }

    // Create snack item
    const { data: snackItem, error: itemError } = await supabase
      .from('snack_items')
      .insert({
        name: item.name,
        price: String(item.price),
        category: item.category,
        description: item.description || null,
        is_available: item.is_available !== undefined ? item.is_available : true,
        discount_price: item.discount_price ? String(item.discount_price) : null,
        allergens: item.allergens || [],
      })
      .select()
      .single();

    if (itemError || !snackItem) {
      throw new Error(itemError?.message || 'Failed to create snack item');
    }

    // Note: Snack items table doesn't have a variants column based on schema review
    // Variants would need a separate table (snack_item_variants) which doesn't exist
    // For now, variants are stored as JSON in a separate column if it exists, or skipped
    // Schema check: snack_items has category enum but no variants support

    // Create inventory BOM links for ingredients
    if (item.ingredients && item.ingredients.length > 0 && snackItem.id) {
      // Note: inventory_bom uses menu_item_id which is tied to menu_items table
      // For snack items, we may need a separate BOM table or link mechanism
      // For now, skip BOM linking for snack items since schema expects menu_item_id
      // This is documented as a schema limitation
    }

    return snackItem;
  });

  const settleResults = await Promise.allSettled(importPromises);

  settleResults.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      results.created++;
    } else {
      results.failed++;
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
      results.errors.push(`${items[idx]?.name || `Item ${idx + 1}`}: ${reason}`);
    }
  });

  res.json({ success: true, data: results });
});
