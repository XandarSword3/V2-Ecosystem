/**
 * Menu Service Import Parser
 * Engine: menu_service
 * 
 * Handles parsing of menu items from JSON, CSV, or LLM text input.
 * Used by all menu_service type modules (restaurant, snack bar, etc.)
 */

import { callLlmParser, LLM_SYSTEM_PROMPTS } from './llm-parser.utils.js';
import { logger } from '../../../utils/logger.js';

// Input types
interface ParsedMenuItem {
  name: string;
  price: number;
  category: string;
  description?: string;
  is_available?: boolean;
  discount_price?: number;
  preparation_time?: number;
  calories?: number;
  allergens?: string[];
  modifiers?: Array<{
    name: string;
    is_required: boolean;
    options: Array<{
      name: string;
      price: number;
      modifierType: 'add' | 'remove' | 'swap';
    }>;
  }>;
  ingredients?: Array<{
    name: string;
    estimatedQuantity: number;
    estimatedUnit: string;
  }>;
}

// Output type
export interface MenuImportResult {
  items: ParsedMenuItem[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

/**
 * Parse menu items from LLM text input
 */
export async function parseLlmImport(text: string): Promise<MenuImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const rawItems = await callLlmParser(LLM_SYSTEM_PROMPTS.menu_service, text);
    
    const items: ParsedMenuItem[] = [];
    let successful = 0;

    for (const raw of rawItems) {
      try {
        const item = validateAndTransformMenuItem(raw);
        if (item) {
          items.push(item);
          successful++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Invalid item: ${msg}`);
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
    logger.error('Menu LLM parse error:', err);
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
 * Parse menu items from JSON input
 */
export function parseJsonImport(raw: unknown): MenuImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const items: ParsedMenuItem[] = [];
  let successful = 0;

  try {
    const arr = Array.isArray(raw) ? raw : [raw];

    for (const rawItem of arr) {
      try {
        const item = validateAndTransformMenuItem(rawItem);
        if (item) {
          items.push(item);
          successful++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Invalid item: ${msg}`);
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
 * Validate and transform a raw item into a ParsedMenuItem
 */
function validateAndTransformMenuItem(raw: unknown): ParsedMenuItem | null {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Item must be an object');
  }

  const r = raw as Record<string, unknown>;

  // Required fields
  const name = r.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('name is required and must be a string');
  }

  const price = typeof r.price === 'number' ? r.price : parseFloat(r.price as string);
  if (isNaN(price) || price < 0) {
    throw new Error('price is required and must be a non-negative number');
  }

  const category = typeof r.category === 'string' && r.category.trim() 
    ? r.category 
    : 'General';

  const item: ParsedMenuItem = {
    name: name.trim(),
    price,
    category,
    description: typeof r.description === 'string' ? r.description : undefined,
    is_available: r.is_available !== false,
    discount_price: typeof r.discount_price === 'number' ? r.discount_price : undefined,
    preparation_time: typeof r.preparation_time === 'number' ? r.preparation_time : undefined,
    calories: typeof r.calories === 'number' ? r.calories : undefined,
    allergens: Array.isArray(r.allergens) ? r.allergens.filter((a): a is string => typeof a === 'string') : undefined,
    modifiers: Array.isArray(r.modifiers) ? r.modifiers.map((m: unknown) => ({
      name: (m as Record<string, unknown>).name as string || '',
      is_required: Boolean((m as Record<string, unknown>).is_required),
      options: Array.isArray((m as Record<string, unknown>).options) 
        ? ((m as Record<string, unknown>).options as unknown[]).map((o: unknown) => ({
            name: (o as Record<string, unknown>).name as string || '',
            price: Number((o as Record<string, unknown>).price) || 0,
            modifierType: ((o as Record<string, unknown>).modifierType as 'add' | 'remove' | 'swap') || 'add',
          }))
        : [],
    })) : undefined,
    ingredients: Array.isArray(r.ingredients) 
      ? r.ingredients.map((i: unknown) => ({
          name: (i as Record<string, unknown>).name as string || '',
          estimatedQuantity: Number((i as Record<string, unknown>).estimatedQuantity) || 0,
          estimatedUnit: (i as Record<string, unknown>).estimatedUnit as string || 'piece',
        })).filter((i): i is { name: string; estimatedQuantity: number; estimatedUnit: string } => 
          typeof i.name === 'string' && i.name.trim() !== ''
        )
      : undefined,
  };

  return item;
}

/**
 * Parse CSV buffer into menu items
 */
export async function parseCsvImport(buffer: Buffer): Promise<MenuImportResult> {
  // CSV parsing for menu items - simplified implementation
  // In production, use a proper CSV parser library
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return {
        items: [],
        warnings,
        errors: ['CSV must have at least a header row and one data row'],
        totalParsed: 0,
        successful: 0,
      };
    }

    // Simple CSV to JSON conversion
    // Expected headers: name, price, category, description, is_available, etc.
    const headers = lines[0].split(',').map(h => h.trim());
    const items: ParsedMenuItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim());
        const obj: Record<string, unknown> = {};
        
        headers.forEach((h, idx) => {
          if (values[idx] !== undefined) {
            if (h === 'price' || h === 'discount_price' || h === 'preparation_time' || h === 'calories') {
              obj[h] = parseFloat(values[idx]) || 0;
            } else if (h === 'is_available') {
              obj[h] = values[idx].toLowerCase() === 'true';
            } else if (h === 'allergens') {
              obj[h] = values[idx].split(';').filter(Boolean);
            } else {
              obj[h] = values[idx];
            }
          }
        });

        const item = validateAndTransformMenuItem(obj);
        if (item) items.push(item);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      items,
      warnings,
      errors,
      totalParsed: lines.length - 1,
      successful: items.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      items: [],
      warnings,
      errors: [...errors, `CSV parse error: ${msg}`],
      totalParsed: 0,
      successful: 0,
    };
  }
}
