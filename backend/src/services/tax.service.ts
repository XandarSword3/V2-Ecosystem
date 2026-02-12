import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";

// Default to Lebanon VAT 11% if not configured
const DEFAULT_TAX_RATE = 0.11;

export class TaxService {
  /**
   * Get the effective tax rate for a specific context.
   * currently checks 'tax_configuration' in site_settings.
   * returns rate as decimal (e.g. 0.11 for 11%)
   */
  async getTaxRate(moduleId?: string): Promise<number> {
    const supabase = getSupabase();
    
    try {
      // Try to fetch global tax rate
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'tax_configuration')
        .single();
        
      // If table doesn't exist or row missing, data will be null or error
      if (error || !data) {
        return DEFAULT_TAX_RATE;
      }

      const config = data.value;
      
      // If config is just a number (legacy/simple support), return it
      if (typeof config === 'number') return config;

      // Check for module specific tax override
      if (moduleId && config.modules && config.modules[moduleId] !== undefined) {
         return Number(config.modules[moduleId]);
      }
      
      // Fallback to global setting in config
      if (config.global_rate !== undefined) {
          return Number(config.global_rate);
      }
      
      return DEFAULT_TAX_RATE;

    } catch (err) {
      // Don't spam logs on every calc if it's just missing
      // logger.debug('Error fetching tax rate, using default:', err);
      return DEFAULT_TAX_RATE;
    }
  }

  /**
   * Update the tax configuration
   */
  async updateTaxConfiguration(config: { global_rate?: number, modules?: Record<string, number> }): Promise<void> {
     const supabase = getSupabase();
     
     // Fetch existing to merge
     const { data: existing } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'tax_configuration')
        .single();

     const currentVal = existing?.value || {};
     const newVal = {
         ...currentVal,
         ...config,
         updated_at: new Date().toISOString()
     };

     const { error } = await supabase
       .from('site_settings')
       .upsert({
           key: 'tax_configuration',
           value: newVal
       }, { onConflict: 'key' });
       
     if (error) {
         logger.error("Failed to update tax configuration", error);
         throw error;
     }
  }
}

export const taxService = new TaxService();
