/**
 * Exchange-rate service — immutable FACTS only (hardening points 3-4).
 *
 *   - conversions require an immutable fact row (append-only at the DB level);
 *   - a missing fact THROWS MissingExchangeRateFactError — no invented rates;
 *   - rates are parsed from decimal strings exactly (never float multiplication);
 *   - recordFact rejects non-positive / unparseable rates.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type TableResult = { data: Record<string, unknown> | null; error: { message: string } | null };
const tableResults = new Map<string, TableResult>();
const insertCalls: Array<Record<string, unknown>> = [];

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    const target = { table: '', mode: 'select' };
    const runner = () => {
      if (target.mode === 'insert') {
        const error = tableResults.get('__insert_error__')?.error;
        if (error) return Promise.resolve({ data: null, error });
        return Promise.resolve({ data: insertCalls.at(-1) ?? null, error: null });
      }
      const result = tableResults.get(target.table) ?? { data: null, error: null };
      return Promise.resolve(result);
    };
    (chain as Record<string, unknown>).from = (table: string) => {
      target.table = table;
      return chain;
    };
    (chain as Record<string, unknown>).select = (..._args: string[]) => chain;
    (chain as Record<string, unknown>).eq = () => chain;
    (chain as Record<string, unknown>).lte = () => chain;
    (chain as Record<string, unknown>).order = () => chain;
    (chain as Record<string, unknown>).limit = () => chain;
    (chain as Record<string, unknown>).maybeSingle = runner;
    (chain as Record<string, unknown>).insert = (rows: unknown) => {
      target.mode = 'insert';
      insertCalls.push(Array.isArray(rows) ? (rows[0] as Record<string, unknown>) : (rows as Record<string, unknown>));
      return chain;
    };
    (chain as Record<string, unknown>).single = runner;
    return chain;
  }),
}));

import { ExchangeRateService } from '../../../src/services/exchange-rate.service.js';
import { MissingExchangeRateFactError, rationalEqual, rationalFromDecimal } from '../../../src/engines/money.js';

const service = new ExchangeRateService();

const FACT_ROW = {
  from_currency: 'USD',
  to_currency: 'EUR',
  rate: '0.9255',
  as_of: '2026-08-20T00:00:00Z',
  provider: 'test',
  source: null,
};

describe('ExchangeRateService — immutable facts', () => {
  beforeEach(() => {
    tableResults.clear();
    insertCalls.length = 0;
  });

  it('loads the latest fact and parses the rate EXACTLY (0.9255 → 9255/10000)', async () => {
    tableResults.set('exchange_rates', { data: FACT_ROW, error: null });
    const fact = await service.getFact('USD', 'EUR');
    expect(fact.fromCurrency).toBe('USD');
    expect(fact.toCurrency).toBe('EUR');
    expect(rationalEqual(fact.rate, rationalFromDecimal('0.9255'))).toBe(true);
    expect(fact.rate.n).toBe(9255n);
    expect(fact.rate.d).toBe(10000n);
  });

  it('returns an identity fact for the same currency without touching the DB', async () => {
    const fact = await service.getFact('EUR', 'EUR');
    expect(fact.provider).toBe('identity');
    expect(rationalEqual(fact.rate, rationalFromDecimal('1'))).toBe(true);
  });

  it('THROWS MissingExchangeRateFactError when no fact exists — never invents a rate', async () => {
    tableResults.set('exchange_rates', { data: null, error: null });
    await expect(service.getFact('USD', 'JPY')).rejects.toThrow(MissingExchangeRateFactError);
  });

  it('THROWS on a DB read error', async () => {
    tableResults.set('exchange_rates', { data: null, error: { message: 'timeout' } });
    await expect(service.getFact('USD', 'EUR')).rejects.toThrow(/Failed to load exchange rate/);
  });

  it('loads the fact as of a specific time (reproducibility)', async () => {
    tableResults.set('exchange_rates', { data: FACT_ROW, error: null });
    const fact = await service.getFactAsOf('USD', 'EUR', '2026-08-21T00:00:00Z');
    expect(rationalEqual(fact.rate, rationalFromDecimal('0.9255'))).toBe(true);
  });

  it('records a new fact (append-only) and rejects non-positive rates', async () => {
    const fact = await service.recordFact({ fromCurrency: 'USD', toCurrency: 'EUR', rate: '1.08' });
    expect(fact.provider).toBe('manual');
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].rate).toBe('1.08');

    await expect(service.recordFact({ fromCurrency: 'USD', toCurrency: 'EUR', rate: '0' })).rejects.toThrow(/must be positive/);
    await expect(service.recordFact({ fromCurrency: 'USD', toCurrency: 'EUR', rate: '-1.5' })).rejects.toThrow(/must be positive/);
    await expect(service.recordFact({ fromCurrency: 'USD', toCurrency: 'EUR', rate: 'abc' })).rejects.toThrow(/Cannot parse rate/);
  });

  it('THROWS on an insert error instead of silently succeeding', async () => {
    tableResults.set('__insert_error__', { data: null, error: { message: 'permission denied' } });
    await expect(service.recordFact({ fromCurrency: 'USD', toCurrency: 'EUR', rate: '1.08' })).rejects.toThrow(/Failed to record exchange rate/);
  });
});
