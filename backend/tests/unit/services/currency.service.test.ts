import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
const mockSupabaseResponse = {
  data: null,
  error: null,
};

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
          })),
          order: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
          single: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
        })),
        order: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
        single: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve(mockSupabaseResponse)),
    })),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

// Import after mocks
import { currencyService } from '../../../src/services/currency.service';
import { supabase } from '../../../src/lib/supabase';

describe('CurrencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    (global.fetch as any).mockReset();
  });

  describe('getActiveCurrencies', () => {
    it('should return active currencies', async () => {
      const mockCurrencies = [
        { code: 'EUR', symbol: '€', name: 'Euro', exchange_rate: 1, is_active: true },
        { code: 'USD', symbol: '$', name: 'US Dollar', exchange_rate: 1.08, is_active: true },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockCurrencies, error: null }),
          }),
        }),
      } as any);

      const result = await currencyService.getActiveCurrencies();

      expect(result).toEqual(mockCurrencies);
      expect(supabase.from).toHaveBeenCalledWith('currencies');
    });

    it('should throw on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
          }),
        }),
      } as any);

      await expect(currencyService.getActiveCurrencies()).rejects.toThrow();
    });
  });

  describe('getCurrency', () => {
    it('should return currency by code', async () => {
      const mockCurrency = { code: 'EUR', symbol: '€', exchange_rate: 1 };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockCurrency, error: null }),
          }),
        }),
      } as any);

      const result = await currencyService.getCurrency('eur');

      expect(result).toEqual(mockCurrency);
    });

    it('should return null on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      } as any);

      const result = await currencyService.getCurrency('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('getDefaultCurrency', () => {
    it('should return default currency from settings', async () => {
      const mockCurrency = { code: 'EUR', symbol: '€', exchange_rate: 1 };

      // First call for site_settings
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { value: 'EUR' }, error: null }),
            }),
          }),
        } as any)
        // Second call for currencies
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCurrency, error: null }),
            }),
          }),
        } as any);

      const result = await currencyService.getDefaultCurrency();

      expect(result).toEqual(mockCurrency);
    });

    it('should throw if default currency not found', async () => {
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { value: 'UNKNOWN' }, error: null }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
            }),
          }),
        } as any);

      await expect(currencyService.getDefaultCurrency()).rejects.toThrow('Default currency UNKNOWN not found');
    });
  });

  describe('convert', () => {
    it('should return same amount for same currency', async () => {
      const result = await currencyService.convert(100, 'EUR', 'EUR');

      expect(result.original_amount).toBe(100);
      expect(result.converted_amount).toBe(100);
      expect(result.exchange_rate).toBe(1);
      expect(result.original_currency).toBe('EUR');
      expect(result.target_currency).toBe('EUR');
    });

    it('should convert between currencies', async () => {
      // Mock exchange rates
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { exchange_rate: 1 }, error: null }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { exchange_rate: 1.08 }, error: null }),
            }),
          }),
        } as any);

      const result = await currencyService.convert(100, 'EUR', 'USD');

      expect(result.original_amount).toBe(100);
      expect(result.converted_amount).toBe(108);
      expect(result.exchange_rate).toBe(1.08);
    });

    it('should handle case insensitive currency codes', async () => {
      const result = await currencyService.convert(100, 'eur', 'eur');

      expect(result.original_currency).toBe('EUR');
      expect(result.target_currency).toBe('EUR');
    });
  });

  describe('getExchangeRate', () => {
    it('should return rate from database', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { exchange_rate: 1.08 }, error: null }),
          }),
        }),
      } as any);

      const rate = await currencyService.getExchangeRate('USD');

      expect(rate).toBe(1.08);
    });

    it('should throw if rate not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      } as any);

      await expect(currencyService.getExchangeRate('INVALID')).rejects.toThrow(
        'Exchange rate not found for INVALID'
      );
    });
  });

  describe('updateExchangeRate', () => {
    it('should update rate and clear cache', async () => {
      const updatedCurrency = { code: 'USD', exchange_rate: 1.10 };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedCurrency, error: null }),
            }),
          }),
        }),
      } as any);

      const result = await currencyService.updateExchangeRate('usd', 1.10);

      expect(result).toEqual(updatedCurrency);
    });

    it('should throw on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('Update failed') }),
            }),
          }),
        }),
      } as any);

      await expect(currencyService.updateExchangeRate('USD', 1.10)).rejects.toThrow();
    });
  });

  describe('formatAmount', () => {
    it('should format EUR amount', () => {
      const formatted = currencyService.formatAmount(100, 'EUR', 'de-DE');
      expect(formatted).toContain('100');
    });

    it('should format USD amount', () => {
      const formatted = currencyService.formatAmount(100, 'USD', 'en-US');
      expect(formatted).toContain('100');
      expect(formatted).toContain('$');
    });

    it('should use default locale', () => {
      const formatted = currencyService.formatAmount(100, 'EUR');
      expect(formatted).toContain('100');
    });
  });

  describe('getStripeCurrency', () => {
    it('should return lowercase currency code', () => {
      expect(currencyService.getStripeCurrency('EUR')).toBe('eur');
      expect(currencyService.getStripeCurrency('USD')).toBe('usd');
    });
  });

  describe('toStripeAmount', () => {
    it('should convert to cents for 2 decimal currencies', () => {
      expect(currencyService.toStripeAmount(100, 'EUR')).toBe(10000);
      expect(currencyService.toStripeAmount(10.50, 'USD')).toBe(1050);
    });

    it('should handle 3 decimal currencies (KWD)', () => {
      expect(currencyService.toStripeAmount(10, 'KWD')).toBe(10000);
    });

    it('should round properly', () => {
      expect(currencyService.toStripeAmount(10.999, 'EUR')).toBe(1100);
    });
  });

  describe('fromStripeAmount', () => {
    it('should convert from cents for 2 decimal currencies', () => {
      expect(currencyService.fromStripeAmount(10000, 'EUR')).toBe(100);
      expect(currencyService.fromStripeAmount(1050, 'USD')).toBe(10.50);
    });

    it('should handle 3 decimal currencies (KWD)', () => {
      expect(currencyService.fromStripeAmount(10000, 'KWD')).toBe(10);
    });
  });

  describe('isStripeSupportedCurrency', () => {
    it('should return true for supported currencies', () => {
      expect(currencyService.isStripeSupportedCurrency('EUR')).toBe(true);
      expect(currencyService.isStripeSupportedCurrency('USD')).toBe(true);
      expect(currencyService.isStripeSupportedCurrency('GBP')).toBe(true);
    });

    it('should return false for unsupported currencies', () => {
      expect(currencyService.isStripeSupportedCurrency('FAKE')).toBe(false);
      expect(currencyService.isStripeSupportedCurrency('XYZ')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(currencyService.isStripeSupportedCurrency('eur')).toBe(true);
      expect(currencyService.isStripeSupportedCurrency('usd')).toBe(true);
    });
  });

  describe('getMultiCurrencyPrices', () => {
    beforeEach(() => {
      // Mock for each currency conversion
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { exchange_rate: 1 }, error: null }),
          }),
        }),
      } as any);
    });

    it('should return prices in multiple currencies', async () => {
      const result = await currencyService.getMultiCurrencyPrices(100, 'EUR', ['EUR', 'USD']);

      expect(result).toHaveProperty('EUR');
      expect(result).toHaveProperty('USD');
      expect(result.EUR).toHaveProperty('amount');
      expect(result.EUR).toHaveProperty('formatted');
    });
  });
});
