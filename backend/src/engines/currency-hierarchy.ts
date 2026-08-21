/**
 * Currency hierarchy — the explicit, enforced role of every currency in the
 * system (DOMAIN.md F2 / plan Phase 6):
 *
 *   TRANSACTION currency  — what the customer pays in (module/property config).
 *   SETTLEMENT  currency  — what the business settles/tenders in
 *                           (property config; defaults to transaction currency).
 *   ACCOUNTING  currency  — reporting/books currency (platform config;
 *                           defaults to settlement currency).
 *
 * Enforcement:
 *   - ledger entries and fiscal documents carry the TRANSACTION currency.
 *   - any conversion between layers must consume an immutable exchange-rate
 *     fact (never an arbitrary number).
 *   - resolution FAILS CLOSED — no implicit EUR/USD anywhere.
 */
import { resolveModuleCurrency, resolvePlatformDefaultCurrency } from './currency-resolver.js';
import { getSupabase } from '../database/connection.js';
import { validateCurrency, type Currency } from './money.js';

export interface CurrencyHierarchy {
  transaction: Currency;   // what the customer pays
  settlement: Currency;    // what the business tenders/settles
  accounting: Currency;    // books & reporting
}

export class CurrencyHierarchyError extends Error {
  public readonly code = 'CURRENCY_HIERARCHY_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'CurrencyHierarchyError';
  }
}

/**
 * Resolve the full hierarchy for a commercial operation. Transaction currency
 * comes from the module/property (fail closed); settlement from the property's
 * configured currency (defaults to transaction); accounting from platform
 * config (defaults to settlement).
 */
export async function resolveCurrencyHierarchy(
  tenantId: string,
  propertyId?: string | null,
  moduleId?: string | null,
): Promise<CurrencyHierarchy> {
  const transaction = await resolveModuleCurrency(moduleId, propertyId);

  // Settlement: property.currency (may be set even when module resolution
  // chose the platform default), else transaction currency.
  let settlement: Currency = transaction;
  if (propertyId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('properties')
      .select('currency')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) {
      throw new CurrencyHierarchyError(
        `Failed to resolve settlement currency for property ${propertyId}: ${error.message}`,
      );
    }
    if (data?.currency) {
      validateCurrency(String(data.currency).toUpperCase());
      settlement = String(data.currency).toUpperCase();
    }
  }

  // Accounting: site_settings.accounting_currency, else settlement.
  let accounting: Currency = settlement;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'accounting_currency')
    .maybeSingle();
  if (error) {
    throw new CurrencyHierarchyError(
      `Failed to resolve accounting currency: ${error.message}`,
    );
  }
  if (data?.value && typeof data.value === 'string' && /^[A-Za-z]{3}$/.test(data.value)) {
    validateCurrency(data.value.toUpperCase());
    accounting = data.value.toUpperCase();
  }

  return { transaction, settlement, accounting };
}

export { resolvePlatformDefaultCurrency };
