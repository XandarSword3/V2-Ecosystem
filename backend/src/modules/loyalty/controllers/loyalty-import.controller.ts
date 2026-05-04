/**
 * Loyalty Import Controller
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/loyalty-import.parser.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { ImportedLoyaltyTier, LoyaltyCommitImportRequest } from '../types/loyalty-import.types.js';

/**
 * Parse loyalty tier import data
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
    logger.error('Loyalty Import Parse Error:', err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Commit loyalty tiers to database
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as LoyaltyCommitImportRequest;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Missing required items array' });
  }

  const supabase = getSupabase();

  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  // Sort items by minPoints ascending
  const sortedItems = [...items].sort((a, b) => a.minPoints - b.minPoints);

  // Check for conflicts with existing tiers
  const { data: existingTiers } = await supabase
    .from('loyalty_tiers')
    .select('name, min_points')
    .eq('is_active', true);

  const existingMinPoints = new Set((existingTiers || []).map((t: { min_points: number }) => t.min_points));

  for (const item of sortedItems) {
    if (existingMinPoints.has(item.minPoints)) {
      results.warnings.push(`Tier with ${item.minPoints} points threshold already exists`);
    }
  }

  const importPromises = sortedItems.map(async (item: ImportedLoyaltyTier) => {
    const { data, error } = await supabase
      .from('loyalty_tiers')
      .insert({
        name: item.name,
        min_points: item.minPoints,
        points_multiplier: item.pointsMultiplier,
        color: item.color || '#6B7280',
        benefits: item.benefits || [],
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create tier');
    }

    return data;
  });

  const settleResults = await Promise.allSettled(importPromises);

  settleResults.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      results.created++;
    } else {
      results.failed++;
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
      results.errors.push(`${sortedItems[idx]?.name || `Tier ${idx + 1}`}: ${reason}`);
    }
  });

  res.json({ success: true, data: results });
});
