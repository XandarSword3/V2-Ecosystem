/**
 * Coupons Import Controller
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as parser from '../services/coupon-import.parser.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { ImportedCoupon, CouponCommitImportRequest } from '../types/coupon-import.types.js';

/**
 * Parse coupon import data
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
    logger.error('Coupon Import Parse Error:', err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * Generate unique code by appending suffixes if needed
 */
async function generateUniqueCode(
  supabase: ReturnType<typeof getSupabase>,
  baseCode: string
): Promise<string> {
  let code = baseCode.toUpperCase();
  let suffix = 2;

  for (let attempts = 0; attempts < 100; attempts++) {
    const { data } = await supabase
      .from('coupons')
      .select('code')
      .eq('code', code)
      .single();

    if (!data) {
      return code;
    }

    code = `${baseCode}-${suffix}`;
    suffix++;
  }

  throw new Error('Could not generate unique code after 100 attempts');
}

/**
 * Commit coupons to database
 */
export const commitImport = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as CouponCommitImportRequest;

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

  const importPromises = items.map(async (item: ImportedCoupon) => {
    // Generate unique code if needed
    let finalCode = item.code;
    if (!finalCode) {
      finalCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // Check for code uniqueness and generate alternative if needed
    const { data: existing } = await supabase
      .from('coupons')
      .select('code')
      .eq('code', finalCode.toUpperCase())
      .single();

    if (existing) {
      try {
        finalCode = await generateUniqueCode(supabase, item.code || 'COUPON');
        results.warnings.push(`${item.name}: code changed to ${finalCode} to avoid conflict`);
      } catch {
        throw new Error('Could not generate unique coupon code');
      }
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: finalCode.toUpperCase(),
        name: item.name,
        description: item.description || null,
        discount_type: item.discountType,
        discount_value: item.discountValue,
        min_order_amount: item.minOrderAmount || null,
        max_discount_amount: item.maxDiscountAmount || null,
        usage_limit: item.usageLimit || null,
        per_user_limit: item.perUserLimit || null,
        expires_at: item.expiresAt || null,
        applies_to: item.appliesTo || 'all',
        is_active: true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create coupon');
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
      results.errors.push(`${items[idx]?.name || `Coupon ${idx + 1}`}: ${reason}`);
    }
  });

  res.json({ success: true, data: results });
});
