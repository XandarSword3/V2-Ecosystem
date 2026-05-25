// File: backend/src/services/dynamic-translation.service.ts
/**
 * Dynamic Translation Service
 * 
 * Manages database-driven translations for white-label content.
 * This service handles dynamic, user-configurable translations stored in the DB.
 */
import { getSupabase } from "../database/connection.js";
const supabase = getSupabase();
import { logger } from "../utils/logger.js";

interface TranslationEntry {
    id: string;
    translation_key: string;
    language: string;
    value: string;
    namespace?: string;
    created_at: string;
    updated_at: string;
}

class DynamicTranslationService {
    /**
     * Get translations for a specific language and namespace
     */
    async getTranslations(language: string, namespace?: string): Promise<Record<string, string>> {
        let query = supabase
            .from('translations')
            .select('*')
            .eq('language', language);

        if (namespace) {
            query = query.eq('namespace', namespace);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('[DynamicTranslation] Failed to fetch translations', error);
            return {};
        }

        // Transform to key-value object
        const result: Record<string, string> = {};
        (data || []).forEach((entry: TranslationEntry) => {
            result[entry.translation_key] = entry.value;
        });

        return result;
    }

    /**
     * Get a single translation by key
     */
    async getTranslation(key: string, language: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('translations')
            .select('value')
            .eq('translation_key', key)
            .eq('language', language)
            .single();

        if (error || !data) {
            return null;
        }

        return data.value;
    }

    /**
     * Upsert a translation
     */
    async setTranslation(key: string, language: string, value: string, namespace?: string): Promise<boolean> {
        const { error } = await supabase
            .from('translations')
            .upsert({
                translation_key: key,
                language,
                value,
                namespace: namespace || 'default',
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'translation_key,language',
            });

        if (error) {
            logger.error('[DynamicTranslation] Failed to set translation', error);
            return false;
        }

        return true;
    }

    /**
     * Bulk upsert translations
     */
    async bulkSetTranslations(
        translations: Array<{ key: string; language: string; value: string; namespace?: string }>
    ): Promise<boolean> {
        const entries = translations.map(t => ({
            translation_key: t.key,
            language: t.language,
            value: t.value,
            namespace: t.namespace || 'default',
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('translations')
            .upsert(entries, {
                onConflict: 'translation_key,language',
            });

        if (error) {
            logger.error('[DynamicTranslation] Failed to bulk set translations', error);
            return false;
        }

        return true;
    }

    /**
     * Delete a translation
     */
    async deleteTranslation(key: string, language: string): Promise<boolean> {
        const { error } = await supabase
            .from('translations')
            .delete()
            .eq('translation_key', key)
            .eq('language', language);

        if (error) {
            logger.error('[DynamicTranslation] Failed to delete translation', error);
            return false;
        }

        return true;
    }
}

export const dynamicTranslationService = new DynamicTranslationService();
export default dynamicTranslationService;
