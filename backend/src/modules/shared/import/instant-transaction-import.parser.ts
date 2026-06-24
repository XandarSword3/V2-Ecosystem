/**
 * Instant Transaction Import Parser
 * Engine: instant_transaction
 * 
 * Handles parsing of catalog items from JSON, CSV, or LLM text input.
 * Used by all instant_transaction type modules (menu service, kiosk, retail, etc.)
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
    const rawItems = await callLlmParser(LLM_SYSTEM_PROMPTS.instant_transaction, text);
    
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

// ─── Header normalisation ────────────────────────────────────────────────────
// Maps every reasonable variation a human might write to the canonical field
// name the parser/validator expects.  Keys are lower-cased + spaces-stripped.
const HEADER_ALIASES: Record<string, string> = {
  // name
  'name':            'name',
  'itemname':        'name',
  'item name':       'name',
  'item_name':       'name',
  'menuitem':        'name',
  'menu item':       'name',
  'product':         'name',
  'product name':    'name',
  'productname':     'name',
  'title':           'name',
  // price
  'price':           'price',
  'unitprice':       'price',
  'unit price':      'price',
  'cost':            'price',
  'amount':          'price',
  // category
  'category':        'category',
  'cat':             'category',
  'section':         'category',
  'group':           'category',
  'type':            'category',
  // description
  'description':     'description',
  'desc':            'description',
  'details':         'description',
  'notes':           'description',
  'info':            'description',
  // is_available
  'is_available':    'is_available',
  'isavailable':     'is_available',
  'available':       'is_available',
  'active':          'is_available',
  'enabled':         'is_available',
  'visibility':      'is_available',
  'visible':         'is_available',
  'status':          'is_available',
  // discount_price
  'discount_price':  'discount_price',
  'discountprice':   'discount_price',
  'discount':        'discount_price',
  'sale price':      'discount_price',
  'saleprice':       'discount_price',
  // preparation_time
  'preparation_time':'preparation_time',
  'preparationtime': 'preparation_time',
  'prep time':       'preparation_time',
  'preptime':        'preparation_time',
  'prep':            'preparation_time',
  // calories
  'calories':        'calories',
  'cal':             'calories',
  'kcal':            'calories',
  'energy':          'calories',
  // allergens / dietary tags
  'allergens':       'allergens',
  'allergen':        'allergens',
  'dietary tags':    'allergens',
  'dietarytags':     'allergens',
  'dietary':         'allergens',
  'diet':            'allergens',
  'tags':            'allergens',
};

function normaliseHeader(raw: string): string {
  const key = raw.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? key; // fall back to the trimmed original
}

// ─── Truthy value normalisation ───────────────────────────────────────────────
const TRUTHY = new Set(['true', '1', 'yes', 'y', 'on', 'active', 'available', 'visible']);

/**
 * Parse CSV buffer into menu items.
 *
 * Accepts flexible column names (see HEADER_ALIASES above).
 * Rows with quoted fields (RFC 4180) are handled correctly.
 */
export async function parseCsvImport(buffer: Buffer): Promise<MenuImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Normalise line endings (Windows CRLF → LF)
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawLines = text.split('\n');

    // RFC-4180 field splitter — handles quoted fields containing commas
    const splitCsvLine = (line: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (ch === '"') {
          if (inQuotes && line[ci + 1] === '"') { current += '"'; ci++; } // escaped quote
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      fields.push(current.trim());
      return fields;
    };

    const nonEmptyLines = rawLines.filter(l => l.trim());

    if (nonEmptyLines.length < 2) {
      return {
        items: [],
        warnings,
        errors: ['CSV must have at least a header row and one data row'],
        totalParsed: 0,
        successful: 0,
      };
    }

    // Normalise headers
    const rawHeaders = splitCsvLine(nonEmptyLines[0]);
    const headers = rawHeaders.map(normaliseHeader);

    // Warn about any header that wasn't recognised and will be ignored
    rawHeaders.forEach((raw, idx) => {
      if (headers[idx] === raw.trim().toLowerCase() && !(
        ['name','price','category','description','is_available',
         'discount_price','preparation_time','calories','allergens']
          .includes(headers[idx])
      )) {
        warnings.push(`Unrecognised column "${raw}" — it will be ignored`);
      }
    });

    const numericFields = new Set(['price', 'discount_price', 'preparation_time', 'calories']);
    const items: ParsedMenuItem[] = [];

    for (let i = 1; i < nonEmptyLines.length; i++) {
      try {
        const values = splitCsvLine(nonEmptyLines[i]);
        const obj: Record<string, unknown> = {};

        headers.forEach((h, idx) => {
          const raw = values[idx] ?? '';
          if (numericFields.has(h)) {
            const n = parseFloat(raw);
            if (!isNaN(n)) obj[h] = n;
          } else if (h === 'is_available') {
            obj[h] = TRUTHY.has(raw.toLowerCase());
          } else if (h === 'allergens') {
            // Accept semicolon-separated OR comma-would-be-fine-if-unquoted values
            obj[h] = raw.split(/[;|]/).map(s => s.trim()).filter(Boolean);
          } else {
            obj[h] = raw;
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
      totalParsed: nonEmptyLines.length - 1,
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
