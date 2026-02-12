// File: backend/src/services/terminology.service.ts
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export interface TerminologyOverride {
    id: string;
    business_type: string;
    term_key: string;
    term_value: string;
    language: string;
}

export class TerminologyService {
    /**
     * Get all terminology overrides for a specific business type and language
     */
    async getTerminology(businessType: string, language: string = 'en'): Promise<Record<string, string>> {
        const supabase = getSupabase();

        try {
            const { data, error } = await supabase
                .from('terminology_overrides')
                .select('*')
                .eq('business_type', businessType)
                .eq('language', language);

            if (error) {
                // If table doesn't exist, just return defaults silently
                if (error.code === 'PGRST205' || error.message?.includes('terminology_overrides')) {
                    return {};
                }
                throw error;
            }

            // Convert to key-value map for easier frontend consumption
            const termMap: Record<string, string> = {};
            data?.forEach((item: TerminologyOverride) => {
                termMap[item.term_key] = item.term_value;
            });

            return termMap;
        } catch (error: any) {
            // Only log if it's not a missing table error
            if (error?.code !== 'PGRST205' && !error?.message?.includes('terminology_overrides')) {
                logger.error('Error fetching terminology:', error);
            }
            return {}; // Return empty object on error to allow fallbacks
        }
    }

    /**
     * Update or create a terminology override
     */
    async updateTerminology(
        businessType: string,
        key: string,
        value: string,
        language: string = 'en'
    ): Promise<TerminologyOverride | null> {
        const supabase = getSupabase();

        try {
            const { data, error } = await supabase
                .from('terminology_overrides')
                .upsert({
                    business_type: businessType,
                    term_key: key,
                    term_value: value,
                    language: language,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'business_type,term_key,language'
                })
                .select()
                .single();

            if (error) throw error;

            logger.info(`Updated terminology: ${businessType}.${key} = ${value} (${language})`);
            return data;
        } catch (error) {
            logger.error('Error updating terminology:', error);
            throw error;
        }
    }

    /**
     * Bulk update terminology
     */
    async bulkUpdateTerminology(
        businessType: string,
        language: string,
        updates: Record<string, string>
    ): Promise<void> {
        const supabase = getSupabase();

        const upsertData = Object.entries(updates).map(([key, value]) => ({
            business_type: businessType,
            term_key: key,
            term_value: value,
            language: language,
            updated_at: new Date().toISOString()
        }));

        if (upsertData.length === 0) return;

        try {
            const { error } = await supabase
                .from('terminology_overrides')
                .upsert(upsertData, {
                    onConflict: 'business_type,term_key,language'
                });

            if (error) throw error;
            logger.info(`Bulk updated ${upsertData.length} terms for ${businessType}`);
        } catch (error) {
            logger.error('Error in bulk update terminology:', error);
            throw error;
        }
    }

    /**
     * Get all defined keys for administration
     */
    async getAllOverrides(businessType?: string): Promise<TerminologyOverride[]> {
        const supabase = getSupabase();
        let query = supabase.from('terminology_overrides').select('*').order('term_key');

        if (businessType) {
            query = query.eq('business_type', businessType);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
}

export const terminologyService = new TerminologyService();
