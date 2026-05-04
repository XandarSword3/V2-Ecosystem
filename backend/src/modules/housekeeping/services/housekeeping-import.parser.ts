/**
 * Housekeeping Import Parser
 */

import { ImportedHousekeepingTemplate, HousekeepingImportResult, TaskCategory, TaskPriority, RequiredSupply } from '../types/housekeeping-import.types.js';
import { logger } from '../../../utils/logger.js';
import { callLlmParser, LLM_SYSTEM_PROMPTS } from '../../shared/import/llm-parser.utils.js';

const VALID_CATEGORIES: TaskCategory[] = ['room', 'common_area', 'pool', 'kitchen', 'other'];
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

function normalizeCategory(cat: string): TaskCategory {
  const normalized = cat.toLowerCase().trim();
  if (VALID_CATEGORIES.includes(normalized as TaskCategory)) {
    return normalized as TaskCategory;
  }
  if (['room cleaning', 'room service', 'turnover'].includes(normalized)) return 'room';
  if (['common', 'lobby', 'hallway', 'corridor'].includes(normalized)) return 'common_area';
  if (['pool cleaning', 'pool maintenance'].includes(normalized)) return 'pool';
  if (['kitchen cleaning', 'dishwashing', 'food prep'].includes(normalized)) return 'kitchen';
  return 'other';
}

function normalizePriority(priority: string): TaskPriority {
  const normalized = priority.toLowerCase().trim();
  if (VALID_PRIORITIES.includes(normalized as TaskPriority)) {
    return normalized as TaskPriority;
  }
  if (['critical', 'emergency', 'asap'].includes(normalized)) return 'urgent';
  if (['normal', 'standard'].includes(normalized)) return 'medium';
  if (['minor', 'when possible'].includes(normalized)) return 'low';
  return 'medium';
}

function parseChecklist(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((item: unknown) => String(item)).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return undefined;
}

function parseRequiredSupplies(raw: unknown): RequiredSupply[] | undefined {
  if (!raw) return undefined;
  if (!Array.isArray(raw)) return undefined;

  return raw.map((sup: Record<string, unknown>) => ({
    name: String(sup.name || sup.Name || 'Unknown'),
    quantity: parseFloat(String(sup.quantity || sup.Quantity || 1)) || 1,
    unit: String(sup.unit || sup.Unit || 'pcs'),
  }));
}

function parseAssignableRoles(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((r: unknown) => String(r));
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return undefined;
}

function validateAndMapItem(raw: Record<string, unknown>): ImportedHousekeepingTemplate {
  const warnings: string[] = [];

  const title = raw.title || raw.Title || raw.name || raw.Name;
  const category = normalizeCategory(String(raw.category || raw.Category || 'other'));

  if (!title) throw new Error('Missing required field: title');

  // Parse estimated minutes
  let estimatedMinutes: number | undefined;
  if (raw.estimatedMinutes || raw.estimated_minutes || raw.duration || raw.time) {
    const val = parseInt(String(raw.estimatedMinutes || raw.estimated_minutes || raw.duration || raw.time));
    if (!isNaN(val) && val > 0) {
      estimatedMinutes = val;
    } else {
      warnings.push('Invalid estimated minutes');
    }
  }

  return {
    title: String(title).trim(),
    description: raw.description || raw.Description ? String(raw.description || raw.Description) : undefined,
    category,
    priority: normalizePriority(String(raw.priority || raw.Priority || 'medium')),
    estimatedMinutes,
    checklist: parseChecklist(raw.checklist || raw.Checklist),
    requiredSupplies: parseRequiredSupplies(raw.requiredSupplies || raw.required_supplies || raw.supplies),
    assignableRoles: parseAssignableRoles(raw.assignableRoles || raw.assignable_roles || raw.roles),
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings,
  };
}

export function parseJsonImport(rawData: unknown): HousekeepingImportResult {
  if (!rawData || typeof rawData !== 'object') {
    return { items: [], warnings: [], errors: ['Invalid JSON: Expected an object or array'], totalParsed: 0, successful: 0 };
  }

  const items: ImportedHousekeepingTemplate[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let dataArray: Record<string, unknown>[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).templates && Array.isArray((rawData as Record<string, unknown>).templates)) {
    dataArray = (rawData as Record<string, unknown>).templates as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).items && Array.isArray((rawData as Record<string, unknown>).items)) {
    dataArray = (rawData as Record<string, unknown>).items as Record<string, unknown>[];
  }

  if (dataArray.length === 0) {
    return { items: [], warnings: [], errors: ['Invalid JSON format: could not find templates array'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item, index) => {
    try {
      const parsedItem = validateAndMapItem(item);
      if (parsedItem._parseWarnings?.length) {
        warnings.push(`Template ${index + 1} (${item.title || item.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
      }
      items.push(parsedItem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Template ${index + 1}: ${msg}`);
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

export async function parseLlmImport(userInput: string): Promise<HousekeepingImportResult> {
  try {
    const rawJson = await callLlmParser(LLM_SYSTEM_PROMPTS.housekeepingTemplates, userInput);
    return parseJsonImport(rawJson);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Housekeeping LLM Parsing Error:', message);
    return {
      items: [],
      warnings: [],
      errors: [`LLM parsing failed: ${message}. Please try JSON import instead.`],
      totalParsed: 0,
      successful: 0,
    };
  }
}
