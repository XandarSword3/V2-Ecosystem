import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/menu-import.parser.js';
import * as menuService from '../services/menu.service.js';
import { CommitImportRequest, ImportedMenuItem } from '../types/menu-import.types.js';
import { logger } from '../../../utils/logger.js';
import { getSupabase } from '../../../database/connection.js';

/**
 * Handles initial parsing of menu data from various sources
 */
export const parseImport = asyncHandler(async (req: Request, res: Response) => {
  let result;

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
});

/**
 * Commits the approved items to the database
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { moduleId, items, categoryMap } = req.body as CommitImportRequest;
  
  if (!moduleId || !items || !categoryMap) {
    return res.status(400).json({ success: false, error: 'Missing required commit data' });
  }

  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[]
  };

  // 1. Create categories that don't exist yet
  const resolvedCategoryMap: Record<string, string> = {};
  for (const [name, id] of Object.entries(categoryMap)) {
    if (id) {
      resolvedCategoryMap[name] = id;
    } else {
      try {
        const newCat = await menuService.createCategory({ name, moduleId });
        resolvedCategoryMap[name] = newCat.id;
      } catch (err: any) {
        logger.error(`Failed to create category ${name}:`, err);
        results.errors.push(`Category ${name}: ${err.message}`);
      }
    }
  }

  // 2. Create menu items sequentially or in batches
  // Note: Atomic transaction not fully supported across multiple service calls easily here,
  // so we process and track successes/failures.
  const importPromises = items.map(async (item) => {
    const categoryId = resolvedCategoryMap[item.category];
    if (!categoryId) {
      throw new Error(`Category ${item.category} not found or failed to create`);
    }

    return menuService.createMenuItem({
      name: item.name,
      price: item.price,
      description: item.description,
      categoryId,
      moduleId,
      isAvailable: item.is_available,
      discountPrice: item.discount_price,
      preparationTimeMinutes: item.preparation_time,
      calories: item.calories,
      allergens: item.allergens,
      // Modifiers are handled separately or as part of the item in the service
    } as any);
  });

  const settleResults = await Promise.allSettled(importPromises);

  settleResults.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      results.created++;
    } else {
      results.failed++;
      results.errors.push(`${items[idx].name}: ${res.reason.message}`);
    }
  });

  res.json({ success: true, data: results });
});
