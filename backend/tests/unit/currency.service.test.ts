/**
 * Currency Service Tests
 *
 * Rewired to test src/services/currency.service.ts (post-Engine-Refit singleton).
 * Pure-function tests need no mock; DB-dependent tests mock database/connection.
 */


// ── DB mock must be declared before the service import ──────────────────────
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

const mockChain = {
  from: mockFrom,
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  update: mockUpdate,
  insert: mockInsert,
  filter: vi.fn(),
  order: vi.fn(),
};

// Every chainable method returns the same object so arbitrary chains work.
Object.keys(mockChain).forEach((k) => {
  (mockChain as any)[k].mockReturnValue(mockChain);
});

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockChain),
}));

import { currencyService } from '../../src/services/currency.service.js';

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply chain returns after clearAllMocks
  Object.keys(mockChain).forEach((k) => {
    (mockChain as any)[k].mockReturnValue(mockChain);
  });
});

// ── Pure utility functions ────────────────────────────────────────────────────

describe('getStripeCurrency', () => {
  it('should lowercase the code', () => {
    expect(currencyService.getStripeCurrency('EUR')).toBe('eur');
    expect(currencyService.getStripeCurrency('USD')).toBe('usd');
    expect(currencyService.getStripeCurrency('GBP')).toBe('gbp');
  });
});

describe('toStripeAmount', () => {
  it('converts EUR (2 dp) to cents', () => {
    expect(currencyService.toStripeAmount(10.5, 'EUR')).toBe(1050);
  });

  it('converts KWD (3 dp) to fils', () => {
    expect(currencyService.toStripeAmount(10.5, 'KWD')).toBe(10500);
  });

  it('rounds fractional cents', () => {
    expect(currencyService.toStripeAmount(10.999, 'USD')).toBe(1100);
  });
});

describe('fromStripeAmount', () => {
  it('converts cents to EUR', () => {
    expect(currencyService.fromStripeAmount(1050, 'EUR')).toBe(10.5);
  });

  it('converts fils to KWD', () => {
    expect(currencyService.fromStripeAmount(10500, 'KWD')).toBe(10.5);
  });
});

describe('isStripeSupportedCurrency', () => {
  it('accepts known currencies', () => {
    expect(currencyService.isStripeSupportedCurrency('USD')).toBe(true);
    expect(currencyService.isStripeSupportedCurrency('EUR')).toBe(true);
    expect(currencyService.isStripeSupportedCurrency('GBP')).toBe(true);
  });

  it('rejects unknown currencies', () => {
    expect(currencyService.isStripeSupportedCurrency('XYZ')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(currencyService.isStripeSupportedCurrency('usd')).toBe(true);
  });
});

describe('formatAmount', () => {
  it('formats USD', () => {
    const formatted = currencyService.formatAmount(1234.56, 'USD', 'en-US');
    expect(formatted).toContain('1,234.56');
  });

  it('formats EUR', () => {
    const formatted = currencyService.formatAmount(100, 'EUR', 'en-US');
    expect(formatted).toContain('100');
  });

  it('defaults locale to en-US when omitted', () => {
    const formatted = currencyService.formatAmount(100, 'USD');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

// ── DB-dependent methods ──────────────────────────────────────────────────────

describe('getExchangeRate', () => {
  it('returns the rate from the database', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { exchange_rate: 1.08 }, error: null });

    const rate = await currencyService.getExchangeRate('USD');
    expect(rate).toBe(1.08);
    expect(mockChain.from).toHaveBeenCalledWith('currencies');
  });

  it('throws when currency is not found', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    await expect(currencyService.getExchangeRate('XYZ')).rejects.toThrow('Exchange rate not found for XYZ');
  });
});

describe('getActiveCurrencies', () => {
  it('returns the active currency list', async () => {
    const fakeRows = [
      { code: 'EUR', symbol: '€', exchange_rate: 1, is_active: true, is_default: true },
      { code: 'USD', symbol: '$', exchange_rate: 1.08, is_active: true, is_default: false },
    ];
    // Override order() to resolve with data
    mockChain.order.mockResolvedValueOnce({ data: fakeRows, error: null });

    const result = await currencyService.getActiveCurrencies();
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('EUR');
  });

  it('returns empty array when no active currencies', async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await currencyService.getActiveCurrencies();
    expect(result).toEqual([]);
  });
});

describe('convert', () => {
  it('returns identical amounts when currencies match', async () => {
    const result = await currencyService.convert(100, 'USD', 'USD');
    expect(result.converted_amount).toBe(100);
    expect(result.exchange_rate).toBe(1);
  });

  it('converts correctly using two DB rate lookups', async () => {
    // First call: fromRate (USD → 1.08), second call: toRate (EUR → 1.0)
    mockChain.single
      .mockResolvedValueOnce({ data: { exchange_rate: 1.08 }, error: null }) // USD rate
      .mockResolvedValueOnce({ data: { exchange_rate: 1.0 }, error: null }); // EUR rate

    const result = await currencyService.convert(108, 'USD', 'EUR');
    // 108 / 1.08 = 100 default units, 100 * 1.0 = 100 EUR
    expect(result.converted_amount).toBe(100);
    expect(result.original_amount).toBe(108);
    expect(result.original_currency).toBe('USD');
    expect(result.target_currency).toBe('EUR');
  });

  it('throws when exchange rate is unavailable', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    await expect(currencyService.convert(100, 'USD', 'EUR')).rejects.toThrow();
  });
});
