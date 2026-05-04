/**
 * Pool Sessions Import Parser
 */

import { ImportedPoolSession, PoolImportResult, GenderRestriction } from '../types/pool-import.types.js';
import { logger } from '../../../utils/logger.js';
import { callLlmParser, LLM_SYSTEM_PROMPTS } from '../../shared/import/llm-parser.utils.js';

const VALID_GENDER_RESTRICTIONS: GenderRestriction[] = ['mixed', 'male', 'female'];

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function normalizeGenderRestriction(gender: string): GenderRestriction {
  const normalized = gender.toLowerCase().trim();
  if (VALID_GENDER_RESTRICTIONS.includes(normalized as GenderRestriction)) {
    return normalized as GenderRestriction;
  }
  if (['men', 'boys', 'male only'].includes(normalized)) return 'male';
  if (['women', 'girls', 'female only', 'ladies'].includes(normalized)) return 'female';
  return 'mixed';
}

function parseDaysOfWeek(raw: unknown): number[] | undefined {
  if (!raw) return undefined;

  if (Array.isArray(raw)) {
    return raw.map(d => typeof d === 'number' ? d : parseInt(String(d))).filter(d => !isNaN(d) && d >= 0 && d <= 6);
  }

  if (typeof raw === 'string') {
    const days: number[] = [];
    const parts = raw.toLowerCase().split(/[,\s]+/);
    for (const part of parts) {
      const dayNum = DAY_NAMES[part.trim()];
      if (dayNum !== undefined && !days.includes(dayNum)) {
        days.push(dayNum);
      }
    }
    return days.length > 0 ? days : undefined;
  }

  return undefined;
}

function convertTo24Hour(time: string): string {
  // Handle various time formats and convert to HH:MM
  time = time.trim().toLowerCase();

  // Remove spaces around colons
  time = time.replace(/\s*:\s*/g, ':');

  // Handle AM/PM
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

function validateAndMapItem(raw: Record<string, unknown>): ImportedPoolSession {
  const warnings: string[] = [];

  const name = raw.name || raw.Name;
  const startTime = raw.startTime || raw.start_time || raw.start;
  const endTime = raw.endTime || raw.end_time || raw.end;
  const adultPrice = parseFloat(String(raw.adultPrice || raw.adult_price || raw.price || 0));
  const capacity = parseInt(String(raw.capacity || raw.maxCapacity || raw.max_capacity || 0));

  if (!name) throw new Error('Missing required field: name');
  if (!startTime) throw new Error('Missing required field: startTime');
  if (!endTime) throw new Error('Missing required field: endTime');
  if (isNaN(adultPrice) || adultPrice < 0) warnings.push('Invalid adultPrice, defaulting to 0');
  if (isNaN(capacity) || capacity <= 0) warnings.push('Invalid capacity, defaulting to 20');

  // Convert times to HH:MM format
  let normalizedStart: string;
  let normalizedEnd: string;
  try {
    normalizedStart = convertTo24Hour(String(startTime));
    normalizedEnd = convertTo24Hour(String(endTime));
  } catch {
    throw new Error('Invalid time format for startTime or endTime');
  }

  // Validate time range
  if (normalizedStart >= normalizedEnd) {
    warnings.push('End time should be after start time');
  }

  // Parse child price
  let childPrice: number | undefined;
  if (raw.childPrice || raw.child_price) {
    childPrice = parseFloat(String(raw.childPrice || raw.child_price));
    if (isNaN(childPrice)) childPrice = undefined;
  }

  // Parse member discount
  let memberDiscount: number | undefined;
  if (raw.memberDiscount || raw.member_discount) {
    memberDiscount = parseFloat(String(raw.memberDiscount || raw.member_discount));
    if (isNaN(memberDiscount) || memberDiscount < 0 || memberDiscount > 100) {
      warnings.push('Invalid memberDiscount, must be 0-100');
      memberDiscount = undefined;
    }
  }

  return {
    name: String(name).trim(),
    startTime: normalizedStart,
    endTime: normalizedEnd,
    adultPrice: isNaN(adultPrice) ? 0 : adultPrice,
    childPrice,
    capacity: isNaN(capacity) || capacity <= 0 ? 20 : capacity,
    genderRestriction: normalizeGenderRestriction(String(raw.genderRestriction || raw.gender_restriction || 'mixed')),
    daysOfWeek: parseDaysOfWeek(raw.daysOfWeek || raw.days_of_week),
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    memberDiscount,
    description: raw.description || raw.Description ? String(raw.description || raw.Description) : undefined,
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings,
  };
}

export function parseJsonImport(rawData: unknown): PoolImportResult {
  if (!rawData || typeof rawData !== 'object') {
    return { items: [], warnings: [], errors: ['Invalid JSON: Expected an object or array'], totalParsed: 0, successful: 0 };
  }

  const items: ImportedPoolSession[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let dataArray: Record<string, unknown>[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).sessions && Array.isArray((rawData as Record<string, unknown>).sessions)) {
    dataArray = (rawData as Record<string, unknown>).sessions as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).items && Array.isArray((rawData as Record<string, unknown>).items)) {
    dataArray = (rawData as Record<string, unknown>).items as Record<string, unknown>[];
  }

  if (dataArray.length === 0) {
    return { items: [], warnings: [], errors: ['Invalid JSON format: could not find sessions array'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item, index) => {
    try {
      const parsedItem = validateAndMapItem(item);
      if (parsedItem._parseWarnings?.length) {
        warnings.push(`Session ${index + 1} (${item.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
      }
      items.push(parsedItem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Session ${index + 1}: ${msg}`);
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

export async function parseLlmImport(userInput: string): Promise<PoolImportResult> {
  try {
    const rawJson = await callLlmParser(LLM_SYSTEM_PROMPTS.poolSessions, userInput);
    return parseJsonImport(rawJson);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Pool Sessions LLM Parsing Error:', message);
    return {
      items: [],
      warnings: [],
      errors: [`LLM parsing failed: ${message}. Please try JSON import instead.`],
      totalParsed: 0,
      successful: 0,
    };
  }
}
