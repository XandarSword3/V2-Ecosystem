import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";
import type { PricingLineItem, FeeBreakdownItem } from "../engines/types.js";
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
// 5. PAYMENT METHOD NORMALIZATION: Normalize frontend payment method values to match tax config.
//    - Frontend sends 'card' for credit/debit cards
//    - Tax config uses 'credit_card' 
//    - Normalize 'card' to 'credit_card' for matching
//
// 6. EDGE CASES:
//    - Zero or negative rates: Still appear in breakdown (so admin can see configured zero rates)
//    - Empty/no taxes configured: Return empty taxBreakdown array, total = subtotal + fees
//    - TaxBreakdown and feeBreakdown are strictly separate arrays (enforced at type level)
//
// ============================================

export interface TaxRate {
  id: string;
  name: string;
  rate: number; // Percentage (e.g., 11 for 11%)
  type: 'vat' | 'sales' | 'service' | 'tourism' | 'custom';
  fee_type?: 'tax' | 'service_charge' | 'resort_fee' | 'delivery_fee' | 'custom';
  applies_to: string[]; // Categories this tax applies to
  payment_methods?: string[]; // Payment methods this tax applies to: ['cash', 'credit_card', 'room_charge', 'all']
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

// Default tax rate when no configuration exists (0 = no surprise taxes)
const DEFAULT_TAX_RATE = 0;

/**
 * Normalize payment method from frontend to match tax configuration format.
 * Frontend uses 'card' for credit/debit cards, tax config uses 'credit_card'.
 */
function normalizePaymentMethod(paymentMethod?: string): string | undefined {
  if (!paymentMethod) return undefined;
  const normalized = paymentMethod.toLowerCase();
  // Map frontend 'card' to tax config 'credit_card'
  if (normalized === 'card') return 'credit_card';
  return normalized;
}

// Simple in-memory cache for module slugs (key: moduleId, value: slug)
const moduleSlugCache = new Map<string, string>();

// Simple in-memory cache for module tax categories (key: moduleId, value: tax_category)
const moduleTaxCategoryCache = new Map<string, string>();

// Simple in-memory cache for tax configurations (key: propertyId, value: TaxConfiguration)
const taxConfigCache = new Map<string, { config: TaxConfiguration; timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds cache TTL

/**
 * Get module slug with caching to avoid repeated database queries.
 */
async function getModuleSlug(moduleId: string): Promise<string | undefined> {
  // Check cache first
  if (moduleSlugCache.has(moduleId)) {
    return moduleSlugCache.get(moduleId);
  }

  // Fetch from database
  try {
    const supabase = getSupabase();
    const { data: module } = await supabase
      .from('modules')
      .select('slug')
      .eq('id', moduleId)
      .maybeSingle();

    if (module?.slug) {
      moduleSlugCache.set(moduleId, module.slug);
      return module.slug;
    }
  } catch (err) {
    // Silently fail - if we can't get the slug, we'll still match by module ID
  }

  return undefined;
}

/**
 * Get module tax category with caching to avoid repeated database queries.
 */
async function getModuleTaxCategory(moduleId: string): Promise<string> {
  // Check cache first
  if (moduleTaxCategoryCache.has(moduleId)) {
    return moduleTaxCategoryCache.get(moduleId)!;
  }

  // Fetch from database
  try {
    const supabase = getSupabase();
    const { data: module } = await supabase
      .from('modules')
      .select('tax_category')
      .eq('id', moduleId)
      .maybeSingle();

    const taxCategory = module?.tax_category ?? 'all';
    moduleTaxCategoryCache.set(moduleId, taxCategory);
    return taxCategory;
  } catch (err) {
    logger.debug('Error fetching module tax category:', err);
    return 'all';
  }
}

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
    const startTime = Date.now();
    const cacheKey = propertyId || 'global';

    // Check cache first
    const cached = taxConfigCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      const cacheTime = Date.now() - startTime;
      console.log(`[TaxService] getTaxConfiguration - cache hit: ${cacheTime}ms`);
      return cached.config;
    }

    if (propertyId) {
      try {
        const resolveStart = Date.now();
        const resolved = await resolveSetting(propertyId, 'tax_configuration', {});
        const resolveTime = Date.now() - resolveStart;
        console.log(`[TaxService] getTaxConfiguration - resolveSetting: ${resolveTime}ms`);

        if (resolved.value && Array.isArray(resolved.value.rates)) {
          const config = resolved.value as TaxConfiguration;
          // Cache the result
          taxConfigCache.set(cacheKey, { config, timestamp: Date.now() });
          const totalTime = Date.now() - startTime;
          console.log(`[TaxService] getTaxConfiguration - total: ${totalTime}ms (from property settings, cached)`);
          return config;
        }
        // resolved.value is empty object (no property/group/system override) — fall through
        // to the tenant-wide site_settings row below instead of the hardcoded default,
        // so a property with no override still gets the tenant's real configured rates.
      } catch (err) {
        logger.debug('Error resolving property-scoped tax configuration, falling back to tenant-wide:', err);
      }
    }

    const supabase = getSupabase();

    try {
      const dbStart = Date.now();
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'tax_configuration')
        .single();
      const dbTime = Date.now() - dbStart;
      console.log(`[TaxService] getTaxConfiguration - site_settings query: ${dbTime}ms`);

      if (error || !data) {
        // Return empty configuration instead of hardcoded default
        const config = this.getEmptyConfiguration();
        taxConfigCache.set(cacheKey, { config, timestamp: Date.now() });
        const totalTime = Date.now() - startTime;
        console.log(`[TaxService] getTaxConfiguration - total: ${totalTime}ms (empty config, cached)`);
        return config;
      }

      const config = data.value;
      // Cache the result
      taxConfigCache.set(cacheKey, { config, timestamp: Date.now() });
      const totalTime = Date.now() - startTime;
      console.log(`[TaxService] getTaxConfiguration - total: ${totalTime}ms (from site_settings, cached)`);

      // Validate structure
      if (!config.rates || !Array.isArray(config.rates)) {
        logger.warn('Invalid tax configuration structure, using default');
        const defaultConfig = this.getDefaultConfiguration();
        taxConfigCache.set(cacheKey, { config: defaultConfig, timestamp: Date.now() });
        const totalTime = Date.now() - startTime;
        console.log(`[TaxService] getTaxConfiguration - total: ${totalTime}ms (invalid structure, cached)`);
        return defaultConfig;
      }

      return config as TaxConfiguration;

    } catch (err) {
      logger.debug('Error fetching tax configuration, using default:', err);
      const defaultConfig = this.getDefaultConfiguration();
      taxConfigCache.set(cacheKey, { config: defaultConfig, timestamp: Date.now() });
      const totalTime = Date.now() - startTime;
      console.log(`[TaxService] getTaxConfiguration - total: ${totalTime}ms (error, cached)`);
      return defaultConfig;
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
    moduleId?: string,
    paymentMethod?: string,
    propertyId?: string
  ): Promise<TaxBreakdownItem[]> {
    const startTime = Date.now();
    const config = await this.getTaxConfiguration(propertyId);
    const configTime = Date.now() - startTime;
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

    console.log(`[TaxService] computeTaxBreakdown - config fetch: ${configTime}ms`);
    
    if (!config.rates || config.rates.length === 0) {
      return [];
    }

    // Only 'tax' fee_type rates belong in the tax breakdown
    const applicableRates = config.rates.filter((r) => {
      const feeType = r.fee_type || 'tax';
      if (feeType !== 'tax') return false;
      if (!normalizedPaymentMethod) return true;
      if (!r.payment_methods || r.payment_methods.length === 0 || r.payment_methods.includes('all')) return true;
      return r.payment_methods.includes(normalizedPaymentMethod);
    });

    // Group line items by tax category, category slug, and module ID
    const categoryGroupStart = Date.now();
    const categorySubtotals = new Map<string, number>();

    // Fetch module slug for category matching (cached)
    const moduleSlugStart = Date.now();
    const moduleSlug = moduleId ? await getModuleSlug(moduleId) : undefined;
    const moduleSlugTime = Date.now() - moduleSlugStart;

    for (const item of lineItems) {
      const itemTotal = (item.unitPrice + (item.unitAdjustment ?? 0)) * item.quantity;
      const keys = new Set<string>(['all']);
      if (item.taxCategory) keys.add(item.taxCategory);
      if (item.category) keys.add(item.category);
      if (item.moduleId) keys.add(item.moduleId);
      if (moduleId) keys.add(moduleId);
      if (moduleSlug) keys.add(moduleSlug); // Add module slug for admin config matching

      for (const k of keys) {
        categorySubtotals.set(k, (categorySubtotals.get(k) || 0) + itemTotal);
      }
    }
    const categoryGroupTime = Date.now() - categoryGroupStart;

    console.log(`[TaxService] computeTaxBreakdown - module slug fetch: ${moduleSlugTime}ms, category grouping: ${categoryGroupTime}ms`);

    const breakdown: TaxBreakdownItem[] = [];

    const calculationStart = Date.now();

    // Separate compound and non-compound taxes
    const nonCompoundTaxes = applicableRates
      .filter(r => !r.is_compound)
      .sort((a, b) => a.order - b.order);

    const compoundTaxes = applicableRates
      .filter(r => r.is_compound)
      .sort((a, b) => a.order - b.order);

    console.log(`[TaxService] computeTaxBreakdown - filtering: ${Date.now() - calculationStart}ms, non-compound: ${nonCompoundTaxes.length}, compound: ${compoundTaxes.length}`);

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

    const calculationTime = Date.now() - calculationStart;
    const totalTime = Date.now() - startTime;
    console.log(`[TaxService] computeTaxBreakdown - calculation: ${calculationTime}ms, total: ${totalTime}ms`);

    return breakdown;
  }

  /**
   * Compute fee breakdown (service charge, delivery fee, resort fee, custom surcharges)
   * for a set of line items, using the same CMS tax_configuration rates as
   * computeTaxBreakdown() but filtered to fee_type values other than 'tax'.
   *
   * @param lineItems - Items to compute fees for
   * @param paymentMethod - Optional payment method to scope fee rates
   * @param moduleId - Optional module ID
   * @param propertyId - Optional property ID for tenant property settings resolution
   * @returns Fee breakdown array with computed amounts
   */
  async computeFeeBreakdown(
    lineItems: PricingLineItem[],
    paymentMethod?: string,
    moduleId?: string,
    propertyId?: string
  ): Promise<FeeBreakdownItem[]> {
    const startTime = Date.now();
    const config = await this.getTaxConfiguration(propertyId);
    const configTime = Date.now() - startTime;
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

    console.log(`[TaxService] computeFeeBreakdown - config fetch: ${configTime}ms`);

    if (!config.rates || config.rates.length === 0) {
      return [];
    }

    const feeFeeTypes = new Set(['service_charge', 'resort_fee', 'delivery_fee', 'custom']);

    const applicableFees = config.rates
      .filter((r) => {
        if (!r.fee_type || !feeFeeTypes.has(r.fee_type)) return false;
        if (!normalizedPaymentMethod) return true;
        if (!r.payment_methods || r.payment_methods.length === 0 || r.payment_methods.includes('all')) return true;
        return r.payment_methods.includes(normalizedPaymentMethod);
      })
      .sort((a, b) => a.order - b.order);

    if (applicableFees.length === 0) {
      return [];
    }

    // Group line items by tax category, category slug, and module ID
    const categoryGroupStart = Date.now();
    const categorySubtotals = new Map<string, number>();

    // If moduleId is provided, fetch the module slug to include in category keys (cached)
    const moduleSlugStart = Date.now();
    const moduleSlug = moduleId ? await getModuleSlug(moduleId) : undefined;
    const moduleSlugTime = Date.now() - moduleSlugStart;

    for (const item of lineItems) {
      const itemTotal = (item.unitPrice + (item.unitAdjustment ?? 0)) * item.quantity;
      const keys = new Set<string>(['all']);
      if (item.taxCategory) keys.add(item.taxCategory);
      if (item.category) keys.add(item.category);
      if (item.moduleId) keys.add(item.moduleId);
      if (moduleId) keys.add(moduleId);
      if (moduleSlug) keys.add(moduleSlug); // Add module slug for admin config matching

      for (const k of keys) {
        categorySubtotals.set(k, (categorySubtotals.get(k) || 0) + itemTotal);
      }
    }
    const categoryGroupTime = Date.now() - categoryGroupStart;

    console.log(`[TaxService] computeFeeBreakdown - module slug fetch: ${moduleSlugTime}ms, category grouping: ${categoryGroupTime}ms`);

    const calculationStart = Date.now();
    const breakdown: FeeBreakdownItem[] = [];

    for (const fee of applicableFees) {
      const applicableSubtotal = this.getApplicableSubtotal(fee.applies_to, categorySubtotals);
      if (applicableSubtotal > 0) {
        const rateDecimal = fee.rate / 100;
        const amount = this.round(applicableSubtotal * rateDecimal, config.decimal_places, config.rounding_method);

        breakdown.push({
          id: fee.id,
          type: fee.fee_type as FeeBreakdownItem['type'],
          name: fee.name,
          amount,
          rate: fee.rate,
        });
      }
    }
    const calculationTime = Date.now() - calculationStart;
    const totalTime = Date.now() - startTime;

    console.log(`[TaxService] computeFeeBreakdown - calculation: ${calculationTime}ms, total: ${totalTime}ms`);

    return breakdown;
  }

  /**
   * Get the applicable subtotal for a tax rate based on category scoping.
   */
  private getApplicableSubtotal(appliesTo: string[], categorySubtotals: Map<string, number>): number {
    // If applies_to includes 'all', return the 'all' bucket which already holds
    // the full item total (each item is registered under 'all' plus any specific
    // category/module keys — summing all map values would double-count).
    if (appliesTo.includes('all')) {
      return categorySubtotals.get('all') || 0;
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
   * Get empty tax configuration (no hardcoded defaults).
   */
  private getEmptyConfiguration(): TaxConfiguration {
    return {
      default_rate: 0,
      tax_included_in_price: false,
      show_tax_breakdown: true,
      rounding_method: 'round',
      decimal_places: 2,
      tax_number: '',
      tax_name_display: 'Tax',
      rates: []
    };
  }

  /**
   * Get default tax configuration (legacy - should not be used in new code).
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
   * Invalidate tax configuration cache (call when tax settings are updated)
   */
  invalidateCache(propertyId?: string): void {
    const cacheKey = propertyId || 'global';
    taxConfigCache.delete(cacheKey);
    // Also invalidate global cache if property-specific cache is cleared
    if (propertyId) {
      taxConfigCache.delete('global');
    }
    console.log(`[TaxService] Cache invalidated for: ${cacheKey}`);
  }

  /**
   * Invalidate module-related caches (call when modules are updated)
   */
  invalidateModuleCache(moduleId?: string): void {
    if (moduleId) {
      moduleSlugCache.delete(moduleId);
      moduleTaxCategoryCache.delete(moduleId);
      console.log(`[TaxService] Module cache invalidated for: ${moduleId}`);
    } else {
      // Clear all module caches
      moduleSlugCache.clear();
      moduleTaxCategoryCache.clear();
      console.log(`[TaxService] All module caches invalidated`);
    }
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

     // Invalidate cache after update
     this.invalidateCache();
  }
}

export const taxService = new TaxService();

// Export module tax category getter for use in controllers
export { getModuleTaxCategory };
