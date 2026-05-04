/**
 * Housekeeping Import Controller
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/housekeeping-import.parser.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { ImportedHousekeepingTemplate, HousekeepingCommitImportRequest } from '../types/housekeeping-import.types.js';

/**
 * Parse housekeeping template import data
 */
export const parseImport = asyncHandler(async (req: Request, res: Response) => {
  let result: { items: unknown[]; warnings: string[]; errors: string[]; totalParsed: number; successful: number } | null = null;

  try {
    if (req.file) {
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;

      if (mimeType === 'application/json' || req.file.originalname.endsWith('.json')) {
        result = parser.parseJsonImport(JSON.parse(buffer.toString()));
      } else {
        return res.status(400).json({ success: false, errors: ['Unsupported file type. Use JSON.'] });
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
    logger.error('Housekeeping Import Parse Error:', err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Helper to find or create inventory item by name for supplies
 */
async function findOrCreateInventoryItem(
  supabase: ReturnType<typeof getSupabase>,
  name: string,
  unit: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('inventory_items')
    .select('id')
    .ilike('name', name)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (existing) {
    return existing.id;
  }

  // Note: Schema doesn't have a housekeeping-specific supplies table
  // Using inventory_items for now - could be extended later
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

  if (error || !newItem) {
    logger.error(`Failed to create inventory item ${name}:`, error);
    return null;
  }

  return newItem.id;
}

/**
 * Commit housekeeping templates to database
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as HousekeepingCommitImportRequest;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Missing required items array' });
  }

  const supabase = getSupabase();

  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
    inventoryCreated: 0,
    inventoryWarnings: [] as string[],
  };

  const importPromises = items.map(async (item: ImportedHousekeepingTemplate) => {
    // Schema review: housekeeping_task_types table has name, description, checklist (jsonb)
    // But doesn't have category, priority, estimated_minutes, or supplies linkage
    // We'll use what's available and document the limitations

    const { data: template, error: templateError } = await supabase
      .from('housekeeping_task_types')
      .insert({
        name: item.title,
        description: item.description || null,
        checklist: item.checklist || [],
        is_active: true,
        // Note: category, priority, estimatedMinutes, and assignableRoles
        // are not available in the current schema - these would need schema additions
      })
      .select()
      .single();

    if (templateError || !template) {
      throw new Error(templateError?.message || 'Failed to create template');
    }

    // Handle required supplies if present
    // Schema note: There's no direct link between task_types and inventory
    // The inventory_consumption table links to tasks, not task_types
    // This would require schema extension for template-level supply requirements
    if (item.requiredSupplies && item.requiredSupplies.length > 0) {
      for (const supply of item.requiredSupplies) {
        const inventoryId = await findOrCreateInventoryItem(supabase, supply.name, supply.unit);
        if (inventoryId) {
          results.inventoryCreated++;
        } else {
          results.inventoryWarnings.push(`Could not link supply: ${supply.name}`);
        }
      }
    }

    return template;
  });

  const settleResults = await Promise.allSettled(importPromises);

  settleResults.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      results.created++;
    } else {
      results.failed++;
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
      results.errors.push(`${items[idx]?.title || `Template ${idx + 1}`}: ${reason}`);
    }
  });

  res.json({ success: true, data: results });
});
