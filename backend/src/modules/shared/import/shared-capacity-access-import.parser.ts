/**
 * Shared Capacity Access Import Parser
 * Engine: shared_capacity_access
 * 
 * Handles parsing of capacity window configurations from JSON or LLM text input.
 * Used by all shared_capacity_access type modules (pool, spa, fitness, etc.)
 */

import { callLlmParser, LLM_SYSTEM_PROMPTS } from './llm-parser.utils.js';
import { logger } from '../../../utils/logger.js';

// Input types
interface ParsedSession {
  name: string;
  startTime: string;
  endTime: string;
  adultPrice: number;
  childPrice?: number;
  capacity: number;
  genderRestriction?: 'mixed' | 'male' | 'female';
  daysOfWeek?: number[];
  isActive?: boolean;
  memberDiscount?: number;
  description?: string;
}

// Output type
export interface SessionImportResult {
  items: ParsedSession[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

/**
 * Parse session items from LLM text input
 */
export async function parseLlmImport(text: string): Promise<SessionImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const rawItems = await callLlmParser(LLM_SYSTEM_PROMPTS.shared_capacity_access, text);
    
    const items: ParsedSession[] = [];
    let successful = 0;

    for (const raw of rawItems) {
      try {
        const item = validateAndTransformSession(raw);
        if (item) {
          items.push(item);
          successful++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Invalid session: ${msg}`);
      }
    }

    return {
      items,
      warnings,
      errors,
      totalParsed: rawItems.length,
      successful,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Session LLM parse error:', err);
    return {
      items: [],
      warnings,
      errors: [...errors, `LLM parsing failed: ${msg}`],
      totalParsed: 0,
      successful: 0,
    };
  }
}

/**
 * Parse session items from JSON input
 */
export function parseJsonImport(raw: unknown): SessionImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const items: ParsedSession[] = [];
  let successful = 0;

  try {
    const arr = Array.isArray(raw) ? raw : [raw];

    for (const rawItem of arr) {
      try {
        const item = validateAndTransformSession(rawItem);
        if (item) {
          items.push(item);
          successful++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Invalid session: ${msg}`);
      }
    }

    return {
      items,
      warnings,
      errors,
      totalParsed: arr.length,
      successful,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      items: [],
      warnings,
      errors: [...errors, `JSON parse error: ${msg}`],
      totalParsed: 0,
      successful: 0,
    };
  }
}

/**
 * Validate and transform a raw item into a ParsedSession
 */
function validateAndTransformSession(raw: unknown): ParsedSession | null {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Session must be an object');
  }

  const r = raw as Record<string, unknown>;

  // Required fields
  const name = r.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('name is required and must be a string');
  }

  const startTime = r.startTime || r.start_time;
  if (typeof startTime !== 'string' || !/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error('startTime is required and must be in HH:MM format (24hr)');
  }

  const endTime = r.endTime || r.end_time;
  if (typeof endTime !== 'string' || !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new Error('endTime is required and must be in HH:MM format (24hr)');
  }

  const adultPrice = typeof r.adultPrice === 'number' 
    ? r.adultPrice 
    : typeof r.adult_price === 'number'
    ? r.adult_price
    : parseFloat(r.adultPrice as string || r.adult_price as string);
  if (isNaN(adultPrice) || adultPrice < 0) {
    throw new Error('adultPrice is required and must be a non-negative number');
  }

  const capacity = typeof r.capacity === 'number' 
    ? r.capacity 
    : parseInt(r.capacity as string);
  if (isNaN(capacity) || capacity < 1) {
    throw new Error('capacity is required and must be a positive integer');
  }

  // Optional fields
  const childPrice = typeof r.childPrice === 'number' 
    ? r.childPrice 
    : typeof r.child_price === 'number'
    ? r.child_price
    : r.childPrice !== undefined 
    ? parseFloat(r.childPrice as string || r.child_price as string)
    : undefined;

  const genderRestriction = r.genderRestriction || r.gender_restriction;
  const validGenderRestrictions = ['mixed', 'male', 'female'];
  const normalizedGender = typeof genderRestriction === 'string' 
    && validGenderRestrictions.includes(genderRestriction)
    ? (genderRestriction as 'mixed' | 'male' | 'female')
    : 'mixed';

  const daysOfWeek = Array.isArray(r.daysOfWeek) 
    ? r.daysOfWeek 
    : Array.isArray(r.days_of_week)
    ? r.days_of_week
    : undefined;

  const item: ParsedSession = {
    name: name.trim(),
    startTime,
    endTime,
    adultPrice,
    childPrice: childPrice !== undefined && !isNaN(childPrice) ? childPrice : undefined,
    capacity,
    genderRestriction: normalizedGender,
    daysOfWeek: daysOfWeek?.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6),
    isActive: r.isActive !== false && r.is_active !== false,
    memberDiscount: typeof r.memberDiscount === 'number' 
      ? r.memberDiscount 
      : typeof r.member_discount === 'number'
      ? r.member_discount
      : undefined,
    description: typeof r.description === 'string' ? r.description : undefined,
  };

  return item;
}
