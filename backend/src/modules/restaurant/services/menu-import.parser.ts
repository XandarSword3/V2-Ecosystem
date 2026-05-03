import ExcelJS from 'exceljs';
import { ImportedMenuItem, ImportResult } from '../types/menu-import.types.js';
import { logger } from '../../../utils/logger.js';
import axios from 'axios';

/**
 * Validates and sanitizes a raw JSON import
 */
export function parseJsonImport(rawData: any): ImportResult {
  const items: ImportedMenuItem[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const dataArray = Array.isArray(rawData) ? rawData : (rawData.items || []);

  if (!Array.isArray(dataArray)) {
    return { items: [], warnings: [], errors: ['Invalid JSON format: expected an array of items'], totalParsed: 0, successful: 0 };
  }

  dataArray.forEach((item: any, index: number) => {
    try {
      const parsedItem = validateAndMapItem(item);
      if (parsedItem._parseWarnings?.length) {
        warnings.push(`Item ${index + 1} (${item.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
      }
      items.push(parsedItem);
    } catch (err: any) {
      errors.push(`Item ${index + 1}: ${err.message}`);
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
    await workbook.csv.read(new (require('stream').Readable)({
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

      const itemData: any = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) itemData[header] = cell.value;
      });

      try {
        const parsedItem = validateAndMapItem(itemData);
        if (parsedItem._parseWarnings?.length) {
          warnings.push(`Row ${rowNumber} (${itemData.name || 'Unnamed'}): ${parsedItem._parseWarnings.join(', ')}`);
        }
        items.push(parsedItem);
      } catch (err: any) {
        errors.push(`Row ${rowNumber}: ${err.message}`);
      }
    });

    return {
      items,
      warnings,
      errors,
      totalParsed: worksheet.rowCount - 1,
      successful: items.length
    };
  } catch (err: any) {
    logger.error('CSV Parsing Error:', err);
    return { items: [], warnings: [], errors: [`CSV processing failed: ${err.message}`], totalParsed: 0, successful: 0 };
  }
}

/**
 * AI Parser using Anthropic Claude 3.5 Sonnet
 */
export async function parseLlmImport(userInput: string): Promise<ImportResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { items: [], warnings: [], errors: ['AI parsing is disabled: ANTHROPIC_API_KEY is missing'], totalParsed: 0, successful: 0 };
  }

  const systemPrompt = `You are a menu parsing expert. Convert the following unstructured text into a structured JSON array of menu items.
Each item must follow this schema:
{
  "name": string (required),
  "price": number (required),
  "category": string (required, use 'General' if unknown),
  "description": string (optional),
  "is_available": boolean (default true),
  "discount_price": number (optional),
  "preparation_time": number (minutes, optional),
  "calories": number (optional),
  "allergens": string[] (optional),
  "modifiers": [
    {
      "name": string (group name, e.g., 'Size', 'Toppings'),
      "is_required": boolean,
      "options": [{ "name": string, "price": number }]
    }
  ] (optional)
}
Rules:
1. Prices must be numbers. If a range is given, use the lowest price.
2. If multiple sizes are given, create one item with a 'Size' modifier group.
3. Respond ONLY with the JSON array. No preamble or markdown.`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userInput }]
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });

    const content = response.data.content[0].text;
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('LLM output could not be parsed as JSON');
    }

    const rawJson = JSON.parse(content.substring(jsonStart, jsonEnd));
    return parseJsonImport(rawJson);
  } catch (err: any) {
    logger.error('LLM Parsing Error:', err);
    return { 
      items: [], 
      warnings: [], 
      errors: ['LLM output could not be parsed. Please try JSON or CSV import instead.'], 
      totalParsed: 0, 
      successful: 0 
    };
  }
}

/**
 * Maps raw object to ImportedMenuItem and performs basic validation
 */
function validateAndMapItem(raw: any): ImportedMenuItem {
  const warnings: string[] = [];
  
  // Standardize keys (handles camelCase or snake_case)
  const name = raw.name || raw.Name;
  const price = parseFloat(String(raw.price || raw.Price || 0));
  const category = raw.category || raw.Category || 'General';
  
  if (!name) throw new Error('Missing required field: name');
  if (isNaN(price)) warnings.push('Invalid price, defaulting to 0');

  return {
    name: String(name).trim(),
    price: isNaN(price) ? 0 : price,
    category: String(category).trim(),
    description: raw.description || raw.Description,
    is_available: raw.is_available !== undefined ? Boolean(raw.is_available) : true,
    discount_price: raw.discount_price ? parseFloat(String(raw.discount_price)) : undefined,
    preparation_time: raw.preparation_time ? parseInt(String(raw.preparation_time)) : undefined,
    calories: raw.calories ? parseInt(String(raw.calories)) : undefined,
    allergens: Array.isArray(raw.allergens) ? raw.allergens : (raw.allergens ? String(raw.allergens).split(',').map(s => s.trim()) : []),
    modifiers: parseModifiers(raw.modifiers),
    _tempId: Math.random().toString(36).substring(2, 11),
    _parseWarnings: warnings
  };
}

function parseModifiers(raw: any): any {
  if (!Array.isArray(raw)) return undefined;
  return raw.map(group => ({
    name: group.name || 'Options',
    is_required: Boolean(group.is_required),
    options: Array.isArray(group.options) ? group.options.map((opt: any) => ({
      name: String(opt.name),
      price: parseFloat(String(opt.price || 0))
    })) : []
  }));
}
