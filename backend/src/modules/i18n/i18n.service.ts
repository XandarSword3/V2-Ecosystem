/**
 * Multi-Language Service (i18n)
 * Phase 4.4: Internationalization support
 * Refactored to use Supabase client
 */

import { getSupabase } from '../../database/connection.js';
import { createHash } from 'crypto';

// =============================================
// TYPES
// =============================================

interface PropertyLanguage {
  languageCode: string;
  languageName: string;
  nativeName?: string;
  isDefault: boolean;
  isActive: boolean;
  translationProgress: number;
  dateFormat: string;
  timeFormat: string;
}

interface TranslationKey {
  id: string;
  keyPath: string;
  context: string;
  module?: string;
  defaultValue: string;
  description?: string;
  placeholders: string[];
}

interface Translation {
  id: string;
  keyPath: string;
  languageCode: string;
  value: string;
  status: string;
  isCustom: boolean;
}

interface TranslationBundle {
  languageCode: string;
  context: string;
  translations: Record<string, any>;
  checksum: string;
  keyCount: number;
}

// =============================================
// I18N SERVICE CLASS
// =============================================

class I18nService {
  private bundleCache: Map<string, TranslationBundle> = new Map();

  private get supabase() {
    return getSupabase();
  }

  // =============================================
  // LANGUAGE CONFIGURATION
  // =============================================

  async enableLanguage(
    propertyId: string,
    languageCode: string,
    config: {
      languageName: string;
      nativeName?: string;
      isDefault?: boolean;
      dateFormat?: string;
      timeFormat?: string;
      currencyFormat?: string;
      numberFormat?: string;
    }
  ): Promise<void> {
    // If setting as default, unset current default
    if (config.isDefault) {
      await this.supabase
        .from('property_languages')
        .update({ is_default: false })
        .eq('property_id', propertyId)
        .eq('is_default', true);
    }

    // Upsert the language configuration
    const { error } = await this.supabase
      .from('property_languages')
      .upsert({
        property_id: propertyId,
        language_code: languageCode,
        language_name: config.languageName,
        native_name: config.nativeName || config.languageName,
        is_default: config.isDefault || false,
        date_format: config.dateFormat || 'MM/DD/YYYY',
        time_format: config.timeFormat || '12h',
        currency_format: config.currencyFormat || null,
        number_format: config.numberFormat || null,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'property_id,language_code'
      });

    if (error) throw error;

    // Recalculate translation progress
    await this.updateTranslationProgress(propertyId, languageCode);
  }

  async disableLanguage(propertyId: string, languageCode: string): Promise<void> {
    // Ensure we're not disabling the default language
    const { data: langs } = await this.supabase
      .from('property_languages')
      .select('is_default')
      .eq('property_id', propertyId)
      .eq('language_code', languageCode);

    if (langs && langs.length > 0 && langs[0].is_default) {
      throw new Error('Cannot disable the default language');
    }

    await this.supabase
      .from('property_languages')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .eq('language_code', languageCode);
  }

  async getPropertyLanguages(propertyId: string): Promise<PropertyLanguage[]> {
    const { data: languages, error } = await this.supabase
      .from('property_languages')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('language_name');

    if (error) throw error;

    return (languages || []).map(lang => ({
      languageCode: lang.language_code,
      languageName: lang.language_name,
      nativeName: lang.native_name,
      isDefault: lang.is_default,
      isActive: lang.is_active,
      translationProgress: lang.translation_progress || 0,
      dateFormat: lang.date_format,
      timeFormat: lang.time_format
    }));
  }

  async getDefaultLanguage(propertyId: string): Promise<string> {
    const { data: langs } = await this.supabase
      .from('property_languages')
      .select('language_code')
      .eq('property_id', propertyId)
      .eq('is_default', true)
      .limit(1);

    return langs && langs.length > 0 ? langs[0].language_code : 'en';
  }

  // =============================================
  // TRANSLATION KEYS
  // =============================================

  async createTranslationKey(data: {
    keyPath: string;
    context: string;
    module?: string;
    component?: string;
    defaultValue: string;
    description?: string;
    maxLength?: number;
    placeholders?: string[];
  }): Promise<TranslationKey> {
    const { data: keys, error } = await this.supabase
      .from('translation_keys')
      .upsert({
        key_path: data.keyPath,
        context: data.context,
        module: data.module || null,
        component: data.component || null,
        default_value: data.defaultValue,
        description: data.description || null,
        max_length: data.maxLength || null,
        placeholders: data.placeholders || [],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key_path'
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTranslationKey(keys);
  }

  async getTranslationKey(keyPath: string): Promise<TranslationKey | null> {
    const { data: keys } = await this.supabase
      .from('translation_keys')
      .select('*')
      .eq('key_path', keyPath)
      .eq('is_active', true)
      .limit(1);

    return keys && keys.length > 0 ? this.mapTranslationKey(keys[0]) : null;
  }

  async getTranslationKeys(
    filters?: {
      context?: string;
      module?: string;
      needsReview?: boolean;
    }
  ): Promise<TranslationKey[]> {
    let query = this.supabase
      .from('translation_keys')
      .select('*')
      .eq('is_active', true);

    if (filters?.context) {
      query = query.eq('context', filters.context);
    }
    if (filters?.module) {
      query = query.eq('module', filters.module);
    }
    if (filters?.needsReview) {
      query = query.eq('needs_review', true);
    }

    const { data: keys, error } = await query.order('key_path');

    if (error) throw error;
    return (keys || []).map(k => this.mapTranslationKey(k));
  }

  // =============================================
  // TRANSLATIONS
  // =============================================

  async setTranslation(
    keyPath: string,
    languageCode: string,
    value: string,
    options?: {
      propertyId?: string;
      translatedBy?: string;
      machineTranslated?: boolean;
      status?: string;
    }
  ): Promise<void> {
    const key = await this.getTranslationKey(keyPath);
    if (!key) {
      throw new Error(`Translation key not found: ${keyPath}`);
    }

    const { error } = await this.supabase
      .from('translations')
      .upsert({
        key_id: key.id,
        property_id: options?.propertyId || null,
        language_code: languageCode,
        value: value,
        status: options?.status || 'pending',
        is_custom: !!options?.propertyId,
        translated_by: options?.translatedBy || null,
        machine_translated: options?.machineTranslated || false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key_id,property_id,language_code'
      });

    if (error) throw error;

    // Invalidate bundle cache
    this.invalidateBundleCache(options?.propertyId || null, languageCode, key.context);
  }

  async bulkSetTranslations(
    translations: Array<{
      keyPath: string;
      languageCode: string;
      value: string;
      propertyId?: string;
    }>,
    options?: {
      translatedBy?: string;
      machineTranslated?: boolean;
      status?: string;
    }
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const t of translations) {
      try {
        await this.setTranslation(t.keyPath, t.languageCode, t.value, {
          propertyId: t.propertyId,
          ...options
        });
        success++;
      } catch (error) {
        failed++;
      }
    }

    return { success, failed };
  }

  async getTranslation(
    keyPath: string,
    languageCode: string,
    propertyId?: string
  ): Promise<string> {
    // Try property-specific translation first
    if (propertyId) {
      const { data: propTranslation } = await this.supabase
        .from('translations')
        .select('value, translation_keys!inner(key_path)')
        .eq('translation_keys.key_path', keyPath)
        .eq('language_code', languageCode)
        .eq('property_id', propertyId)
        .eq('status', 'approved')
        .limit(1);

      if (propTranslation && propTranslation.length > 0) {
        return propTranslation[0].value;
      }
    }

    // Try global translation
    const { data: globalTranslation } = await this.supabase
      .from('translations')
      .select('value, translation_keys!inner(key_path)')
      .eq('translation_keys.key_path', keyPath)
      .eq('language_code', languageCode)
      .is('property_id', null)
      .eq('status', 'approved')
      .limit(1);

    if (globalTranslation && globalTranslation.length > 0) {
      return globalTranslation[0].value;
    }

    // Fall back to default value
    const { data: key } = await this.supabase
      .from('translation_keys')
      .select('default_value')
      .eq('key_path', keyPath)
      .limit(1);

    return key && key.length > 0 ? key[0].default_value : keyPath;
  }

  async getTranslations(
    keyPaths: string[],
    languageCode: string,
    propertyId?: string
  ): Promise<Record<string, string>> {
    const translations: Record<string, string> = {};

    for (const keyPath of keyPaths) {
      translations[keyPath] = await this.getTranslation(keyPath, languageCode, propertyId);
    }

    return translations;
  }

  async approveTranslation(
    translationId: string,
    reviewedBy: string
  ): Promise<void> {
    await this.supabase
      .from('translations')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', translationId);
  }

  async rejectTranslation(
    translationId: string,
    reviewedBy: string,
    reason?: string
  ): Promise<void> {
    await this.supabase
      .from('translations')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', translationId);
  }

  // =============================================
  // TRANSLATION BUNDLES
  // =============================================

  async getTranslationBundle(
    languageCode: string,
    context: string = 'ui',
    propertyId?: string
  ): Promise<TranslationBundle> {
    const cacheKey = `${propertyId || 'global'}-${languageCode}-${context}`;

    // Check memory cache
    if (this.bundleCache.has(cacheKey)) {
      return this.bundleCache.get(cacheKey)!;
    }

    // Check database cache
    let query = this.supabase
      .from('translation_bundles')
      .select('*')
      .eq('language_code', languageCode)
      .eq('context', context);

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    } else {
      query = query.is('property_id', null);
    }

    const { data: cached } = await query.limit(1);

    if (cached && cached.length > 0) {
      const bundle = {
        languageCode,
        context,
        translations: cached[0].bundle,
        checksum: cached[0].checksum,
        keyCount: cached[0].key_count
      };
      this.bundleCache.set(cacheKey, bundle);
      return bundle;
    }

    // Generate bundle
    return this.generateBundle(languageCode, context, propertyId);
  }

  async generateBundle(
    languageCode: string,
    context: string,
    propertyId?: string
  ): Promise<TranslationBundle> {
    // Get all translation keys for this context
    const { data: keys } = await this.supabase
      .from('translation_keys')
      .select('id, key_path, default_value')
      .eq('context', context)
      .eq('is_active', true);

    if (!keys) {
      return {
        languageCode,
        context,
        translations: {},
        checksum: '',
        keyCount: 0
      };
    }

    // Get translations for these keys
    const keyIds = keys.map(k => k.id);
    
    const { data: translationsData } = await this.supabase
      .from('translations')
      .select('key_id, value')
      .in('key_id', keyIds)
      .eq('language_code', languageCode)
      .eq('status', 'approved');

    // Build translation map
    const translationMap = new Map<string, string>();
    if (translationsData) {
      for (const t of translationsData) {
        translationMap.set(t.key_id, t.value);
      }
    }

    // Build nested object from key paths
    const translations: Record<string, any> = {};
    for (const key of keys) {
      const value = translationMap.get(key.id) || key.default_value;
      this.setNestedValue(translations, key.key_path, value);
    }

    // Calculate checksum
    const checksum = createHash('sha256')
      .update(JSON.stringify(translations))
      .digest('hex');

    // Store in database
    await this.supabase
      .from('translation_bundles')
      .upsert({
        property_id: propertyId || null,
        language_code: languageCode,
        context: context,
        bundle: translations,
        checksum: checksum,
        key_count: keys.length,
        generated_at: new Date().toISOString()
      }, {
        onConflict: 'property_id,language_code,context'
      });

    const bundle = {
      languageCode,
      context,
      translations,
      checksum,
      keyCount: keys.length
    };

    // Update memory cache
    const cacheKey = `${propertyId || 'global'}-${languageCode}-${context}`;
    this.bundleCache.set(cacheKey, bundle);

    return bundle;
  }

  async getBundleChecksum(
    languageCode: string,
    context: string,
    propertyId?: string
  ): Promise<string | null> {
    let query = this.supabase
      .from('translation_bundles')
      .select('checksum')
      .eq('language_code', languageCode)
      .eq('context', context);

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    } else {
      query = query.is('property_id', null);
    }

    const { data: result } = await query.limit(1);
    return result && result.length > 0 ? result[0].checksum : null;
  }

  private invalidateBundleCache(
    propertyId: string | null,
    languageCode: string,
    context: string
  ): void {
    const cacheKey = `${propertyId || 'global'}-${languageCode}-${context}`;
    this.bundleCache.delete(cacheKey);
  }

  // =============================================
  // CONTENT TRANSLATIONS
  // =============================================

  async translateContent(
    entityType: string,
    entityId: string,
    fieldName: string,
    languageCode: string,
    value: string,
    options?: {
      status?: string;
      createdBy?: string;
    }
  ): Promise<void> {
    await this.supabase
      .from('content_translations')
      .upsert({
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        language_code: languageCode,
        value: value,
        status: options?.status || 'draft',
        created_by: options?.createdBy || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'entity_type,entity_id,field_name,language_code'
      });
  }

  async getContentTranslation(
    entityType: string,
    entityId: string,
    fieldName: string,
    languageCode: string
  ): Promise<string | null> {
    const { data: result } = await this.supabase
      .from('content_translations')
      .select('value')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('field_name', fieldName)
      .eq('language_code', languageCode)
      .eq('status', 'published')
      .limit(1);

    return result && result.length > 0 ? result[0].value : null;
  }

  async getEntityTranslations(
    entityType: string,
    entityId: string,
    languageCode: string
  ): Promise<Record<string, string>> {
    const { data: translations } = await this.supabase
      .from('content_translations')
      .select('field_name, value')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('language_code', languageCode)
      .eq('status', 'published');

    const result: Record<string, string> = {};
    if (translations) {
      for (const t of translations) {
        result[t.field_name] = t.value;
      }
    }
    return result;
  }

  async publishContentTranslation(
    entityType: string,
    entityId: string,
    languageCode: string
  ): Promise<void> {
    await this.supabase
      .from('content_translations')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('language_code', languageCode);
  }

  // =============================================
  // GUEST PREFERENCES
  // =============================================

  async setGuestLanguage(
    guestId: string,
    preferences: {
      preferredLanguage: string;
      secondaryLanguage?: string;
      emailLanguage?: string;
      smsLanguage?: string;
      detectionSource?: string;
    }
  ): Promise<void> {
    await this.supabase
      .from('guest_language_preferences')
      .upsert({
        guest_id: guestId,
        preferred_language: preferences.preferredLanguage,
        secondary_language: preferences.secondaryLanguage || null,
        email_language: preferences.emailLanguage || preferences.preferredLanguage,
        sms_language: preferences.smsLanguage || preferences.preferredLanguage,
        detection_source: preferences.detectionSource || 'explicit',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guest_id'
      });
  }

  async getGuestLanguage(guestId: string): Promise<string> {
    const { data: prefs } = await this.supabase
      .from('guest_language_preferences')
      .select('preferred_language')
      .eq('guest_id', guestId)
      .limit(1);

    return prefs && prefs.length > 0 ? prefs[0].preferred_language : 'en';
  }

  async detectGuestLanguage(
    acceptLanguageHeader: string
  ): Promise<string> {
    // Parse Accept-Language header
    const languages = acceptLanguageHeader
      .split(',')
      .map(lang => {
        const [code, q] = lang.trim().split(';q=');
        return {
          code: code.split('-')[0].toLowerCase(),
          quality: q ? parseFloat(q) : 1.0
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Return first supported language or default
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru'];
    for (const lang of languages) {
      if (supportedLanguages.includes(lang.code)) {
        return lang.code;
      }
    }
    return 'en';
  }

  // =============================================
  // TRANSLATION MEMORY
  // =============================================

  async addToTranslationMemory(
    sourceLanguage: string,
    targetLanguage: string,
    sourceText: string,
    translatedText: string,
    context?: string,
    domain?: string
  ): Promise<void> {
    await this.supabase
      .from('translation_memory')
      .upsert({
        source_language: sourceLanguage,
        target_language: targetLanguage,
        source_text: sourceText,
        translated_text: translatedText,
        context: context || null,
        domain: domain || 'hospitality'
      }, {
        onConflict: 'source_language,target_language,source_text',
        ignoreDuplicates: true
      });
  }

  async findTranslationMatch(
    sourceLanguage: string,
    targetLanguage: string,
    sourceText: string
  ): Promise<{ translatedText: string; quality: number } | null> {
    const { data: matches } = await this.supabase
      .from('translation_memory')
      .select('translated_text, quality_score, usage_count')
      .eq('source_language', sourceLanguage)
      .eq('target_language', targetLanguage)
      .eq('source_text', sourceText)
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('usage_count', { ascending: false })
      .limit(1);

    if (!matches || matches.length === 0) return null;

    // Increment usage count
    await this.supabase
      .from('translation_memory')
      .update({ 
        usage_count: (matches[0].usage_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('source_language', sourceLanguage)
      .eq('target_language', targetLanguage)
      .eq('source_text', sourceText);

    return {
      translatedText: matches[0].translated_text,
      quality: matches[0].quality_score || 0.8
    };
  }

  // =============================================
  // TRANSLATION PROGRESS
  // =============================================

  async updateTranslationProgress(
    propertyId: string,
    languageCode: string
  ): Promise<number> {
    // Calculate progress: approved translations / total keys * 100
    const { data: totalKeys } = await this.supabase
      .from('translation_keys')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    const totalCount = totalKeys?.length || 0;
    if (totalCount === 0) return 100;

    // Count approved translations for this language
    const { data: approvedTranslations } = await this.supabase
      .from('translations')
      .select('id', { count: 'exact' })
      .eq('language_code', languageCode)
      .eq('status', 'approved');

    const approvedCount = approvedTranslations?.length || 0;
    const progress = Math.round((approvedCount / totalCount) * 100);

    await this.supabase
      .from('property_languages')
      .update({ translation_progress: progress, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .eq('language_code', languageCode);

    return progress;
  }

  async getMissingTranslations(
    languageCode: string,
    propertyId?: string,
    context?: string
  ): Promise<TranslationKey[]> {
    // Get all active keys
    let keysQuery = this.supabase
      .from('translation_keys')
      .select('*')
      .eq('is_active', true);

    if (context) {
      keysQuery = keysQuery.eq('context', context);
    }

    const { data: allKeys } = await keysQuery;
    if (!allKeys || allKeys.length === 0) return [];

    // Get existing approved translations
    const { data: existingTranslations } = await this.supabase
      .from('translations')
      .select('key_id')
      .eq('language_code', languageCode)
      .eq('status', 'approved');

    const translatedKeyIds = new Set(
      (existingTranslations || []).map(t => t.key_id)
    );

    // Filter to missing keys
    const missingKeys = allKeys.filter(k => !translatedKeyIds.has(k.id));

    return missingKeys.map(k => this.mapTranslationKey(k));
  }

  // =============================================
  // STRING INTERPOLATION
  // =============================================

  interpolate(
    template: string,
    values: Record<string, string | number>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return values.hasOwnProperty(key) ? String(values[key]) : match;
    });
  }

  // =============================================
  // FORMATTING HELPERS
  // =============================================

  formatDate(
    date: Date,
    languageCode: string,
    format?: string
  ): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Intl.DateTimeFormat(languageCode, options).format(date);
  }

  formatCurrency(
    amount: number,
    currency: string,
    languageCode: string
  ): string {
    return new Intl.NumberFormat(languageCode, {
      style: 'currency',
      currency
    }).format(amount);
  }

  formatNumber(
    number: number,
    languageCode: string
  ): string {
    return new Intl.NumberFormat(languageCode).format(number);
  }

  // =============================================
  // HELPERS
  // =============================================

  private setNestedValue(obj: Record<string, any>, path: string, value: string): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private mapTranslationKey(row: any): TranslationKey {
    return {
      id: row.id,
      keyPath: row.key_path,
      context: row.context,
      module: row.module,
      defaultValue: row.default_value,
      description: row.description,
      placeholders: row.placeholders || []
    };
  }
}

export const i18nService = new I18nService();
