/**
 * Currency Service Tests
 * 
 * Unit tests for multi-currency support, exchange rates, and conversions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCurrencyService } from '../../src/lib/services/currency.service';
import { InMemoryCurrencyRepository } from '../../src/lib/repositories/currency.repository.memory';
import type { Container } from '../../src/lib/container/types';

describe('CurrencyService', () => {
  let service: ReturnType<typeof createCurrencyService>;
  let currencyRepository: InMemoryCurrencyRepository;

  beforeEach(() => {
    currencyRepository = new InMemoryCurrencyRepository();
    
    const container = {
      currencyRepository,
    } as unknown as Container;
    
    service = createCurrencyService(container);
  });

  // ============================================
  // CREATE CURRENCY TESTS
  // ============================================

  describe('createCurrency', () => {
    it('should create currency with required fields', async () => {
      const result = await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.code).toBe('USD');
      expect(result.data!.name).toBe('US Dollar');
      expect(result.data!.symbol).toBe('$');
      expect(result.data!.decimalPlaces).toBe(2);
      expect(result.data!.isActive).toBe(true);
    });

    it('should set custom decimal places', async () => {
      const result = await service.createCurrency({
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        decimalPlaces: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data!.decimalPlaces).toBe(0);
    });

    it('should uppercase currency code', async () => {
      const result = await service.createCurrency({
        code: 'eur',
        name: 'Euro',
        symbol: '€',
      });

      expect(result.success).toBe(true);
      expect(result.data!.code).toBe('EUR');
    });

    it('should reject invalid currency code', async () => {
      const result = await service.createCurrency({
        code: 'INVALID',
        name: 'Invalid Currency',
        symbol: '?',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid currency code');
    });

    it('should reject empty name', async () => {
      const result = await service.createCurrency({
        code: 'USD',
        name: '',
        symbol: '$',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Currency name is required');
    });

    it('should reject empty symbol', async () => {
      const result = await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Currency symbol is required');
    });

    it('should reject invalid decimal places', async () => {
      const result = await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Decimal places must be between 0 and 4');
    });

    it('should reject duplicate currency', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.createCurrency({
        code: 'USD',
        name: 'US Dollar Again',
        symbol: '$',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Currency already exists');
    });
  });

  // ============================================
  // GET CURRENCY TESTS
  // ============================================

  describe('getCurrency', () => {
    it('should get currency by code', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.getCurrency('USD');

      expect(result.success).toBe(true);
      expect(result.data!.code).toBe('USD');
    });

    it('should get currency case-insensitive', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.getCurrency('usd');

      expect(result.success).toBe(true);
      expect(result.data!.code).toBe('USD');
    });

    it('should reject invalid code', async () => {
      const result = await service.getCurrency('INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid currency code');
    });

    it('should return error for non-existent', async () => {
      const result = await service.getCurrency('EUR');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Currency not found');
    });
  });

  describe('getCurrencies', () => {
    it('should get all active currencies', async () => {
      await service.createCurrency({ code: 'USD', name: 'US Dollar', symbol: '$' });
      await service.createCurrency({ code: 'EUR', name: 'Euro', symbol: '€' });
      await service.createCurrency({ code: 'GBP', name: 'British Pound', symbol: '£' });

      const result = await service.getCurrencies();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });
  });

  // ============================================
  // UPDATE CURRENCY TESTS
  // ============================================

  describe('updateCurrency', () => {
    it('should update currency name', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.updateCurrency('USD', {
        name: 'United States Dollar',
      });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('United States Dollar');
    });

    it('should update currency symbol', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.updateCurrency('USD', {
        symbol: 'US$',
      });

      expect(result.success).toBe(true);
      expect(result.data!.symbol).toBe('US$');
    });

    it('should reject invalid code', async () => {
      const result = await service.updateCurrency('INVALID', { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid currency code');
    });

    it('should reject empty name', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.updateCurrency('USD', {
        name: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Currency name cannot be empty');
    });

    it('should reject empty symbol', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.updateCurrency('USD', {
        symbol: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Currency symbol cannot be empty');
    });
  });

  // ============================================
  // DELETE CURRENCY TESTS
  // ============================================

  describe('deleteCurrency', () => {
    it('should delete currency', async () => {
      await service.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });

      const result = await service.deleteCurrency('USD');

      expect(result.success).toBe(true);

      const getResult = await service.getCurrency('USD');
      expect(getResult.success).toBe(false);
    });

    it('should reject invalid code', async () => {
      const result = await service.deleteCurrency('INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid currency code');
    });
  });

  // ============================================
  // ACTIVATE/DEACTIVATE TESTS
  // ============================================

  describe('activateCurrency', () => {
    it('should activate currency', async () => {
      await service.createCurrency({ code: 'USD', name: 'US Dollar', symbol: '$' });
      await service.deactivateCurrency('USD');

      const result = await service.activateCurrency('USD');

      expect(result.success).toBe(true);
      expect(result.data!.isActive).toBe(true);
    });
  });

  describe('deactivateCurrency', () => {
    it('should deactivate currency', async () => {
      await service.createCurrency({ code: 'USD', name: 'US Dollar', symbol: '$' });

      const result = await service.deactivateCurrency('USD');

      expect(result.success).toBe(true);
      expect(result.data!.isActive).toBe(false);
    });
  });

  // ============================================
  // SET EXCHANGE RATE TESTS
  // ============================================

  describe('setExchangeRate', () => {
    it('should set exchange rate', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      expect(result.success).toBe(true);
      expect(result.data!.baseCurrency).toBe('USD');
      expect(result.data!.targetCurrency).toBe('EUR');
      expect(result.data!.rate).toBe(0.92);
      expect(result.data!.source).toBe('manual');
    });

    it('should set rate with custom source', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
        source: 'api-provider',
      });

      expect(result.success).toBe(true);
      expect(result.data!.source).toBe('api-provider');
    });

    it('should set rate with validity dates', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2026-12-31T23:59:59Z',
      });

      expect(result.success).toBe(true);
      expect(result.data!.validTo).toBe('2026-12-31T23:59:59Z');
    });

    it('should reject invalid base currency', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'INVALID',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid base currency code');
    });

    it('should reject invalid target currency', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'INVALID',
        rate: 0.92,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid target currency code');
    });

    it('should reject same base and target', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'USD',
        rate: 1.0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Base and target currency cannot be the same');
    });

    it('should reject non-positive rate', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Exchange rate must be a positive number');
    });

    it('should reject validTo before validFrom', async () => {
      const result = await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
        validFrom: '2026-12-31T00:00:00Z',
        validTo: '2026-01-01T00:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('validTo must be after validFrom');
    });
  });

  // ============================================
  // GET EXCHANGE RATE TESTS
  // ============================================

  describe('getExchangeRate', () => {
    it('should get exchange rate', async () => {
      await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      const result = await service.getExchangeRate('USD', 'EUR');

      expect(result.success).toBe(true);
      expect(result.data!.rate).toBe(0.92);
    });

    it('should return rate of 1 for same currency', async () => {
      const result = await service.getExchangeRate('USD', 'USD');

      expect(result.success).toBe(true);
      expect(result.data!.rate).toBe(1);
    });

    it('should reject invalid base currency', async () => {
      const result = await service.getExchangeRate('INVALID', 'EUR');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid base currency code');
    });

    it('should reject invalid target currency', async () => {
      const result = await service.getExchangeRate('USD', 'INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid target currency code');
    });

    it('should return error when rate not found', async () => {
      const result = await service.getExchangeRate('USD', 'EUR');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Exchange rate not found');
    });
  });

  describe('getExchangeRates', () => {
    it('should get all rates for base currency', async () => {
      await service.setExchangeRate({ baseCurrency: 'USD', targetCurrency: 'EUR', rate: 0.92 });
      await service.setExchangeRate({ baseCurrency: 'USD', targetCurrency: 'GBP', rate: 0.79 });
      await service.setExchangeRate({ baseCurrency: 'USD', targetCurrency: 'JPY', rate: 149.50 });

      const result = await service.getExchangeRates('USD');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });

    it('should reject invalid currency', async () => {
      const result = await service.getExchangeRates('INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid base currency code');
    });
  });

  // ============================================
  // CONVERT TESTS
  // ============================================

  describe('convert', () => {
    it('should convert currency', async () => {
      await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amount: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.fromAmount).toBe(100);
      expect(result.data!.toAmount).toBe(92);
      expect(result.data!.rate).toBe(0.92);
      expect(result.data!.fee).toBe(0);
    });

    it('should apply fee', async () => {
      await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amount: 100,
        feePercent: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data!.fee).toBe(1.84); // 2% of 92
      expect(result.data!.netAmount).toBe(90.16); // 92 - 1.84
    });

    it('should use custom reference', async () => {
      await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amount: 100,
        reference: 'BOOKING-123',
      });

      expect(result.success).toBe(true);
      expect(result.data!.reference).toBe('BOOKING-123');
    });

    it('should reject invalid source currency', async () => {
      const result = await service.convert({
        fromCurrency: 'INVALID',
        toCurrency: 'EUR',
        amount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid source currency code');
    });

    it('should reject invalid target currency', async () => {
      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'INVALID',
        amount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid target currency code');
    });

    it('should reject non-positive amount', async () => {
      await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount must be a positive number');
    });

    it('should reject invalid fee percent', async () => {
      await service.setExchangeRate({
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      });

      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amount: 100,
        feePercent: 150,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fee percent must be between 0 and 100');
    });

    it('should return error when rate not available', async () => {
      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Exchange rate not');
    });
  });

  // ============================================
  // CONVERSION HISTORY TESTS
  // ============================================

  describe('getConversionHistory', () => {
    it('should get conversion history', async () => {
      await service.setExchangeRate({ baseCurrency: 'USD', targetCurrency: 'EUR', rate: 0.92 });
      await service.convert({ fromCurrency: 'USD', toCurrency: 'EUR', amount: 100 });
      await service.convert({ fromCurrency: 'USD', toCurrency: 'EUR', amount: 200 });

      const result = await service.getConversionHistory();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should filter by currency', async () => {
      await service.setExchangeRate({ baseCurrency: 'USD', targetCurrency: 'EUR', rate: 0.92 });
      await service.setExchangeRate({ baseCurrency: 'USD', targetCurrency: 'GBP', rate: 0.79 });
      await service.convert({ fromCurrency: 'USD', toCurrency: 'EUR', amount: 100 });
      await service.convert({ fromCurrency: 'USD', toCurrency: 'GBP', amount: 100 });

      const result = await service.getConversionHistory({ currency: 'EUR' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should reject invalid currency filter', async () => {
      const result = await service.getConversionHistory({ currency: 'INVALID' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid currency code');
    });

    it('should reject invalid fromDate', async () => {
      const result = await service.getConversionHistory({ fromDate: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid fromDate');
    });

    it('should reject invalid toDate', async () => {
      const result = await service.getConversionHistory({ toDate: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid toDate');
    });
  });

  // ============================================
  // UTILITY FUNCTION TESTS
  // ============================================

  describe('calculateConversion', () => {
    it('should calculate without fee', () => {
      const result = service.calculateConversion(100, 0.92, 0);
      expect(result.grossAmount).toBe(92);
      expect(result.fee).toBe(0);
      expect(result.netAmount).toBe(92);
    });

    it('should calculate with fee', () => {
      const result = service.calculateConversion(100, 0.92, 2);
      expect(result.grossAmount).toBe(92);
      expect(result.fee).toBe(1.84);
      expect(result.netAmount).toBe(90.16);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD', () => {
      const result = service.formatCurrency(1234.56, 'USD');
      expect(result).toContain('1,234.56');
    });

    it('should format EUR', () => {
      const result = service.formatCurrency(1234.56, 'EUR');
      expect(result).toContain('1,234.56');
    });

    it('should handle unknown currency', () => {
      const result = service.formatCurrency(100, 'XYZ');
      expect(result).toContain('XYZ');
    });
  });

  describe('roundToDecimalPlaces', () => {
    it('should round to 2 decimal places', () => {
      expect(service.roundToDecimalPlaces(1.234, 2)).toBe(1.23);
      expect(service.roundToDecimalPlaces(1.235, 2)).toBe(1.24);
    });

    it('should round to 0 decimal places', () => {
      expect(service.roundToDecimalPlaces(1.5, 0)).toBe(2);
    });

    it('should round to 4 decimal places', () => {
      expect(service.roundToDecimalPlaces(1.23456, 4)).toBe(1.2346);
    });
  });

  describe('getCommonCurrencies', () => {
    it('should return common currencies', () => {
      const currencies = service.getCommonCurrencies();
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
      expect(currencies.length).toBeGreaterThan(20);
    });
  });

  describe('getCurrencySymbol', () => {
    it('should get USD symbol', () => {
      expect(service.getCurrencySymbol('USD')).toBe('$');
    });

    it('should get EUR symbol', () => {
      expect(service.getCurrencySymbol('EUR')).toBe('€');
    });

    it('should get GBP symbol', () => {
      expect(service.getCurrencySymbol('GBP')).toBe('£');
    });

    it('should return code for unknown', () => {
      expect(service.getCurrencySymbol('XYZ')).toBe('XYZ');
    });
  });

  describe('getInverseRate', () => {
    it('should calculate inverse rate', () => {
      expect(service.getInverseRate(0.92)).toBeCloseTo(1.086957, 5);
    });

    it('should return 0 for zero rate', () => {
      expect(service.getInverseRate(0)).toBe(0);
    });
  });

  describe('calculateCrossRate', () => {
    it('should calculate cross rate', () => {
      // USD/EUR = 0.92, EUR/GBP = 0.86
      // USD/GBP = 0.92 * 0.86 = 0.7912
      const result = service.calculateCrossRate(0.92, 0.86);
      expect(result).toBeCloseTo(0.7912, 4);
    });
  });

  describe('isVolatileRate', () => {
    it('should detect volatile rate', () => {
      expect(service.isVolatileRate(1.10, 1.00, 5)).toBe(true);
    });

    it('should not detect stable rate', () => {
      expect(service.isVolatileRate(1.02, 1.00, 5)).toBe(false);
    });

    it('should handle zero previous rate', () => {
      expect(service.isVolatileRate(1.10, 0, 5)).toBe(false);
    });
  });
});
