/**
 * Exchange-rate service — the ONLY way to read and record exchange rates.
 *
 * Rates are immutable FACTS (DOMAIN.md F3 / plan Phase 6):
 *   - `exchange_rates` rows are append-only (DB triggers block UPDATE/DELETE).
 *   - a correction is a NEW row with a newer as_of — history is preserved so
 *     conversions can always be replayed and reconciled.
 *   - conversion APIs consume a `fact` (never an arbitrary number).
 */
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import {
  MissingExchangeRateFactError,
  rationalFromDecimal,
  validateCurrency,
  type ExchangeRateFact,
  type Currency,
} from '../engines/money.js';

export class ExchangeRateServiceError extends Error {
  public readonly code = 'EXCHANGE_RATE_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'ExchangeRateServiceError';
  }
}

function mapRow(row: Record<string, unknown>): ExchangeRateFact {
  return {
    fromCurrency: String(row.from_currency).toUpperCase(),
    toCurrency: String(row.to_currency).toUpperCase(),
    // numeric columns arrive as strings from PostgREST — parse exactly.
    rate: rationalFromDecimal(String(row.rate)),
    asOf: String(row.as_of),
    provider: String(row.provider),
    source: row.source ? String(row.source) : null,
  };
}

export class ExchangeRateService {
  /**
   * Load the latest immutable fact for a pair (as-of newest first).
   * Throws MissingExchangeRateFactError when none exists — conversion is
   * never allowed to invent a rate.
   */
  async getFact(fromCurrency: Currency, toCurrency: Currency): Promise<ExchangeRateFact> {
    validateCurrency(fromCurrency);
    validateCurrency(toCurrency);
    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        rate: rationalFromDecimal('1'),
        asOf: new Date(0).toISOString(),
        provider: 'identity',
      };
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ExchangeRateServiceError(`Failed to load exchange rate: ${error.message}`);
    if (!data) throw new MissingExchangeRateFactError(fromCurrency, toCurrency);
    return mapRow(data);
  }

  /** Load the latest fact as of a specific time (reproducibility). */
  async getFactAsOf(
    fromCurrency: Currency,
    toCurrency: Currency,
    asOf: string,
  ): Promise<ExchangeRateFact> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .lte('as_of', asOf)
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ExchangeRateServiceError(`Failed to load exchange rate as of ${asOf}: ${error.message}`);
    if (!data) throw new MissingExchangeRateFactError(fromCurrency, toCurrency);
    return mapRow(data);
  }

  /**
   * Record a NEW fact (append-only — the DB blocks UPDATE/DELETE).
   * `rate` is a decimal string, parsed exactly.
   */
  async recordFact(params: {
    fromCurrency: Currency;
    toCurrency: Currency;
    rate: string; // decimal string, e.g. "1.08" or "0.9255"
    asOf?: string;
    provider?: string;
    source?: string | null;
  }): Promise<ExchangeRateFact> {
    validateCurrency(params.fromCurrency);
    validateCurrency(params.toCurrency);
    const rate = rationalFromDecimal(params.rate); // validate parseability
    if (rate.n <= 0n) throw new ExchangeRateServiceError('Exchange rate must be positive');

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('exchange_rates')
      .insert({
        from_currency: params.fromCurrency,
        to_currency: params.toCurrency,
        rate: params.rate, // stored as-is (numeric(18,10) column)
        as_of: params.asOf ?? new Date().toISOString(),
        provider: params.provider ?? 'manual',
        source: params.source ?? null,
      })
      .select()
      .single();
    if (error) throw new ExchangeRateServiceError(`Failed to record exchange rate: ${error.message}`);

    logger.info('[ExchangeRate] Fact recorded', {
      from: params.fromCurrency,
      to: params.toCurrency,
      rate: params.rate,
      provider: params.provider ?? 'manual',
    });
    return mapRow(data);
  }
}

export const exchangeRateService = new ExchangeRateService();
