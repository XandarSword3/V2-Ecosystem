/**
 * Snack Bar Import Parser
 * JSON, CSV, and LLM parsing for snack items
 */

import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { ImportedSnackItem, SnackImportResult, SnackIngredient, SnackVariant, SnackCategory } from '../types/snack-import.types.js';
import { logger } from '../../../utils/logger.js';
import { callLlmParser, LLM_SYSTEM_PROMPTS } from '../../shared/import/llm-parser.utils.js';

const VALID_CATEGORIES: SnackCategory[] = ['drinks', 'snacks', 'ice_cream', 'sandwiches', 'other'];

function normalizeCategory(cat: string): SnackCategory {
  const normalized = cat.toLowerCase().trim();
  if (VALID_CATEGORIES.includes(normalized as SnackCategory)) {
    return normalized as SnackCategory;
  }
  // Map common terms to categories
  if (['drink', 'beverage', 'beverages', 'juice', 'soda', 'coffee'].includes(normalized)) return 'drinks';
  if (['snack', 'chips', 'nuts'].includes(normalized)) return 'snacks';
  if (['ice cream', 'gelato', 'frozen', 'dessert'].includes(normalized)) return 'ice_cream';
  if (['sandwich', 'burger', 'wrap', 'panini', 'sub'].includes(normalized)) return 'sandwiches';
  return 'other';
}

function validateAndMapItem(raw: Record<string, unknown>): ImportedSnackItem {
  const warnings: string[] = [];

  const name = raw.name || raw.Name;
  const price = parseFloat(String(raw.price || raw.Price || 0));
  const category = normalizeCategory(String(raw.category || raw.Category || 'other'));

  if (!name) throw new Error('Missing required field: name');
  if (isNaN(price)) warnings.push('Invalid price, defaulting to 0');

  // Parse variants if present
  const variants = parseVariants(raw.variants);

  // Parse ingredients if present
  const ingredients = parseIngredients(raw.ingredients);

  return {
    name: String(name).trim(),
    price: isNaN(price) ? 0 : price,
    category,
    description: raw.description || raw.Description ? String(raw.description || raw.Description) : undefined,
    is_available: raw.is_available !== undefined ? Boolean(raw.is_available) : true,
    discount_price: raw.discount_price ? parseFloat(String(raw.discount_price)) : undefined,
    calories: raw.calories ? parseInt(String(raw.calories)) : undefined,
    allergens: Array.isArray(raw.allergens) ? raw.allergens : (raw.allergens ? String(raw.allergens).split(',').map((s: string) => s.trim()) : []),
    variants: variants || undefined,
    ingredients: ingredients || undefined,
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings,
  };
}

function parseVariants(raw: unknown): SnackVariant[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((v: Record<string, unknown>) => ({
    name: String(v.name || v.Name || 'Variant'),
    price: parseFloat(String(v.price || v.Price || 0)) || 0,
  }));
}

function parseIngredients(raw: unknown): SnackIngredient[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((ing: Record<string, unknown>) => ({
    name: String(ing.name || ing.Name || 'Unknown'),
    estimatedQuantity: parseFloat(String(ing.estimatedQuantity || ing.estimated_quantity || ing.quantity || 0)) || 0,
    estimatedUnit: (ing.estimatedUnit || ing.estimated_unit || ing.unit || 'piece') as SnackIngredient['estimatedUnit'],
  }));
}

export function parseJsonImport(rawData: unknown): SnackImportResult {
  if (!rawData || typeof rawData !== 'object') {
    return { items: [], warnings: [], errors: ['Invalid JSON: Expected an object or array'], totalParsed: 0, successful: 0 };
  }

  const items: ImportedSnackItem[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let dataArray: Record<string, unknown>[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).items && Array.isArray((rawData as Record<string, unknown>).items)) {
    dataArray = (rawData as Record<string, unknown>).items as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).snacks && Array.isArray((rawData as Record<string, unknown>).snacks)) {
    dataArray = (rawData as Record<string, unknown>).snacks as Record<string, unknown>[];
  } else if ((rawData as Record<string, unknown>).menu && typeof (rawData as Record<string, unknown>).menu === 'object') {
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
    return { items: [], warnings: [], errors: ['Invalid JSON format: could not find items'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item, index) => {
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
    successful: items.length,
  };
}

export async function parseCsvImport(buffer: Buffer): Promise<SnackImportResult> {
  const items: ImportedSnackItem[] = [];
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
      if (rowNumber === 1) return;

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
      successful: items.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('CSV Parsing Error:', msg);
    return { items: [], warnings: [], errors: [`CSV processing failed: ${msg}`], totalParsed: 0, successful: 0 };
  }
}

export async function parseLlmImport(userInput: string): Promise<SnackImportResult> {
  try {
    const rawJson = await callLlmParser(LLM_SYSTEM_PROMPTS.snackBar, userInput);
    return parseJsonImport(rawJson);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('LLM Parsing Error:', message);
    return {
      items: [],
      warnings: [],
      errors: [`LLM parsing failed: ${message}. Please try JSON or CSV import instead.`],
      totalParsed: 0,
      successful: 0,
    };
  }
}
