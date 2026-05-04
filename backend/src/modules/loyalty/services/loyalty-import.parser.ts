/**
 * Loyalty Import Parser
 */

import { ImportedLoyaltyTier, LoyaltyImportResult } from '../types/loyalty-import.types.js';
import { logger } from '../../../utils/logger.js';
import { callLlmParser, LLM_SYSTEM_PROMPTS } from '../../shared/import/llm-parser.utils.js';

function validateAndMapItem(raw: Record<string, unknown>): ImportedLoyaltyTier {
  const warnings: string[] = [];

  const name = raw.name || raw.Name;
  const minPoints = parseInt(String(raw.minPoints || raw.min_points || 0));
  const pointsMultiplier = parseFloat(String(raw.pointsMultiplier || raw.points_multiplier || 1));

  if (!name) throw new Error('Missing required field: name');
  if (isNaN(minPoints)) warnings.push('Invalid minPoints, defaulting to 0');
  if (isNaN(pointsMultiplier)) warnings.push('Invalid pointsMultiplier, defaulting to 1');

  // Parse benefits
  let benefits: string[] | undefined;
  if (Array.isArray(raw.benefits)) {
    benefits = raw.benefits.map((b: unknown) => String(b));
  } else if (raw.benefits) {
    benefits = String(raw.benefits).split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  // Validate color is hex format
  let color = raw.color || raw.Color;
  if (color && !String(color).match(/^#[0-9A-Fa-f]{6}$/)) {
    warnings.push(`Invalid color format "${color}", expected hex like #6B7280`);
    color = undefined;
  }

  return {
    name: String(name).trim(),
    minPoints: isNaN(minPoints) ? 0 : minPoints,
    pointsMultiplier: isNaN(pointsMultiplier) ? 1 : pointsMultiplier,
    color: color ? String(color) : undefined,
    benefits,
    description: raw.description || raw.Description ? String(raw.description || raw.Description) : undefined,
    pointsExpiryDays: raw.pointsExpiryDays || raw.points_expiry_days ? parseInt(String(raw.pointsExpiryDays || raw.points_expiry_days)) : undefined,
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings,
  };
}

export function parseJsonImport(rawData: unknown): LoyaltyImportResult {
  if (!rawData || typeof rawData !== 'object') {
    return { items: [], warnings: [], errors: ['Invalid JSON: Expected an object or array'], totalParsed: 0, successful: 0 };
  }

  const items: ImportedLoyaltyTier[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let dataArray: Record<string, unknown>[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).tiers && Array.isArray((rawData as Record<string, unknown>).tiers)) {
    dataArray = (rawData as Record<string, unknown>).tiers as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).items && Array.isArray((rawData as Record<string, unknown>).items)) {
    dataArray = (rawData as Record<string, unknown>).items as Record<string, unknown>[];
  }

  if (dataArray.length === 0) {
    return { items: [], warnings: [], errors: ['Invalid JSON format: could not find tiers array'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item, index) => {
    try {
      const parsedItem = validateAndMapItem(item);
      if (parsedItem._parseWarnings?.length) {
        warnings.push(`Tier ${index + 1} (${item.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
      }
      items.push(parsedItem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Tier ${index + 1}: ${msg}`);
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

export async function parseLlmImport(userInput: string): Promise<LoyaltyImportResult> {
  try {
    const rawJson = await callLlmParser(LLM_SYSTEM_PROMPTS.loyaltyTiers, userInput);
    return parseJsonImport(rawJson);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Loyalty LLM Parsing Error:', message);
    return {
      items: [],
      warnings: [],
      errors: [`LLM parsing failed: ${message}. Please try JSON import instead.`],
      totalParsed: 0,
      successful: 0,
    };
  }
}
