/**
 * Chalets Import Controller
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/chalet-import.parser.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { ImportedChalet, ChaletCommitImportRequest } from '../types/chalet-import.types.js';

/**
 * Parse chalet import data
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
    logger.error('Chalet Import Parse Error:', err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Commit chalets to database
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { items, moduleId: _moduleId } = req.body as ChaletCommitImportRequest;
  // _moduleId is available if schema supports module linkage in future

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Missing required items array' });
  }

  const supabase = getSupabase();

  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
    addOnsCreated: 0,
  };

  const importPromises = items.map(async (item: ImportedChalet) => {
    // Create the chalet
    // Note: Schema doesn't have module_id on chalets table - moduleId is ignored
    const { data: chalet, error: chaletError } = await supabase
      .from('chalets')
      .insert({
        name: item.name,
        description: item.description || null,
        capacity: item.maxGuests,
        bedroom_count: item.bedrooms || null,
        bathroom_count: item.bathrooms || null,
        base_price: String(item.basePrice),
        weekend_price: item.weekendPrice ? String(item.weekendPrice) : null,
        amenities: item.amenities || [],
        images: item.images || [],
        is_active: item.isActive !== undefined ? item.isActive : true,
        // Note: weeklyDiscount is not in chalets table - stored in chalet_price_rules
        // policies fields are not in chalets table schema - would need schema extension
      })
      .select()
      .single();

    if (chaletError || !chalet) {
      throw new Error(chaletError?.message || 'Failed to create chalet');
    }

    // Handle weekly discount via price rules if present
    if (item.weeklyDiscount && chalet.id) {
      await supabase
        .from('chalet_price_rules')
        .insert({
          chalet_id: chalet.id,
          name: 'Weekly Stay Discount',
          min_nights: 7,
          discount_percent: item.weeklyDiscount,
          is_active: true,
        });
    }

    // Handle add-ons if present
    if (item.addOns && item.addOns.length > 0 && chalet.id) {
      const addOnData = item.addOns.map(addon => ({
        chalet_id: chalet.id,
        name: addon.name,
        price: String(addon.price),
        price_type: addon.pricingType,
        description: addon.description || null,
        is_active: true,
      }));

      const { data: addons } = await supabase
        .from('chalet_add_ons')
        .insert(addOnData)
        .select();

      if (addons) {
        results.addOnsCreated += addons.length;
      }
    }

    return chalet;
  });

  const settleResults = await Promise.allSettled(importPromises);

  settleResults.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      results.created++;
    } else {
      results.failed++;
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
      results.errors.push(`${items[idx]?.name || `Chalet ${idx + 1}`}: ${reason}`);
    }
  });

  res.json({ success: true, data: results });
});
