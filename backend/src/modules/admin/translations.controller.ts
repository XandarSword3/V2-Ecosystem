import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection";
import { translateText } from "../../services/translation.service";
import { logActivity } from "../../utils/activityLogger";
import { logger } from "../../utils/logger.js";

// Tables that have translatable fields
const TRANSLATABLE_TABLES = [
  {
    table: 'modules',
    fields: [
      { field: 'name', ar: 'name_ar', fr: 'name_fr' },
      { field: 'description', ar: 'description_ar', fr: 'description_fr' }
    ],
    displayName: 'Modules',
    labelField: 'name',
  },
  {
    table: 'menu_categories',
    fields: [
      { field: 'name', ar: 'name_ar', fr: 'name_fr' }
    ],
    displayName: 'Menu Categories',
    labelField: 'name',
  },
  {
    table: 'menu_items',
    fields: [
      { field: 'name', ar: 'name_ar', fr: 'name_fr' },
      { field: 'description', ar: 'description_ar', fr: 'description_fr' }
    ],
    displayName: 'Menu Items',
    labelField: 'name',
  },
  {
    table: 'chalets',
    fields: [
      { field: 'name', ar: 'name_ar', fr: 'name_fr' }
    ],
    displayName: 'Chalets',
    labelField: 'name',
  },
  {
    table: 'snack_items',
    fields: [
      { field: 'name', ar: 'name_ar', fr: 'name_fr' }
    ],
    displayName: 'Snack Items',
    labelField: 'name',
  },
  {
    table: 'chalet_add_ons',
    fields: [
      { field: 'name', ar: 'name_ar', fr: 'name_fr' }
    ],
    displayName: 'Chalet Add-ons',
    labelField: 'name',
  },
  {
    table: 'pool_sessions',
    fields: [
      { field: 'name', ar: 'name_ar', fr: 'name_fr' }
    ],
    displayName: 'Pool Sessions',
    labelField: 'name',
  },
];

interface MissingTranslation {
  table: string;
  tableDisplayName: string;
  id: string;
  itemLabel: string;
  field: string;
  originalValue: string;
  missingLanguages: string[];
}

/**
 * Get all items across all translatable tables that have missing translations
 */
export async function getMissingTranslations(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const missing: MissingTranslation[] = [];

    for (const tableConfig of TRANSLATABLE_TABLES) {
      try {
        // Build select fields - we need id, the source field, and all translation fields
        const selectFields = [
          'id',
          tableConfig.labelField,
          ...tableConfig.fields.flatMap(f => [f.field, f.ar, f.fr])
        ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

        const { data, error } = await supabase
          .from(tableConfig.table)
          .select(selectFields.join(','));

        if (error) {
          logger.warn(`[Translations] Could not fetch ${tableConfig.table}:`, error.message);
          continue;
        }

        if (!data) continue;

        // Check each item for missing translations
        for (const item of data as unknown as Record<string, unknown>[]) {
          for (const fieldConfig of tableConfig.fields) {
            const originalValue = item[fieldConfig.field] as string | undefined;
            if (!originalValue) continue; // Skip if source field is empty

            const missingLanguages: string[] = [];
            if (!item[fieldConfig.ar]) missingLanguages.push('ar');
            if (!item[fieldConfig.fr]) missingLanguages.push('fr');

            if (missingLanguages.length > 0) {
              missing.push({
                table: tableConfig.table,
                tableDisplayName: tableConfig.displayName,
                id: item.id as string,
                itemLabel: (item[tableConfig.labelField] as string) || (item.id as string),
                field: fieldConfig.field,
                originalValue,
                missingLanguages,
              });
            }
          }
        }
      } catch (tableError) {
        logger.warn(`[Translations] Error processing ${tableConfig.table}:`, tableError);
      }
    }

    // Group by table for better UI display
    const groupedByTable = missing.reduce((acc, item) => {
      if (!acc[item.table]) {
        acc[item.table] = {
          displayName: item.tableDisplayName,
          items: [],
        };
      }
      acc[item.table].items.push(item);
      return acc;
    }, {} as Record<string, { displayName: string; items: MissingTranslation[] }>);

    res.json({
      success: true,
      data: {
        totalMissing: missing.length,
        byTable: groupedByTable,
        items: missing,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get translation summary stats
 */
export async function getTranslationStats(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const stats: Record<string, { total: number; translated: number; missing: number }> = {};

    for (const tableConfig of TRANSLATABLE_TABLES) {
      try {
        const { data, error } = await supabase
          .from(tableConfig.table)
          .select('*');

        if (error || !data) continue;

        let totalFields = 0;
        let translatedFields = 0;

        for (const item of data) {
          for (const fieldConfig of tableConfig.fields) {
            if (item[fieldConfig.field]) {
              totalFields += 2; // AR and FR translations needed
              if (item[fieldConfig.ar]) translatedFields++;
              if (item[fieldConfig.fr]) translatedFields++;
            }
          }
        }

        stats[tableConfig.table] = {
          total: totalFields,
          translated: translatedFields,
          missing: totalFields - translatedFields,
        };
      } catch (tableError) {
        logger.warn(`[Translations] Error getting stats for ${tableConfig.table}:`, tableError);
      }
    }

    const overall = Object.values(stats).reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        translated: acc.translated + s.translated,
        missing: acc.missing + s.missing,
      }),
      { total: 0, translated: 0, missing: 0 }
    );

    res.json({
      success: true,
      data: {
        overall,
        byTable: stats,
        percentage: overall.total > 0 ? Math.round((overall.translated / overall.total) * 100) : 100,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a translation for a specific item
 */
export async function updateTranslation(req: Request, res: Response, next: NextFunction) {
  try {
    const { table, id, field, language, value } = req.body;

    // Validate input
    if (!table || !id || !field || !language || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: table, id, field, language, value',
      });
    }

    // Find table config
    const tableConfig = TRANSLATABLE_TABLES.find(t => t.table === table);
    if (!tableConfig) {
      return res.status(400).json({
        success: false,
        error: `Unknown table: ${table}`,
      });
    }

    // Find field config
    const fieldConfig = tableConfig.fields.find(f => f.field === field);
    if (!fieldConfig) {
      return res.status(400).json({
        success: false,
        error: `Unknown field: ${field} in table ${table}`,
      });
    }

    // Determine which column to update
    const columnToUpdate = language === 'ar' ? fieldConfig.ar : fieldConfig.fr;
    if (!columnToUpdate) {
      return res.status(400).json({
        success: false,
        error: `Unknown language: ${language}`,
      });
    }

    const supabase = getSupabase();

    // Update the translation
    const { data, error } = await supabase
      .from(table)
      .update({
        [columnToUpdate]: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId || 'system',
      action: 'UPDATE_TRANSLATION',
      resource: table,
      resource_id: id,
      new_value: { field, language, value },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * Auto-translate missing translations for an item
 */
export async function autoTranslate(req: Request, res: Response, next: NextFunction) {
  try {
    const { table, id } = req.body;

    // Validate input
    if (!table || !id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: table, id',
      });
    }

    // Find table config
    const tableConfig = TRANSLATABLE_TABLES.find(t => t.table === table);
    if (!tableConfig) {
      return res.status(400).json({
        success: false,
        error: `Unknown table: ${table}`,
      });
    }

    const supabase = getSupabase();

    // Get the item
    const { data: item, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    // Build update object with auto-translated values
    const updateData: Record<string, string> = {};
    const translations: Record<string, { ar?: string; fr?: string }> = {};

    for (const fieldConfig of tableConfig.fields) {
      const sourceText = item[fieldConfig.field];
      if (!sourceText) continue;

      // Auto-translate if missing
      if (!item[fieldConfig.ar] || !item[fieldConfig.fr]) {
        try {
          const result = await translateText(sourceText);
          
          if (!item[fieldConfig.ar] && result.ar) {
            updateData[fieldConfig.ar] = result.ar;
          }
          if (!item[fieldConfig.fr] && result.fr) {
            updateData[fieldConfig.fr] = result.fr;
          }

          translations[fieldConfig.field] = {
            ar: result.ar,
            fr: result.fr,
          };
        } catch (translateError) {
          logger.warn(`[Translations] Auto-translate failed for ${fieldConfig.field}:`, translateError);
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({
        success: true,
        message: 'No translations needed',
        data: item,
      });
    }

    // Update the item
    const { data: updatedItem, error: updateError } = await supabase
      .from(table)
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logActivity({
      user_id: req.user!.userId || 'system',
      action: 'AUTO_TRANSLATE',
      resource: table,
      resource_id: id,
      new_value: translations,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      success: true,
      data: updatedItem,
      translations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Batch auto-translate all missing translations for a table
 */
export async function batchAutoTranslate(req: Request, res: Response, next: NextFunction) {
  try {
    const { table } = req.body;

    // Validate input
    if (!table) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: table',
      });
    }

    // Find table config
    const tableConfig = TRANSLATABLE_TABLES.find(t => t.table === table);
    if (!tableConfig) {
      return res.status(400).json({
        success: false,
        error: `Unknown table: ${table}`,
      });
    }

    const supabase = getSupabase();

    // Get all items from the table
    const { data: items, error: fetchError } = await supabase
      .from(table)
      .select('*');

    if (fetchError) throw fetchError;
    if (!items || items.length === 0) {
      return res.json({
        success: true,
        message: 'No items to translate',
        translated: 0,
      });
    }

    let translatedCount = 0;
    const errors: string[] = [];

    for (const item of items) {
      const updateData: Record<string, string> = {};

      for (const fieldConfig of tableConfig.fields) {
        const sourceText = item[fieldConfig.field];
        if (!sourceText) continue;

        // Check if translations are missing
        if (!item[fieldConfig.ar] || !item[fieldConfig.fr]) {
          try {
            const result = await translateText(sourceText);

            if (!item[fieldConfig.ar] && result.ar) {
              updateData[fieldConfig.ar] = result.ar;
            }
            if (!item[fieldConfig.fr] && result.fr) {
              updateData[fieldConfig.fr] = result.fr;
            }
          } catch (translateError: unknown) {
            const errMsg = translateError instanceof Error ? translateError.message : 'Unknown error';
            errors.push(`Failed to translate ${item.id}: ${errMsg}`);
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from(table)
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) {
          errors.push(`Failed to update ${item.id}: ${updateError.message}`);
        } else {
          translatedCount++;
        }
      }
    }

    await logActivity({
      user_id: req.user!.userId || 'system',
      action: 'BATCH_AUTO_TRANSLATE',
      resource: table,
      resource_id: 'batch',
      new_value: { translated: translatedCount, errors: errors.length },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      success: true,
      translated: translatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    next(error);
  }
}

// ============== LANGUAGE MANAGEMENT ==============

/**
 * Get all supported languages from database
 */
export async function getSupportedLanguages(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    
    // Check if languages table exists, if not return defaults
    const { data, error } = await supabase
      .from('supported_languages')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      // Table may not exist, return defaults
      return res.json({
        success: true,
        data: [
          { code: 'en', name: 'English', native_name: 'English', direction: 'ltr', is_default: true, is_active: true },
          { code: 'ar', name: 'Arabic', native_name: 'العربية', direction: 'rtl', is_default: false, is_active: true },
          { code: 'fr', name: 'French', native_name: 'Français', direction: 'ltr', is_default: false, is_active: true },
        ],
      });
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a new supported language
 */
export async function addLanguage(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, name, native_name, direction = 'ltr' } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        error: 'Language code and name are required',
      });
    }

    const supabase = getSupabase();

    // Check if language already exists
    const { data: existing } = await supabase
      .from('supported_languages')
      .select('code')
      .eq('code', code)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Language with code '${code}' already exists`,
      });
    }

    // Get max sort order
    const { data: maxOrder } = await supabase
      .from('supported_languages')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('supported_languages')
      .insert({
        code,
        name,
        native_name: native_name || name,
        direction,
        is_default: false,
        is_active: true,
        sort_order: (maxOrder?.sort_order || 0) + 1,
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'ADD_LANGUAGE',
      resource: 'supported_languages',
      resource_id: code,
      new_value: data,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a supported language
 */
export async function updateLanguage(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;
    const { name, native_name, direction, is_active, is_default, sort_order } = req.body;

    const supabase = getSupabase();

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (native_name !== undefined) updateData.native_name = native_name;
    if (direction !== undefined) updateData.direction = direction;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    // If setting as default, unset other defaults first
    if (is_default === true) {
      await supabase
        .from('supported_languages')
        .update({ is_default: false })
        .neq('code', code);
      updateData.is_default = true;
    }

    const { data, error } = await supabase
      .from('supported_languages')
      .update(updateData)
      .eq('code', code)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_LANGUAGE',
      resource: 'supported_languages',
      resource_id: code,
      new_value: updateData,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a supported language
 */
export async function deleteLanguage(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;

    // Prevent deleting default language
    if (code === 'en') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the default English language',
      });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('supported_languages')
      .delete()
      .eq('code', code);

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'DELETE_LANGUAGE',
      resource: 'supported_languages',
      resource_id: code,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ success: true, message: `Language '${code}' deleted` });
  } catch (error) {
    next(error);
  }
}

// ============== FRONTEND TRANSLATION KEY ANALYSIS ==============

/**
 * Compare frontend translation JSON files and find missing keys
 * This analyzes the actual translation files used by next-intl
 */
export async function compareFrontendTranslations(req: Request, res: Response, next: NextFunction) {
  try {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    
    // Path to frontend messages directory
    // In production (built), we are in dist/modules/admin/translations.controller.js
    // We need to go up to root and then to frontend/messages
    // Using process.cwd() is safer as it resolves relative to the backend root where the server is running
    const messagesDir = path.resolve(process.cwd(), '../frontend/messages');
    
    try {
      await fs.access(messagesDir);
    } catch {
       // If frontend/messages doesn't exist (e.g. Docker container), return empty
       return res.json({ 
         success: true, 
         data: { 
           en: { "note": "Frontend translations not available in this environment" },
           keys: []
         } 
       });
    }
    
    // Read all JSON files
    const files = await fs.readdir(messagesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const translations: Record<string, Record<string, unknown>> = {};
    const allKeys = new Set<string>();
    
    // Load all translation files
    for (const file of jsonFiles) {
      const lang = file.replace('.json', '');
      const content = await fs.readFile(path.join(messagesDir, file), 'utf-8');
      translations[lang] = JSON.parse(content);
      
      // Extract all keys recursively
      const extractKeys = (obj: unknown, prefix = ''): void => {
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'string') {
              allKeys.add(fullKey);
            } else if (typeof value === 'object') {
              extractKeys(value, fullKey);
            }
          }
        }
      };
      
      extractKeys(translations[lang]);
    }
    
    // Find missing keys per language
    const missingByLanguage: Record<string, string[]> = {};
    const getNestedValue = (obj: unknown, path: string): string | undefined => {
      const keys = path.split('.');
      let current: unknown = obj;
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return undefined;
        }
      }
      return typeof current === 'string' ? current : undefined;
    };
    
    for (const lang of Object.keys(translations)) {
      missingByLanguage[lang] = [];
      for (const key of allKeys) {
        const value = getNestedValue(translations[lang], key);
        if (!value) {
          missingByLanguage[lang].push(key);
        }
      }
    }
    
    // Calculate stats
    const totalKeys = allKeys.size;
    const stats: Record<string, { total: number; translated: number; missing: number; percentage: number }> = {};
    
    for (const lang of Object.keys(translations)) {
      const missing = missingByLanguage[lang].length;
      const translated = totalKeys - missing;
      stats[lang] = {
        total: totalKeys,
        translated,
        missing,
        percentage: Math.round((translated / totalKeys) * 100),
      };
    }
    
    res.json({
      success: true,
      data: {
        totalKeys,
        languages: Object.keys(translations),
        stats,
        missingByLanguage,
        allKeys: Array.from(allKeys).sort(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a specific frontend translation key
 */
export async function updateFrontendTranslation(req: Request, res: Response, next: NextFunction) {
  try {
    const { language, key, value } = req.body;
    
    if (!language || !key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Language, key, and value are required',
      });
    }
    
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    
    const filePath = path.join(__dirname, '../../../../frontend/messages', `${language}.json`);
    
    // Read current file
    const content = await fs.readFile(filePath, 'utf-8');
    const translations = JSON.parse(content);
    
    // Set nested value
    const keys = key.split('.');
    let current = translations;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    // Write back
    await fs.writeFile(filePath, JSON.stringify(translations, null, 2), 'utf-8');
    
    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_FRONTEND_TRANSLATION',
      resource: 'frontend_translations',
      resource_id: `${language}:${key}`,
      new_value: { language, key, value },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    
    res.json({ success: true, message: 'Translation updated' });
  } catch (error) {
    next(error);
  }
}

export default {
  getMissingTranslations,
  getTranslationStats,
  updateTranslation,
  autoTranslate,
  batchAutoTranslate,
  // Language management
  getSupportedLanguages,
  addLanguage,
  updateLanguage,
  deleteLanguage,
  // Frontend translations
  compareFrontendTranslations,
  updateFrontendTranslation,
};
