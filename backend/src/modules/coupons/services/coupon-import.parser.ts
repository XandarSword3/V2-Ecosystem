/**
 * Coupons Import Parser
 */

import { ImportedCoupon, CouponImportResult, DiscountType, AppliesTo } from '../types/coupon-import.types.js';
import { logger } from '../../../utils/logger.js';
import { callLlmParser, LLM_SYSTEM_PROMPTS } from '../../shared/import/llm-parser.utils.js';

const VALID_DISCOUNT_TYPES: DiscountType[] = ['percentage', 'fixed'];
const VALID_APPLIES_TO: AppliesTo[] = ['all', 'restaurant', 'pool', 'chalets', 'snack', 'giftcards'];

function normalizeDiscountType(type: string): DiscountType {
  const normalized = type.toLowerCase().trim();
  if (VALID_DISCOUNT_TYPES.includes(normalized as DiscountType)) {
    return normalized as DiscountType;
  }
  if (['percent', '%', 'pct'].includes(normalized)) return 'percentage';
  if (['amount', '$', 'flat'].includes(normalized)) return 'fixed';
  return 'percentage'; // Default
}

function normalizeAppliesTo(applies: string): AppliesTo {
  const normalized = applies.toLowerCase().trim();
  if (VALID_APPLIES_TO.includes(normalized as AppliesTo)) {
    return normalized as AppliesTo;
  }
  return 'all'; // Default
}

function generateCode(): string {
  // Generate a random 8-character code
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function validateAndMapItem(raw: Record<string, unknown>): ImportedCoupon {
  const warnings: string[] = [];

  const name = raw.name || raw.Name;
  const discountType = normalizeDiscountType(String(raw.discountType || raw.discount_type || 'percentage'));
  const discountValue = parseFloat(String(raw.discountValue || raw.discount_value || 0));
  const minOrderAmount = raw.minOrderAmount || raw.min_order_amount
    ? parseFloat(String(raw.minOrderAmount || raw.min_order_amount))
    : undefined;
  const maxDiscountAmount = raw.maxDiscountAmount || raw.max_discount_amount
    ? parseFloat(String(raw.maxDiscountAmount || raw.max_discount_amount))
    : undefined;

  if (!name) throw new Error('Missing required field: name');
  if (isNaN(discountValue) || discountValue <= 0) {
    throw new Error('Missing or invalid discountValue');
  }

  // Parse code or generate one
  let code = raw.code || raw.Code ? String(raw.code || raw.Code) : undefined;
  if (!code) {
    code = generateCode();
    warnings.push('Code auto-generated');
  }

  // Parse expiry date
  let expiresAt: string | undefined;
  if (raw.expiresAt || raw.expires_at || raw.expiry || raw.valid_until) {
    const dateVal = raw.expiresAt || raw.expires_at || raw.expiry || raw.valid_until;
    const parsed = new Date(String(dateVal));
    if (!isNaN(parsed.getTime())) {
      expiresAt = parsed.toISOString();
    } else {
      warnings.push(`Invalid expiry date: ${dateVal}`);
    }
  }

  // Parse usage limits
  let usageLimit: number | undefined;
  let perUserLimit: number | undefined;
  if (raw.usageLimit || raw.usage_limit) {
    usageLimit = parseInt(String(raw.usageLimit || raw.usage_limit));
    if (isNaN(usageLimit)) usageLimit = undefined;
  }
  if (raw.perUserLimit || raw.per_user_limit) {
    perUserLimit = parseInt(String(raw.perUserLimit || raw.per_user_limit));
    if (isNaN(perUserLimit)) perUserLimit = undefined;
  }

  return {
    code,
    name: String(name).trim(),
    description: raw.description || raw.Description ? String(raw.description || raw.Description) : undefined,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscountAmount,
    usageLimit,
    perUserLimit,
    expiresAt,
    appliesTo: normalizeAppliesTo(String(raw.appliesTo || raw.applies_to || 'all')),
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings,
  };
}

export function parseJsonImport(rawData: unknown): CouponImportResult {
  if (!rawData || typeof rawData !== 'object') {
    return { items: [], warnings: [], errors: ['Invalid JSON: Expected an object or array'], totalParsed: 0, successful: 0 };
  }

  const items: ImportedCoupon[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let dataArray: Record<string, unknown>[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).coupons && Array.isArray((rawData as Record<string, unknown>).coupons)) {
    dataArray = (rawData as Record<string, unknown>).coupons as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).items && Array.isArray((rawData as Record<string, unknown>).items)) {
    dataArray = (rawData as Record<string, unknown>).items as Record<string, unknown>[];
  }

  if (dataArray.length === 0) {
    return { items: [], warnings: [], errors: ['Invalid JSON format: could not find coupons array'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item, index) => {
    try {
      const parsedItem = validateAndMapItem(item);
      if (parsedItem._parseWarnings?.length) {
        warnings.push(`Coupon ${index + 1} (${item.name || item.code || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
      }
      items.push(parsedItem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Coupon ${index + 1}: ${msg}`);
    }
  });

  return {
    items,
    warnings,
    errors,
    totalParsed: dataArray.length,
    successful: items.length,
  };
}

export async function parseLlmImport(userInput: string): Promise<CouponImportResult> {
  try {
    const rawJson = await callLlmParser(LLM_SYSTEM_PROMPTS.coupons, userInput);
    return parseJsonImport(rawJson);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Coupon LLM Parsing Error:', message);
    return {
      items: [],
      warnings: [],
      errors: [`LLM parsing failed: ${message}. Please try JSON import instead.`],
      totalParsed: 0,
      successful: 0,
    };
  }
}
