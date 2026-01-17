/**
 * Currency Service
 * 
 * Provides multi-currency support, exchange rate management,
 * currency conversion with fees, and conversion history tracking.
 */

import type { 
  Container,
  CurrencyRepository,
  Currency,
  ExchangeRate,
  CurrencyConversion,
} from '../container/types';

// ============================================
// TYPES
// ============================================

export interface CreateCurrencyInput {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces?: number;
}

export interface UpdateCurrencyInput {
  name?: string;
  symbol?: string;
  decimalPlaces?: number;
  isActive?: boolean;
}

export interface SetExchangeRateInput {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  source?: string;
  validFrom?: string;
  validTo?: string | null;
}

export interface ConvertCurrencyInput {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  feePercent?: number;
  reference?: string;
  entityType?: string;
  entityId?: string;
}

export interface ConversionResult {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
  netAmount: number;
  reference: string;
}

export interface CurrencyServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// VALIDATION
// ============================================

// ISO 4217 currency code pattern
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Common currencies for validation reference
const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'INR', 'BRL', 'MXN', 'ZAR', 'SGD', 'HKD', 'KRW',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'TRY',
  'THB', 'MYR', 'IDR', 'PHP', 'VND', 'TWD', 'AED', 'SAR'
];

function isValidCurrencyCode(code: string): boolean {
  return CURRENCY_CODE_PATTERN.test(code.toUpperCase());
}

function isValidUUID(id: string): boolean {
  return UUID_PATTERN.test(id);
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createCurrencyService(container: Container) {
  const { currencyRepository } = container;

  // ============================================
  // CURRENCY MANAGEMENT
  // ============================================

  async function createCurrency(input: CreateCurrencyInput): Promise<CurrencyServiceResult<Currency>> {
    // Validate code
    if (!input.code || !isValidCurrencyCode(input.code)) {
      return { success: false, error: 'Invalid currency code. Must be 3 uppercase letters (ISO 4217)' };
    }

    // Validate name
    if (!input.name || input.name.trim() === '') {
      return { success: false, error: 'Currency name is required' };
    }

    // Validate symbol
    if (!input.symbol || input.symbol.trim() === '') {
      return { success: false, error: 'Currency symbol is required' };
    }

    // Validate decimal places
    const decimalPlaces = input.decimalPlaces ?? 2;
    if (decimalPlaces < 0 || decimalPlaces > 4) {
      return { success: false, error: 'Decimal places must be between 0 and 4' };
    }

    // Check if currency already exists
    const existing = await currencyRepository.getCurrency(input.code);
    if (existing) {
      return { success: false, error: 'Currency already exists' };
    }

    const currency = await currencyRepository.createCurrency({
      code: input.code.toUpperCase(),
      name: input.name.trim(),
      symbol: input.symbol.trim(),
      decimalPlaces,
      isActive: true,
    });

    return { success: true, data: currency };
  }

  async function getCurrency(code: string): Promise<CurrencyServiceResult<Currency>> {
    if (!code || !isValidCurrencyCode(code)) {
      return { success: false, error: 'Invalid currency code' };
    }

    const currency = await currencyRepository.getCurrency(code);
    
    if (!currency) {
      return { success: false, error: 'Currency not found' };
    }

    return { success: true, data: currency };
  }

  async function getCurrencies(): Promise<CurrencyServiceResult<Currency[]>> {
    const currencies = await currencyRepository.getCurrencies();
    return { success: true, data: currencies };
  }

  async function updateCurrency(code: string, input: UpdateCurrencyInput): Promise<CurrencyServiceResult<Currency>> {
    if (!code || !isValidCurrencyCode(code)) {
      return { success: false, error: 'Invalid currency code' };
    }

    // Validate name if provided
    if (input.name !== undefined && input.name.trim() === '') {
      return { success: false, error: 'Currency name cannot be empty' };
    }

    // Validate symbol if provided
    if (input.symbol !== undefined && input.symbol.trim() === '') {
      return { success: false, error: 'Currency symbol cannot be empty' };
    }

    // Validate decimal places if provided
    if (input.decimalPlaces !== undefined && (input.decimalPlaces < 0 || input.decimalPlaces > 4)) {
      return { success: false, error: 'Decimal places must be between 0 and 4' };
    }

    try {
      const updated = await currencyRepository.updateCurrency(code, {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.symbol !== undefined && { symbol: input.symbol.trim() }),
        ...(input.decimalPlaces !== undefined && { decimalPlaces: input.decimalPlaces }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      });
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: 'Currency not found' };
    }
  }

  async function deleteCurrency(code: string): Promise<CurrencyServiceResult<void>> {
    if (!code || !isValidCurrencyCode(code)) {
      return { success: false, error: 'Invalid currency code' };
    }

    await currencyRepository.deleteCurrency(code);
    return { success: true };
  }

  async function activateCurrency(code: string): Promise<CurrencyServiceResult<Currency>> {
    return updateCurrency(code, { isActive: true });
  }

  async function deactivateCurrency(code: string): Promise<CurrencyServiceResult<Currency>> {
    return updateCurrency(code, { isActive: false });
  }

  // ============================================
  // EXCHANGE RATE MANAGEMENT
  // ============================================

  async function setExchangeRate(input: SetExchangeRateInput): Promise<CurrencyServiceResult<ExchangeRate>> {
    // Validate base currency
    if (!input.baseCurrency || !isValidCurrencyCode(input.baseCurrency)) {
      return { success: false, error: 'Invalid base currency code' };
    }

    // Validate target currency
    if (!input.targetCurrency || !isValidCurrencyCode(input.targetCurrency)) {
      return { success: false, error: 'Invalid target currency code' };
    }

    // Cannot exchange same currency
    if (input.baseCurrency.toUpperCase() === input.targetCurrency.toUpperCase()) {
      return { success: false, error: 'Base and target currency cannot be the same' };
    }

    // Validate rate
    if (typeof input.rate !== 'number' || input.rate <= 0) {
      return { success: false, error: 'Exchange rate must be a positive number' };
    }

    // Validate validFrom if provided
    const validFrom = input.validFrom || new Date().toISOString();
    if (input.validFrom && !isValidDate(input.validFrom)) {
      return { success: false, error: 'Invalid validFrom date' };
    }

    // Validate validTo if provided
    if (input.validTo !== undefined && input.validTo !== null && !isValidDate(input.validTo)) {
      return { success: false, error: 'Invalid validTo date' };
    }

    // ValidTo must be after validFrom
    if (input.validTo && new Date(input.validTo) <= new Date(validFrom)) {
      return { success: false, error: 'validTo must be after validFrom' };
    }

    const rate = await currencyRepository.saveExchangeRate({
      baseCurrency: input.baseCurrency.toUpperCase(),
      targetCurrency: input.targetCurrency.toUpperCase(),
      rate: input.rate,
      source: input.source || 'manual',
      validFrom,
      validTo: input.validTo ?? null,
    });

    return { success: true, data: rate };
  }

  async function getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<CurrencyServiceResult<ExchangeRate>> {
    if (!baseCurrency || !isValidCurrencyCode(baseCurrency)) {
      return { success: false, error: 'Invalid base currency code' };
    }

    if (!targetCurrency || !isValidCurrencyCode(targetCurrency)) {
      return { success: false, error: 'Invalid target currency code' };
    }

    // Same currency has rate of 1
    if (baseCurrency.toUpperCase() === targetCurrency.toUpperCase()) {
      return { 
        success: true, 
        data: {
          id: 'same-currency',
          baseCurrency: baseCurrency.toUpperCase(),
          targetCurrency: targetCurrency.toUpperCase(),
          rate: 1,
          source: 'system',
          validFrom: new Date().toISOString(),
          validTo: null,
          createdAt: new Date().toISOString(),
        }
      };
    }

    const rate = await currencyRepository.getExchangeRate(baseCurrency, targetCurrency);
    
    if (!rate) {
      return { success: false, error: 'Exchange rate not found' };
    }

    return { success: true, data: rate };
  }

  async function getExchangeRates(baseCurrency: string): Promise<CurrencyServiceResult<ExchangeRate[]>> {
    if (!baseCurrency || !isValidCurrencyCode(baseCurrency)) {
      return { success: false, error: 'Invalid base currency code' };
    }

    const rates = await currencyRepository.getExchangeRates(baseCurrency);
    return { success: true, data: rates };
  }

  // ============================================
  // CURRENCY CONVERSION
  // ============================================

  async function convert(input: ConvertCurrencyInput): Promise<CurrencyServiceResult<ConversionResult>> {
    // Validate currencies
    if (!input.fromCurrency || !isValidCurrencyCode(input.fromCurrency)) {
      return { success: false, error: 'Invalid source currency code' };
    }

    if (!input.toCurrency || !isValidCurrencyCode(input.toCurrency)) {
      return { success: false, error: 'Invalid target currency code' };
    }

    // Validate amount
    if (typeof input.amount !== 'number' || input.amount <= 0) {
      return { success: false, error: 'Amount must be a positive number' };
    }

    // Validate fee
    const feePercent = input.feePercent ?? 0;
    if (feePercent < 0 || feePercent > 100) {
      return { success: false, error: 'Fee percent must be between 0 and 100' };
    }

    // Get exchange rate
    const rateResult = await getExchangeRate(input.fromCurrency, input.toCurrency);
    
    if (!rateResult.success || !rateResult.data) {
      return { success: false, error: rateResult.error || 'Exchange rate not available' };
    }

    const rate = rateResult.data.rate;
    
    // Calculate conversion
    const grossAmount = input.amount * rate;
    const fee = grossAmount * (feePercent / 100);
    const netAmount = grossAmount - fee;

    // Generate reference if not provided
    const reference = input.reference || `CNV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log the conversion
    await currencyRepository.logConversion({
      fromCurrency: input.fromCurrency.toUpperCase(),
      toCurrency: input.toCurrency.toUpperCase(),
      fromAmount: input.amount,
      toAmount: netAmount,
      rate,
      fee,
      reference,
      entityType: input.entityType,
      entityId: input.entityId,
    });

    return {
      success: true,
      data: {
        fromCurrency: input.fromCurrency.toUpperCase(),
        toCurrency: input.toCurrency.toUpperCase(),
        fromAmount: input.amount,
        toAmount: netAmount,
        rate,
        fee,
        netAmount,
        reference,
      },
    };
  }

  async function getConversionHistory(filters: {
    fromDate?: string;
    toDate?: string;
    currency?: string;
  } = {}): Promise<CurrencyServiceResult<CurrencyConversion[]>> {
    // Validate dates if provided
    if (filters.fromDate && !isValidDate(filters.fromDate)) {
      return { success: false, error: 'Invalid fromDate' };
    }

    if (filters.toDate && !isValidDate(filters.toDate)) {
      return { success: false, error: 'Invalid toDate' };
    }

    // Validate currency if provided
    if (filters.currency && !isValidCurrencyCode(filters.currency)) {
      return { success: false, error: 'Invalid currency code' };
    }

    const conversions = await currencyRepository.getConversions(filters);
    return { success: true, data: conversions };
  }

  // ============================================
  // CALCULATION UTILITIES
  // ============================================

  function calculateConversion(amount: number, rate: number, feePercent: number = 0): {
    grossAmount: number;
    fee: number;
    netAmount: number;
  } {
    const grossAmount = amount * rate;
    const fee = grossAmount * (feePercent / 100);
    const netAmount = grossAmount - fee;
    
    return { grossAmount, fee, netAmount };
  }

  function formatCurrency(amount: number, currencyCode: string, locale: string = 'en-US'): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
      }).format(amount);
    } catch {
      // Fallback for unknown currencies
      return `${currencyCode.toUpperCase()} ${amount.toFixed(2)}`;
    }
  }

  function roundToDecimalPlaces(amount: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(amount * factor) / factor;
  }

  function getCommonCurrencies(): string[] {
    return [...COMMON_CURRENCIES];
  }

  function getCurrencySymbol(code: string): string {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CHF': 'CHF',
      'CAD': 'C$',
      'AUD': 'A$',
      'NZD': 'NZ$',
      'CNY': '¥',
      'INR': '₹',
      'BRL': 'R$',
      'MXN': '$',
      'ZAR': 'R',
      'SGD': 'S$',
      'HKD': 'HK$',
      'KRW': '₩',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PLN': 'zł',
      'CZK': 'Kč',
      'HUF': 'Ft',
      'RUB': '₽',
      'TRY': '₺',
      'THB': '฿',
      'AED': 'د.إ',
      'SAR': '﷼',
    };
    
    return symbols[code.toUpperCase()] || code.toUpperCase();
  }

  function getInverseRate(rate: number): number {
    if (rate === 0) return 0;
    return roundToDecimalPlaces(1 / rate, 6);
  }

  function calculateCrossRate(
    baseToIntermediate: number, 
    intermediateToTarget: number
  ): number {
    return roundToDecimalPlaces(baseToIntermediate * intermediateToTarget, 6);
  }

  function isVolatileRate(currentRate: number, previousRate: number, thresholdPercent: number = 5): boolean {
    if (previousRate === 0) return false;
    const change = Math.abs((currentRate - previousRate) / previousRate) * 100;
    return change >= thresholdPercent;
  }

  // ============================================
  // RETURN SERVICE
  // ============================================

  return {
    // Currency management
    createCurrency,
    getCurrency,
    getCurrencies,
    updateCurrency,
    deleteCurrency,
    activateCurrency,
    deactivateCurrency,
    
    // Exchange rates
    setExchangeRate,
    getExchangeRate,
    getExchangeRates,
    
    // Conversion
    convert,
    getConversionHistory,
    
    // Utilities
    calculateConversion,
    formatCurrency,
    roundToDecimalPlaces,
    getCommonCurrencies,
    getCurrencySymbol,
    getInverseRate,
    calculateCrossRate,
    isVolatileRate,
  };
}
