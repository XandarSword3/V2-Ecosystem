/**
 * Currency resolution — FAILS CLOSED (DOMAIN.md F2 / hardening point 5-6).
 *
 * Resolution order: module override (reserved) → property currency →
 * platform default (site_settings → MONEY_DEFAULT_CURRENCY). Every failure
 * mode — missing config, DB error, invalid value — THROWS. There is no
 * implicit EUR/USD fallback anywhere.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type TableResult = { data: Record<string, unknown> | null; error: { message: string } | null };

const tableResults = new Map<string, TableResult>();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    const target = { table: '', selectArgs: [] as string[] };
    const runner = () => {
      const result = tableResults.get(target.table) ?? { data: null, error: null };
      return Promise.resolve(result);
    };
    (chain as Record<string, unknown>).from = (table: string) => {
      target.table = table;
      return chain;
    };
    (chain as Record<string, unknown>).select = (...args: string[]) => {
      target.selectArgs = args;
      return chain;
    };
    (chain as Record<string, unknown>).eq = () => chain;
    (chain as Record<string, unknown>).maybeSingle = runner;
    return chain;
  }),
}));

import {
  CurrencyResolutionError,
  configuredPlatformDefaultCurrency,
  resolveModuleCurrency,
  resolvePlatformDefaultCurrency,
  resolvePropertyCurrency,
} from '../../../src/engines/currency-resolver.js';
import { InvalidCurrencyError } from '../../../src/engines/money.js';

describe('currency resolution — fails closed', () => {
  beforeEach(() => {
    tableResults.clear();
    delete process.env.MONEY_DEFAULT_CURRENCY;
  });

  afterEach(() => {
    delete process.env.MONEY_DEFAULT_CURRENCY;
  });

  it('resolves the property currency when configured', async () => {
    tableResults.set('properties', { data: { currency: 'eur' }, error: null });
    expect(await resolvePropertyCurrency('prop-1')).toBe('EUR');
  });

  it('resolves the platform default from site_settings', async () => {
    tableResults.set('site_settings', { data: { value: 'USD' }, error: null });
    expect(await resolvePlatformDefaultCurrency()).toBe('USD');
  });

  it('resolves the platform default from env when site_settings is empty', async () => {
    process.env.MONEY_DEFAULT_CURRENCY = 'EUR';
    expect(await resolvePlatformDefaultCurrency()).toBe('EUR');
  });

  it('THROWS when no default currency is configured anywhere — never a silent EUR', async () => {
    // No site_settings row, no env default.
    await expect(resolvePlatformDefaultCurrency()).rejects.toThrow(CurrencyResolutionError);
    await expect(resolveModuleCurrency('mod-1', 'prop-1')).rejects.toThrow(CurrencyResolutionError);
  });

  it('THROWS on a DB error instead of defaulting', async () => {
    tableResults.set('properties', { data: null, error: { message: 'connection refused' } });
    await expect(resolvePropertyCurrency('prop-1')).rejects.toThrow(CurrencyResolutionError);
  });

  it('THROWS on a semantically invalid configured currency', async () => {
    tableResults.set('properties', { data: { currency: 'ZZZ' }, error: null });
    await expect(resolvePropertyCurrency('prop-1')).rejects.toThrow(InvalidCurrencyError);
    tableResults.set('site_settings', { data: { value: 'abc' }, error: null });
    await expect(resolvePlatformDefaultCurrency()).rejects.toThrow(InvalidCurrencyError);
  });

  it('THROWS on a malformed env default', () => {
    process.env.MONEY_DEFAULT_CURRENCY = 'eur'; // lowercase is not a valid code
    expect(() => configuredPlatformDefaultCurrency()).toThrow(InvalidCurrencyError);
    process.env.MONEY_DEFAULT_CURRENCY = 'ZZZ';
    expect(() => configuredPlatformDefaultCurrency()).toThrow(InvalidCurrencyError);
  });

  it('returns null for an unknown property id (caller decides), but never invents a currency', async () => {
    expect(await resolvePropertyCurrency(undefined)).toBeNull();
    expect(await resolvePropertyCurrency(null)).toBeNull();
  });
});
