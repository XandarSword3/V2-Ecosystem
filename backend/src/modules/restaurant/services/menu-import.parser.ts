import ExcelJS from 'exceljs';
import { ImportedMenuItem, ImportResult, Ingredient, ModifierOption, ModifierGroup } from '../types/menu-import.types.js';
import { logger } from '../../../utils/logger.js';
import { Readable } from 'stream';
import { callLlmParser, LLM_SYSTEM_PROMPTS } from '../../shared/import/llm-parser.utils.js';

/**
 * Validates and sanitizes a raw JSON import
 */
export function parseJsonImport(rawData: unknown): ImportResult {
  if (!rawData || typeof rawData !== 'object') {
    return { items: [], warnings: [], errors: ['Invalid JSON: Expected an object or array'], totalParsed: 0, successful: 0 };
  }
  const items: ImportedMenuItem[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  let dataArray: Record<string, unknown>[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).items && Array.isArray((rawData as Record<string, unknown>).items)) {
    dataArray = (rawData as Record<string, unknown>).items as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).menu && typeof (rawData as Record<string, unknown>).menu === 'object') {
    // Handle { menu: { category: [items] } }
    Object.entries((rawData as Record<string, unknown>).menu as Record<string, unknown[]>).forEach(([category, val]) => {
      if (Array.isArray(val)) {
        val.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            dataArray.push({ ...(item as Record<string, unknown>), category });
          }
        });
      }
    });
  } else {
    // Handle { category: [items] }
    Object.entries(rawData as Record<string, unknown[]>).forEach(([category, val]) => {
      if (Array.isArray(val)) {
        val.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            dataArray.push({ ...(item as Record<string, unknown>), category });
          }
        });
      }
    });
  }

  if (dataArray.length === 0) {
    return { items: [], warnings: [], errors: ['Invalid JSON format: could not find an array of items or category-keyed objects'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item: Record<string, unknown>, index: number) => {
    try {
      const parsedItem = validateAndMapItem(item);
      if (parsedItem._parseWarnings?.length) {
        warnings.push(`Item ${index + 1} (${item.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
      }
      items.push(parsedItem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Item ${index + 1}: ${msg}`);
    }
  });

  return {
    items,
    warnings,
    errors,
    totalParsed: dataArray.length,
    successful: items.length
  };
}

/**
 * Parses CSV data using ExcelJS
 */
export async function parseCsvImport(buffer: Buffer): Promise<ImportResult> {
  const items: ImportedMenuItem[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.csv.read(new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      }
    }));
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('Could not find worksheet');

    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value).toLowerCase().trim();
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip headers

      const itemData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) itemData[header] = cell.value as unknown;
      });

      try {
        const parsedItem = validateAndMapItem(itemData);
        if (parsedItem._parseWarnings?.length) {
          warnings.push(`Row ${rowNumber} (${itemData.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
        }
        items.push(parsedItem);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${rowNumber}: ${msg}`);
      }
    });

    return {
      items,
      warnings,
      errors,
      totalParsed: worksheet.rowCount - 1,
      successful: items.length
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('CSV Parsing Error:', msg);
    return { items: [], warnings: [], errors: [`CSV processing failed: ${msg}`], totalParsed: 0, successful: 0 };
  }
}

/**
 * AI Parser using Anthropic Claude 3.5 Sonnet (via shared utility)
 */
export async function parseLlmImport(userInput: string): Promise<ImportResult> {
  try {
    const rawJson = await callLlmParser(LLM_SYSTEM_PROMPTS.restaurant, userInput);
    return parseJsonImport(rawJson);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('LLM Parsing Error:', message);
    return {
      items: [],
      warnings: [],
      errors: [`LLM parsing failed: ${message}. Please try JSON or CSV import instead.`],
      totalParsed: 0,
      successful: 0
    };
  }
}

/**
 * Maps raw object to ImportedMenuItem and performs basic validation
 */
function validateAndMapItem(raw: Record<string, unknown>): ImportedMenuItem {
  const warnings: string[] = [];

  // Standardize keys (handles camelCase or snake_case)
  const name = raw.name || raw.Name;
  const price = parseFloat(String(raw.price || raw.Price || 0));
  const category = raw.category || raw.Category || 'General';

  if (!name) throw new Error('Missing required field: name');
  if (isNaN(price)) warnings.push('Invalid price, defaulting to 0');

  // Parse ingredients if present
  const ingredients = parseIngredients(raw.ingredients);

  // Build description from ingredients if raw ingredients array provided
  let description = raw.description || raw.Description;
  if (!description && Array.isArray(raw.ingredients) && raw.ingredients.length > 0 && !ingredients) {
    description = (raw.ingredients as string[]).join(', ');
  }

  return {
    name: String(name).trim(),
    price: isNaN(price) ? 0 : price,
    category: String(category).trim(),
    description: description as string | undefined,
    is_available: raw.is_available !== undefined ? Boolean(raw.is_available) : true,
    discount_price: raw.discount_price ? parseFloat(String(raw.discount_price)) : undefined,
    preparation_time: raw.preparation_time ? parseInt(String(raw.preparation_time)) : undefined,
    calories: raw.calories ? parseInt(String(raw.calories)) : undefined,
    allergens: Array.isArray(raw.allergens) ? raw.allergens : (raw.allergens ? String(raw.allergens).split(',').map((s: string) => s.trim()) : []),
    modifiers: parseModifiers(raw.modifiers),
    ingredients: ingredients || undefined,
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings
  };
}

function parseIngredients(raw: unknown): Ingredient[] | null {
  if (!Array.isArray(raw)) return null;

  return raw.map((ing: Record<string, unknown>) => ({
    name: String(ing.name || ing.Name || 'Unknown'),
    estimatedQuantity: parseFloat(String(ing.estimatedQuantity || ing.estimated_quantity || ing.quantity || 0)) || 0,
    estimatedUnit: (ing.estimatedUnit || ing.estimated_unit || ing.unit || 'piece') as Ingredient['estimatedUnit'],
    inventoryItemName: ing.inventoryItemName ? String(ing.inventoryItemName) : undefined,
  }));
}

function parseModifiers(raw: unknown): ModifierGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw.map((group: Record<string, unknown>) => ({
    name: String(group.name || 'Options'),
    is_required: Boolean(group.is_required),
    options: Array.isArray(group.options) ? group.options.map((opt: Record<string, unknown>): ModifierOption => ({
      name: String(opt.name),
      price: parseFloat(String(opt.price || 0)),
      modifierType: (opt.modifierType as ModifierOption['modifierType']) || 'add',
      inventoryItemName: opt.inventoryItemName ? String(opt.inventoryItemName) : undefined,
    })) : []
  }));
}
