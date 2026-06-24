/**
 * Time Exclusive Reservation Import Parser
 * Engine: time_exclusive_reservation
 * 
 * Handles parsing of bookable units from JSON or LLM text input.
 * Used by all time_exclusive_reservation type modules (hotel rooms, vacation rentals, courts, etc.)
 */

import { callLlmParser, LLM_SYSTEM_PROMPTS } from './llm-parser.utils.js';
import { logger } from '../../../utils/logger.js';

// Input types
interface ParsedUnit {
  name: string;
  description?: string;
  maxGuests: number;
  bedrooms?: number;
  bathrooms?: number;
  basePrice: number;
  weekendPrice?: number;
  weeklyDiscount?: number;
  amenities?: string[];
  policies?: {
    checkInTime?: string;
    checkOutTime?: string;
    cancellationHours?: number;
    petFriendly?: boolean;
    smokingAllowed?: boolean;
  };
  addOns?: Array<{
    name: string;
    price: number;
    pricingType: 'per_night' | 'one_time' | 'per_person';
    description?: string;
  }>;
  images?: string[];
}

// Output type
export interface UnitImportResult {
  items: ParsedUnit[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

/**
 * Parse unit items from LLM text input
 */
export async function parseLlmImport(text: string): Promise<UnitImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const rawItems = await callLlmParser(LLM_SYSTEM_PROMPTS.time_exclusive_reservation, text);
    
    const items: ParsedUnit[] = [];
    let successful = 0;

    for (const raw of rawItems) {
      try {
        const item = validateAndTransformUnit(raw);
        if (item) {
          items.push(item);
          successful++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Invalid unit: ${msg}`);
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
    logger.error('Unit LLM parse error:', err);
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
 * Parse unit items from JSON input
 */
export function parseJsonImport(raw: unknown): UnitImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const items: ParsedUnit[] = [];
  let successful = 0;

  try {
    const arr = Array.isArray(raw) ? raw : [raw];

    for (const rawItem of arr) {
      try {
        const item = validateAndTransformUnit(rawItem);
        if (item) {
          items.push(item);
          successful++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Invalid unit: ${msg}`);
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
 * Validate and transform a raw item into a ParsedUnit
 */
function validateAndTransformUnit(raw: unknown): ParsedUnit | null {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Unit must be an object');
  }

  const r = raw as Record<string, unknown>;

  // Required fields
  const name = r.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('name is required and must be a string');
  }

  const maxGuests = typeof r.maxGuests === 'number' 
    ? r.maxGuests 
    : typeof r.max_guests === 'number'
    ? r.max_guests
    : parseInt(r.maxGuests as string || r.max_guests as string);
  if (isNaN(maxGuests) || maxGuests < 1) {
    throw new Error('maxGuests is required and must be a positive integer');
  }

  const basePrice = typeof r.basePrice === 'number' 
    ? r.basePrice 
    : typeof r.base_price === 'number'
    ? r.base_price
    : parseFloat(r.basePrice as string || r.base_price as string);
  if (isNaN(basePrice) || basePrice < 0) {
    throw new Error('basePrice is required and must be a non-negative number');
  }

  // Optional fields
  const bedrooms = typeof r.bedrooms === 'number' 
    ? r.bedrooms 
    : r.bedrooms !== undefined 
    ? parseInt(r.bedrooms as string)
    : undefined;

  const bathrooms = typeof r.bathrooms === 'number' 
    ? r.bathrooms 
    : r.bathrooms !== undefined
    ? parseInt(r.bathrooms as string)
    : undefined;

  const weekendPrice = typeof r.weekendPrice === 'number' 
    ? r.weekendPrice 
    : typeof r.weekend_price === 'number'
    ? r.weekend_price
    : r.weekendPrice !== undefined 
    ? parseFloat(r.weekendPrice as string || r.weekend_price as string)
    : undefined;

  const weeklyDiscount = typeof r.weeklyDiscount === 'number' 
    ? r.weeklyDiscount 
    : typeof r.weekly_discount === 'number'
    ? r.weekly_discount
    : r.weeklyDiscount !== undefined
    ? parseFloat(r.weeklyDiscount as string || r.weekly_discount as string)
    : undefined;

  const amenities = Array.isArray(r.amenities) 
    ? r.amenities.filter((a): a is string => typeof a === 'string')
    : undefined;

  // Policies
  const rawPolicies = r.policies || {};
  const policies = typeof rawPolicies === 'object' && rawPolicies !== null
    ? {
        checkInTime: (rawPolicies as Record<string, unknown>).checkInTime 
          || (rawPolicies as Record<string, unknown>).check_in_time,
        checkOutTime: (rawPolicies as Record<string, unknown>).checkOutTime 
          || (rawPolicies as Record<string, unknown>).check_out_time,
        cancellationHours: (rawPolicies as Record<string, unknown>).cancellationHours !== undefined
          ? Number((rawPolicies as Record<string, unknown>).cancellationHours 
            || (rawPolicies as Record<string, unknown>).cancellation_hours)
          : undefined,
        petFriendly: (rawPolicies as Record<string, unknown>).petFriendly 
          ?? (rawPolicies as Record<string, unknown>).pet_friendly,
        smokingAllowed: (rawPolicies as Record<string, unknown>).smokingAllowed 
          ?? (rawPolicies as Record<string, unknown>).smoking_allowed,
      }
    : undefined;

  // AddOns
  const rawAddOns = r.addOns || r.add_ons;
  const addOns = Array.isArray(rawAddOns)
    ? rawAddOns.map((a: unknown) => ({
        name: (a as Record<string, unknown>).name as string || '',
        price: Number((a as Record<string, unknown>).price) || 0,
        pricingType: ((a as Record<string, unknown>).pricingType 
          || (a as Record<string, unknown>).pricing_type 
          || 'per_night') as 'per_night' | 'one_time' | 'per_person',
        description: ((a as Record<string, unknown>).description || undefined) as string | undefined,
      })).filter(a => a.name.trim() !== '')
    : undefined;

  const images = Array.isArray(r.images) 
    ? r.images.filter((i): i is string => typeof i === 'string')
    : undefined;

  const item: ParsedUnit = {
    name: name.trim(),
    description: typeof r.description === 'string' ? r.description : undefined,
    maxGuests,
    basePrice,
    bedrooms: bedrooms !== undefined && !isNaN(bedrooms) ? bedrooms : undefined,
    bathrooms: bathrooms !== undefined && !isNaN(bathrooms) ? bathrooms : undefined,
    weekendPrice: weekendPrice !== undefined && !isNaN(weekendPrice) ? weekendPrice : undefined,
    weeklyDiscount: weeklyDiscount !== undefined && !isNaN(weeklyDiscount) ? weeklyDiscount : undefined,
    amenities,
    policies: policies ? {
      checkInTime: typeof policies.checkInTime === 'string' ? policies.checkInTime : undefined,
      checkOutTime: typeof policies.checkOutTime === 'string' ? policies.checkOutTime : undefined,
      cancellationHours: typeof policies.cancellationHours === 'number' ? policies.cancellationHours : undefined,
      petFriendly: typeof policies.petFriendly === 'boolean' ? policies.petFriendly : undefined,
      smokingAllowed: typeof policies.smokingAllowed === 'boolean' ? policies.smokingAllowed : undefined,
    } : undefined,
    addOns,
    images,
  };

  return item;
}
