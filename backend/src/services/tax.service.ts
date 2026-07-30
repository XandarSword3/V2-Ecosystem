import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";
import type { PricingLineItem } from "../engines/types.js";
import { resolveSetting } from "../modules/multi-property/settings-resolution.service.js";

// ============================================
// TAX CALCULATION RULES (DOCUMENTED)
// ============================================
//
// 1. ROUNDING: Round each component to 2 decimal places, then sum.
//    - Each tax amount is rounded individually
//    - Each fee amount is rounded individually
//    - Final total = sum of all rounded components
//    - This ensures breakdown always matches total (no "why doesn't this add up" issues)
//
// 2. COMPOUNDING: Honor is_compound flag with deterministic order.
//    - Non-compound taxes: All apply to base subtotal independently
//    - Compound taxes: Apply to (base + sum of all non-compound taxes + sum of previously-applied compound taxes)
//    - Compound order: Deterministic by tax rate 'order' field (ascending)
//    - If no order field, fallback to ascending by rate ID
//
// 3. CATEGORY SCOPING: Tax rates apply to specific item categories.
//    - Each PricingLineItem has a taxCategory (defaults to 'all' if unset)
//    - Tax rate applies if its applies_to[] includes the item's category OR includes 'all'
//    - Missing/unset taxCategory defaults to 'all' (fail-open on categorization)
//
// 4. CATEGORY RESOLUTION: Check item-level override first, fall back to module.
//    - Item metadata can contain tax_category override
//    - If item has override, use it; otherwise use module's default category
//    - This allows future item-level overrides without touching all call sites
//
// 5. EDGE CASES:
//    - Zero or negative rates: Still appear in breakdown (so admin can see configured zero rates)
//    - Empty/no taxes configured: Return empty taxBreakdown array, total = subtotal + fees
//    - TaxBreakdown and feeBreakdown are strictly separate arrays (enforced at type level)
//
// ============================================

interface TaxRate {
  id: string;
  name: string;
  rate: number; // Percentage (e.g., 11 for 11%)
  type: 'vat' | 'sales' | 'service' | 'tourism' | 'custom';
  applies_to: string[]; // Categories this tax applies to
  is_default: boolean;
  is_compound: boolean;
  order: number; // Compounding sequence
  jurisdiction?: string;
  description?: string;
}

interface TaxConfiguration {
  default_rate: number;
  tax_included_in_price: boolean;
  show_tax_breakdown: boolean;
  rounding_method: 'round' | 'floor' | 'ceil';
  decimal_places: number;
  tax_number?: string;
  tax_name_display?: string;
  rates: TaxRate[];
}

interface TaxBreakdownItem {
  id: string;
  name: string;
  rate: number;
  amount: number;
  type: string;
}

/**
 * Resolve tax category for a line item.
 * Priority: item metadata override -> module default -> 'all'
 * This allows future item-level overrides without touching all call sites.
 *
 * @param item - The pricing line item (may have metadata.tax_category override)
 * @param moduleTaxCategory - The module's default tax category
 * @returns Resolved tax category
 */
export function resolveTaxCategory(item: PricingLineItem, moduleTaxCategory: string = 'all'): string {
  // Check item-level override in metadata first
  if (item.metadata?.tax_category && typeof item.metadata.tax_category === 'string') {
    return item.metadata.tax_category;
  }
  // Fall back to module's default category
  return moduleTaxCategory || 'all';
}

// Default to Lebanon VAT 11% if not configured
const DEFAULT_TAX_RATE = 11;

export class TaxService {
  /**
   * Get the full tax configuration.
   *
   * Resolution order when propertyId is supplied (multi-property tenants):
   *   1. Property-level override (property_settings, via resolveSetting)
   *   2. Group-level default (same cascade)
   *   3. Tenant-wide default (site_settings.tax_configuration)
   *   4. Hardcoded default
   *
   * Without a propertyId (single-property / legacy callers), this goes
   * straight to the tenant-wide site_settings row, same as before.
   */
  async getTaxConfiguration(propertyId?: string): Promise<TaxConfiguration> {
    if (propertyId) {
      try {
        const resolved = await resolveSetting(propertyId, 'tax_configuration', null);
        if (resolved.value && Array.isArray(resolved.value.rates)) {
          return resolved.value as TaxConfiguration;
        }
        // resolved.value is null (no property/group/system override) — fall through
        // to the tenant-wide site_settings row below instead of the hardcoded default,
        // so a property with no override still gets the tenant's real configured rates.
      } catch (err) {
        logger.debug('Error resolving property-scoped tax configuration, falling back to tenant-wide:', err);
      }
    }

    const supabase = getSupabase();

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'tax_configuration')
        .single();
        
      if (error || !data) {
        return this.getDefaultConfiguration();
      }

      const config = data.value;
      
      // Validate structure
      if (!config.rates || !Array.isArray(config.rates)) {
        logger.warn('Invalid tax configuration structure, using default');
        return this.getDefaultConfiguration();
      }

      return config as TaxConfiguration;

    } catch (err) {
      logger.debug('Error fetching tax configuration, using default:', err);
      return this.getDefaultConfiguration();
    }
  }

  /**
   * Compute tax breakdown for a set of line items.
   * 
   * @param lineItems - Items to compute tax for (each has taxCategory)
   * @param subtotal - Base subtotal before tax
   * @param moduleId - Optional module ID for module-specific overrides
   * @returns Tax breakdown array with computed amounts
   */
  async computeTaxBreakdown(
    lineItems: PricingLineItem[],
    subtotal: number,
    moduleId?: string
  ): Promise<TaxBreakdownItem[]> {
    const config = await this.getTaxConfiguration();
    
    if (!config.rates || config.rates.length === 0) {
      return [];
    }

    // Group line items by tax category
    const categorySubtotals = new Map<string, number>();
    
    for (const item of lineItems) {
      const category = item.taxCategory || 'all'; // Default to 'all' if unset
      const itemTotal = (item.unitPrice + (item.unitAdjustment ?? 0)) * item.quantity;
      categorySubtotals.set(category, (categorySubtotals.get(category) || 0) + itemTotal);
    }

    const breakdown: TaxBreakdownItem[] = [];
    
    // Separate compound and non-compound taxes
    const nonCompoundTaxes = config.rates
      .filter(r => !r.is_compound)
      .sort((a, b) => a.order - b.order);
    
    const compoundTaxes = config.rates
      .filter(r => r.is_compound)
      .sort((a, b) => a.order - b.order);

    // Step 1: Apply non-compound taxes (each to base subtotal of applicable categories)
    let nonCompoundTotal = 0;
    for (const tax of nonCompoundTaxes) {
      const applicableSubtotal = this.getApplicableSubtotal(tax.applies_to, categorySubtotals);
      if (applicableSubtotal > 0) {
        const rateDecimal = tax.rate / 100;
        const amount = this.round(applicableSubtotal * rateDecimal, config.decimal_places, config.rounding_method);
        nonCompoundTotal += amount;
        
        breakdown.push({
          id: tax.id,
          name: tax.name,
          rate: tax.rate,
          amount,
          type: tax.type
        });
      }
    }

    // Step 2: Apply compound taxes (each to base + non-compound + previously-applied compound)
    let compoundRunningTotal = nonCompoundTotal;
    for (const tax of compoundTaxes) {
      const applicableSubtotal = this.getApplicableSubtotal(tax.applies_to, categorySubtotals);
      if (applicableSubtotal > 0) {
        const baseForCompound = applicableSubtotal + compoundRunningTotal;
        const rateDecimal = tax.rate / 100;
        const amount = this.round(baseForCompound * rateDecimal, config.decimal_places, config.rounding_method);
        compoundRunningTotal += amount;
        
        breakdown.push({
          id: tax.id,
          name: tax.name,
          rate: tax.rate,
          amount,
          type: tax.type
        });
      }
    }

    return breakdown;
  }

  /**
   * Get the applicable subtotal for a tax rate based on category scoping.
   */
  private getApplicableSubtotal(appliesTo: string[], categorySubtotals: Map<string, number>): number {
    // If applies_to includes 'all', return total of all categories
    if (appliesTo.includes('all')) {
      return Array.from(categorySubtotals.values()).reduce((sum, val) => sum + val, 0);
    }

    // Otherwise, sum only the specified categories
    let total = 0;
    for (const category of appliesTo) {
      total += categorySubtotals.get(category) || 0;
    }
    return total;
  }

  /**
   * Round a monetary amount according to the configured strategy.
   */
  private round(amount: number, decimalPlaces: number, strategy: 'round' | 'floor' | 'ceil'): number {
    const factor = Math.pow(10, decimalPlaces);
    switch (strategy) {
      case 'floor':
        return Math.floor(amount * factor) / factor;
      case 'ceil':
        return Math.ceil(amount * factor) / factor;
      case 'round':
      default:
        return Math.round(amount * factor) / factor;
    }
  }

  /**
   * Get default tax configuration.
   */
  private getDefaultConfiguration(): TaxConfiguration {
    return {
      default_rate: DEFAULT_TAX_RATE,
      tax_included_in_price: false,
      show_tax_breakdown: true,
      rounding_method: 'round',
      decimal_places: 2,
      tax_number: '',
      tax_name_display: 'Tax',
      rates: [
        {
          id: 'default',
          name: 'Standard VAT',
          rate: DEFAULT_TAX_RATE,
          type: 'vat',
          applies_to: ['all'],
          is_default: true,
          is_compound: false,
          order: 1,
          description: 'Default VAT rate',
        }
      ]
    };
  }

  /**
   * Legacy method for backward compatibility.
   * Returns a single effective tax rate (deprecated - use computeTaxBreakdown instead).
   */
  async getTaxRate(moduleId?: string): Promise<number> {
    const config = await this.getTaxConfiguration();
    return config.default_rate / 100; // Convert percentage to decimal
  }

  /**
   * Update the tax configuration.
   */
  async updateTaxConfiguration(config: Partial<TaxConfiguration>): Promise<void> {
     const supabase = getSupabase();
     
     // Fetch existing to merge
     const { data: existing } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'tax_configuration')
        .single();

     const currentVal = existing?.value || this.getDefaultConfiguration();
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
