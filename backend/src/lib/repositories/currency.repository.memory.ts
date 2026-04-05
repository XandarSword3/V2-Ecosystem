/**
 * In-Memory Currency Repository
 * Test double for CurrencyRepository using in-memory data structures.
 */

import type {
  CurrencyRepository,
  Currency,
  ExchangeRate,
  CurrencyConversion,
} from '../container/types.js';

export class InMemoryCurrencyRepository implements CurrencyRepository {
  private currencies = new Map<string, Currency>();
  private exchangeRates: ExchangeRate[] = [];
  private conversions: CurrencyConversion[] = [];

  reset() {
    this.currencies.clear();
    this.exchangeRates = [];
    this.conversions = [];
  }

  // Currency operations
  async getCurrencies(): Promise<Currency[]> {
    return [...this.currencies.values()];
  }

  async getCurrency(code: string): Promise<Currency | null> {
    return this.currencies.get(code) ?? null;
  }

  async createCurrency(data: Omit<Currency, 'createdAt' | 'updatedAt'>): Promise<Currency> {
    const currency: Currency = { ...data, createdAt: new Date().toISOString(), updatedAt: null };
    this.currencies.set(data.code, currency);
    return currency;
  }

  async updateCurrency(code: string, data: Partial<Currency>): Promise<Currency> {
    const existing = this.currencies.get(code);
    if (!existing) throw new Error(`Currency ${code} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.currencies.set(code, updated);
    return updated;
  }

  async deleteCurrency(code: string): Promise<void> {
    this.currencies.delete(code);
  }

  // Exchange rate operations
  async getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | null> {
    const rates = this.exchangeRates.filter(
      r => r.baseCurrency === baseCurrency && r.targetCurrency === targetCurrency
    );
    return rates.length > 0 ? rates[rates.length - 1] : null;
  }

  async getExchangeRates(baseCurrency: string): Promise<ExchangeRate[]> {
    return this.exchangeRates.filter(r => r.baseCurrency === baseCurrency);
  }

  async saveExchangeRate(data: Omit<ExchangeRate, 'id' | 'createdAt'>): Promise<ExchangeRate> {
    const rate: ExchangeRate = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.exchangeRates.push(rate);
    return rate;
  }

  // Conversion operations
  async logConversion(data: Omit<CurrencyConversion, 'id' | 'createdAt'>): Promise<CurrencyConversion> {
    const conversion: CurrencyConversion = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.conversions.push(conversion);
    return conversion;
  }

  async getConversions(filters: { fromDate?: string; toDate?: string; currency?: string }): Promise<CurrencyConversion[]> {
    let result = [...this.conversions];
    if (filters.fromDate) result = result.filter(c => c.createdAt >= filters.fromDate!);
    if (filters.toDate) result = result.filter(c => c.createdAt <= filters.toDate!);
    if (filters.currency) result = result.filter(c => c.fromCurrency === filters.currency || c.toCurrency === filters.currency);
    return result;
  }
}
