/**
 * Currency resolution for Engine A — FAILS CLOSED.
 *
 * Every monetary record must carry an explicit, semantically valid currency
 * (DOMAIN.md F2). Resolution is strict and loud:
 *
 *   1. module-level currency configuration (reserved — none exists yet)
 *   2. the owning property's configured currency (`properties.currency`)
 *   3. the platform default currency (`site_settings.default_currency`)
 *   4. the hard platform default (`MONEY_DEFAULT_CURRENCY` env)
 *
 * There is NO implicit fallback: if configuration is missing OR a lookup
 * fails (DB error, invalid value), an exception is thrown rather than
 * silently assuming EUR/USD. The pricing pipeline and ledger never default
 * themselves — they require the value this resolver produces.
 */
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { validateCurrency, type Currency } from './money.js';

export class CurrencyResolutionError extends Error {
  public readonly code = 'CURRENCY_RESOLUTION_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'CurrencyResolutionError';
  }
}

/**
 * Hard platform default configured by the operator via env. Absent by design
 * when unset — callers must not invent a currency.
 */
export function configuredPlatformDefaultCurrency(): Currency | null {
  const raw = process.env.MONEY_DEFAULT_CURRENCY;
  if (!raw) return null;
  validateCurrency(raw);
  return raw.toUpperCase();
}

/**
 * Resolve a property's configured currency. Returns null ONLY when the
 * property is genuinely unknown/unconfigured — any lookup error THROWS
 * (fail closed). The returned value is semantically validated.
 */
export async function resolvePropertyCurrency(
  propertyId?: string | null,
): Promise<Currency | null> {
  if (!propertyId) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('properties')
    .select('currency')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) {
    throw new CurrencyResolutionError(
      `Failed to resolve currency for property ${propertyId}: ${error.message}`,
    );
  }
  const currency = data?.currency as string | undefined;
  if (!currency) return null;
  validateCurrency(currency.toUpperCase());
  return currency.toUpperCase();
}

/**
 * Resolve the platform default currency from site_settings, then the env
 * default. Any error or missing configuration THROWS — never a silent EUR.
 */
export async function resolvePlatformDefaultCurrency(): Promise<Currency> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'default_currency')
    .maybeSingle();
  if (error) {
    throw new CurrencyResolutionError(
      `Failed to resolve platform default currency: ${error.message}`,
    );
  }
  if (data?.value && typeof data.value === 'string' && /^[A-Za-z]{3}$/.test(data.value)) {
    validateCurrency(data.value.toUpperCase());
    return data.value.toUpperCase();
  }
  const envDefault = configuredPlatformDefaultCurrency();
  if (!envDefault) {
    throw new CurrencyResolutionError(
      'No platform default currency configured (site_settings.default_currency or MONEY_DEFAULT_CURRENCY)',
    );
  }
  return envDefault;
}

/**
 * Resolve the authoritative TRANSACTION currency for a module operation.
 * Fail closed: missing or erroneous configuration throws instead of defaulting.
 */
export async function resolveModuleCurrency(
  moduleId?: string | null,
  propertyId?: string | null,
): Promise<Currency> {
  // 1. Module-level override (reserved — modules table has no currency column yet).
  // 2. Property currency.
  const propertyCurrency = await resolvePropertyCurrency(propertyId);
  if (propertyCurrency) return propertyCurrency;
  // 3. Platform default (site_settings → env) — throws when absent.
  return resolvePlatformDefaultCurrency();
}

/** Synchronous validation helper for values already resolved at the edge. */
export function assertValidCurrency(currency: unknown): asserts currency is Currency {
  validateCurrency(currency);
}
