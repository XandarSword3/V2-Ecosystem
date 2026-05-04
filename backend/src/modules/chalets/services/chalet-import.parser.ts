/**
 * Chalets Import Parser
 */

import { ImportedChalet, ChaletImportResult, ChaletAddOn, ChaletPolicy } from '../types/chalet-import.types.js';
import { logger } from '../../../utils/logger.js';
import { callLlmParser, LLM_SYSTEM_PROMPTS } from '../../shared/import/llm-parser.utils.js';

function normalizePricingType(type: string): 'per_night' | 'one_time' | 'per_person' {
  const normalized = type.toLowerCase().trim();
  if (['per_night', 'per night', 'daily', 'nightly'].includes(normalized)) return 'per_night';
  if (['one_time', 'once', 'flat', 'single'].includes(normalized)) return 'one_time';
  if (['per_person', 'per guest', 'per head'].includes(normalized)) return 'per_person';
  return 'per_night'; // Default
}

function convertTo24Hour(time: string): string | undefined {
  if (!time) return undefined;
  time = time.trim().toLowerCase();
  time = time.replace(/\s*:\s*/g, ':');

  const isPM = time.includes('pm') || time.includes('p.m');
  const isAM = time.includes('am') || time.includes('a.m');
  time = time.replace(/(am|pm|a\.m|p\.m)/gi, '');

  const [hours, minutes = '0'] = time.split(':');
  let hourNum = parseInt(hours);
  const minNum = parseInt(minutes) || 0;

  if (isPM && hourNum !== 12) hourNum += 12;
  if (isAM && hourNum === 12) hourNum = 0;

  return `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;
}

function parseAmenities(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((a: unknown) => String(a)).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return undefined;
}

function parseAddOns(raw: unknown): ChaletAddOn[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;

  return raw.map((addon: Record<string, unknown>) => ({
    name: String(addon.name || addon.Name || 'Add-on'),
    price: parseFloat(String(addon.price || addon.Price || 0)) || 0,
    pricingType: normalizePricingType(String(addon.pricingType || addon.pricing_type || addon.type || 'per_night')),
    description: addon.description || addon.Description ? String(addon.description || addon.Description) : undefined,
  }));
}

function parsePolicies(raw: unknown): ChaletPolicy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const policy = raw as Record<string, unknown>;
  const result: ChaletPolicy = {};

  if (policy.checkInTime || policy.check_in_time || policy.checkin) {
    result.checkInTime = convertTo24Hour(String(policy.checkInTime || policy.check_in_time || policy.checkin));
  }
  if (policy.checkOutTime || policy.check_out_time || policy.checkout) {
    result.checkOutTime = convertTo24Hour(String(policy.checkOutTime || policy.check_out_time || policy.checkout));
  }
  if (policy.cancellationHours || policy.cancellation_hours || policy.cancellation) {
    const hours = parseInt(String(policy.cancellationHours || policy.cancellation_hours || policy.cancellation));
    if (!isNaN(hours)) result.cancellationHours = hours;
  }
  if (policy.petFriendly !== undefined || policy.pet_friendly !== undefined) {
    result.petFriendly = Boolean(policy.petFriendly || policy.pet_friendly);
  }
  if (policy.smokingAllowed !== undefined || policy.smoking_allowed !== undefined) {
    result.smokingAllowed = Boolean(policy.smokingAllowed || policy.smoking_allowed);
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseImages(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((img: unknown) => String(img)).filter(Boolean);
  }
  return undefined;
}

function validateAndMapItem(raw: Record<string, unknown>): ImportedChalet {
  const warnings: string[] = [];

  const name = raw.name || raw.Name;
  const maxGuests = parseInt(String(raw.maxGuests || raw.max_guests || raw.capacity || raw.maxCapacity || 0));
  const basePrice = parseFloat(String(raw.basePrice || raw.base_price || raw.price || 0));

  if (!name) throw new Error('Missing required field: name');
  if (isNaN(maxGuests) || maxGuests <= 0) warnings.push('Invalid maxGuests, defaulting to 2');
  if (isNaN(basePrice) || basePrice < 0) warnings.push('Invalid basePrice, defaulting to 0');

  // Parse bedrooms and bathrooms
  let bedrooms: number | undefined;
  let bathrooms: number | undefined;
  if (raw.bedrooms !== undefined) {
    bedrooms = parseInt(String(raw.bedrooms));
    if (isNaN(bedrooms)) bedrooms = undefined;
  }
  if (raw.bathrooms !== undefined) {
    bathrooms = parseFloat(String(raw.bathrooms));
    if (isNaN(bathrooms)) bathrooms = undefined;
  }

  // Parse weekend price and weekly discount
  let weekendPrice: number | undefined;
  let weeklyDiscount: number | undefined;
  if (raw.weekendPrice || raw.weekend_price) {
    weekendPrice = parseFloat(String(raw.weekendPrice || raw.weekend_price));
    if (isNaN(weekendPrice)) weekendPrice = undefined;
  }
  if (raw.weeklyDiscount || raw.weekly_discount) {
    weeklyDiscount = parseFloat(String(raw.weeklyDiscount || raw.weekly_discount));
    if (isNaN(weeklyDiscount) || weeklyDiscount < 0 || weeklyDiscount > 100) {
      warnings.push('Invalid weeklyDiscount, must be 0-100');
      weeklyDiscount = undefined;
    }
  }

  return {
    name: String(name).trim(),
    description: raw.description || raw.Description ? String(raw.description || raw.Description) : undefined,
    maxGuests: isNaN(maxGuests) || maxGuests <= 0 ? 2 : maxGuests,
    bedrooms,
    bathrooms,
    basePrice: isNaN(basePrice) ? 0 : basePrice,
    weekendPrice,
    weeklyDiscount,
    amenities: parseAmenities(raw.amenities || raw.Amenities),
    policies: parsePolicies(raw.policies || raw.Policies),
    addOns: parseAddOns(raw.addOns || raw.add_ons || raw.addons),
    images: parseImages(raw.images || raw.Images || raw.photos || raw.photos),
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings,
  };
}

export function parseJsonImport(rawData: unknown): ChaletImportResult {
  if (!rawData || typeof rawData !== 'object') {
    return { items: [], warnings: [], errors: ['Invalid JSON: Expected an object or array'], totalParsed: 0, successful: 0 };
  }

  const items: ImportedChalet[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let dataArray: Record<string, unknown>[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).chalets && Array.isArray((rawData as Record<string, unknown>).chalets)) {
    dataArray = (rawData as Record<string, unknown>).chalets as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).items && Array.isArray((rawData as Record<string, unknown>).items)) {
    dataArray = (rawData as Record<string, unknown>).items as Record<string, unknown>[];
  }

  if (dataArray.length === 0) {
    return { items: [], warnings: [], errors: ['Invalid JSON format: could not find chalets array'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item, index) => {
    try {
      const parsedItem = validateAndMapItem(item);
      if (parsedItem._parseWarnings?.length) {
        warnings.push(`Chalet ${index + 1} (${item.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
      }
      items.push(parsedItem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Chalet ${index + 1}: ${msg}`);
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

export async function parseLlmImport(userInput: string): Promise<ChaletImportResult> {
  try {
    const rawJson = await callLlmParser(LLM_SYSTEM_PROMPTS.chalets, userInput);
    return parseJsonImport(rawJson);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Chalets LLM Parsing Error:', message);
    return {
      items: [],
      warnings: [],
      errors: [`LLM parsing failed: ${message}. Please try JSON import instead.`],
      totalParsed: 0,
      successful: 0,
    };
  }
}
