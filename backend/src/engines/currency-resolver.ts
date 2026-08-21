/**
 * Currency resolution for Engine A.
 *
 * Every monetary record must carry an explicit currency (DOMAIN.md F2). This
 * module resolves the authoritative currency for a commercial operation, in
 * strict order:
 *
 *   1. module-level currency configuration (future-proofing — none exists yet)
 *   2. the owning property's configured currency (`properties.currency`)
 *   3. platform default currency (`site_settings.default_currency`)
 *   4. hard platform fallback (`MONEY_DEFAULT_CURRENCY` env, default EUR)
 *
 * The resolution result is passed explicitly into the pricing pipeline and
 * ledger; those layers never default silently themselves.
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { validateCurrency, type Currency } from './money.js';

export const PLATFORM_DEFAULT_CURRENCY: Currency = (process.env.MONEY_DEFAULT_CURRENCY || 'EUR').toUpperCase();

/**
 * Resolve a property's configured currency. Returns null when the property is
 * unknown or has no currency configured (caller falls back to platform default).
 */
export async function resolvePropertyCurrency(
  propertyId?: string | null,
): Promise<Currency | null> {
  if (!propertyId) return null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('properties')
      .select('currency')
      .eq('id', propertyId)
      .maybeSingle();
    if (error) {
      logger.warn('[CurrencyResolver] Failed to read property currency', {
        propertyId,
        error: error.message,
      });
      return null;
    }
    const currency = data?.currency as string | undefined;
    if (currency && /^[A-Za-z]{3}$/.test(currency)) {
      return currency.toUpperCase();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the platform default currency from site_settings, falling back to
 * the environment-configured default.
 */
export async function resolvePlatformDefaultCurrency(): Promise<Currency> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'default_currency')
      .maybeSingle();
    if (!error && data?.value && /^[A-Za-z]{3}$/.test(String(data.value))) {
      return String(data.value).toUpperCase();
    }
  } catch (err) {
    logger.warn('[CurrencyResolver] Failed to read platform default currency', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return PLATFORM_DEFAULT_CURRENCY;
}

/**
 * Resolve the authoritative currency for a module operation. Always returns a
 * valid 3-letter code — never silently defaults inside pricing/ledger.
 */
export async function resolveModuleCurrency(
  moduleId?: string | null,
  propertyId?: string | null,
): Promise<Currency> {
  // 1. Module-level override (reserved — modules table has no currency column yet).
  // 2. Property currency.
  const propertyCurrency = await resolvePropertyCurrency(propertyId);
  if (propertyCurrency) return propertyCurrency;
  // 3. Platform default.
  const platformDefault = await resolvePlatformDefaultCurrency();
  validateCurrency(platformDefault);
  return platformDefault;
}

/**
 * Synchronous validation helper for values already resolved at the edge
 * (e.g. currency from a request body). Throws on invalid codes.
 */
export function assertValidCurrency(currency: unknown): asserts currency is Currency {
  validateCurrency(currency);
}
