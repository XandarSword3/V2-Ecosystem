/**
 * In-Memory Currency Repository
 * 
 * Test double implementation for currency and exchange rate operations.
 */

import { randomUUID } from 'crypto';
import type { 
  CurrencyRepository, 
  Currency, 
  ExchangeRate, 
  CurrencyConversion 
} from '../container/types';

export class InMemoryCurrencyRepository implements CurrencyRepository {
  private currencies: Map<string, Currency> = new Map();
  private exchangeRates: Map<string, ExchangeRate> = new Map();
  private conversions: Map<string, CurrencyConversion> = new Map();

  async getCurrencies(): Promise<Currency[]> {
    return Array.from(this.currencies.values()).filter(c => c.isActive);
  }

  async getCurrency(code: string): Promise<Currency | null> {
    return this.currencies.get(code.toUpperCase()) || null;
  }

  async createCurrency(data: Omit<Currency, 'createdAt' | 'updatedAt'>): Promise<Currency> {
    const currency: Currency = {
      ...data,
      code: data.code.toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.currencies.set(currency.code, currency);
    return currency;
  }

  async updateCurrency(code: string, data: Partial<Currency>): Promise<Currency> {
    const existing = this.currencies.get(code.toUpperCase());
    if (!existing) throw new Error('Currency not found');
    
    const updated: Currency = {
      ...existing,
      ...data,
      code: existing.code,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.currencies.set(code.toUpperCase(), updated);
    return updated;
  }

  async deleteCurrency(code: string): Promise<void> {
    this.currencies.delete(code.toUpperCase());
  }

  async getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | null> {
    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();
    
    // Find the most recent valid rate
    const rates = Array.from(this.exchangeRates.values())
      .filter(r => r.baseCurrency === base && r.targetCurrency === target)
      .filter(r => {
        const now = new Date();
        const validFrom = new Date(r.validFrom);
        const validTo = r.validTo ? new Date(r.validTo) : null;
        return validFrom <= now && (!validTo || validTo >= now);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return rates[0] || null;
  }

  async getExchangeRates(baseCurrency: string): Promise<ExchangeRate[]> {
    const base = baseCurrency.toUpperCase();
    const now = new Date();
    
    return Array.from(this.exchangeRates.values())
      .filter(r => r.baseCurrency === base)
      .filter(r => {
        const validFrom = new Date(r.validFrom);
        const validTo = r.validTo ? new Date(r.validTo) : null;
        return validFrom <= now && (!validTo || validTo >= now);
      });
  }

  async saveExchangeRate(data: Omit<ExchangeRate, 'id' | 'createdAt'>): Promise<ExchangeRate> {
    const rate: ExchangeRate = {
      ...data,
      baseCurrency: data.baseCurrency.toUpperCase(),
      targetCurrency: data.targetCurrency.toUpperCase(),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.exchangeRates.set(rate.id, rate);
    return rate;
  }

  async logConversion(data: Omit<CurrencyConversion, 'id' | 'createdAt'>): Promise<CurrencyConversion> {
    const conversion: CurrencyConversion = {
      ...data,
      fromCurrency: data.fromCurrency.toUpperCase(),
      toCurrency: data.toCurrency.toUpperCase(),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.conversions.set(conversion.id, conversion);
    return conversion;
  }

  async getConversions(filters: { fromDate?: string; toDate?: string; currency?: string }): Promise<CurrencyConversion[]> {
    let result = Array.from(this.conversions.values());
    
    if (filters.fromDate) {
      const from = new Date(filters.fromDate).getTime();
      result = result.filter(c => new Date(c.createdAt).getTime() >= from);
    }
    
    if (filters.toDate) {
      const to = new Date(filters.toDate).getTime();
      result = result.filter(c => new Date(c.createdAt).getTime() <= to);
    }
    
    if (filters.currency) {
      const curr = filters.currency.toUpperCase();
      result = result.filter(c => c.fromCurrency === curr || c.toCurrency === curr);
    }
    
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Test utility method
  clear(): void {
    this.currencies.clear();
    this.exchangeRates.clear();
    this.conversions.clear();
  }
}
