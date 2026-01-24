/**
 * V2 Resort - Multi-Currency Support Service
 * Handles currency conversion and management
 */

import { supabase } from '../lib/supabase';
import Stripe from 'stripe';
import { logger } from '../utils/logger';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  exchange_rate: number;
  decimal_places: number;
  is_active: boolean;
  is_default: boolean;
  last_updated: string;
}

export interface PriceConversion {
  original_amount: number;
  original_currency: string;
  converted_amount: number;
  target_currency: string;
  exchange_rate: number;
  converted_at: string;
}

// Supported currencies with their properties
const SUPPORTED_CURRENCIES: Record<string, Omit<Currency, 'exchange_rate' | 'is_active' | 'is_default' | 'last_updated'>> = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', name_ar: 'يورو', name_fr: 'Euro', decimal_places: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', name_ar: 'دولار أمريكي', name_fr: 'Dollar américain', decimal_places: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', name_ar: 'جنيه إسترليني', name_fr: 'Livre sterling', decimal_places: 2 },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', name_ar: 'درهم إماراتي', name_fr: 'Dirham des EAU', decimal_places: 2 },
  SAR: { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', name_ar: 'ريال سعودي', name_fr: 'Riyal saoudien', decimal_places: 2 },
  QAR: { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', name_ar: 'ريال قطري', name_fr: 'Riyal qatari', decimal_places: 2 },
  KWD: { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', name_ar: 'دينار كويتي', name_fr: 'Dinar koweïtien', decimal_places: 3 },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', name_ar: 'فرنك سويسري', name_fr: 'Franc suisse', decimal_places: 2 },
};

// Cache for exchange rates
let ratesCache: Map<string, { rate: number; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

class CurrencyService {
  private defaultCurrency = 'EUR';

  /**
   * Get all active currencies
   */
  async getActiveCurrencies(): Promise<Currency[]> {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('is_active', true)
      .order('code');

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Get currency by code
   */
  async getCurrency(code: string): Promise<Currency | null> {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Get default currency
   */
  async getDefaultCurrency(): Promise<Currency> {
    const { data: settings } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'default_currency')
      .single();

    const defaultCode = settings?.value || this.defaultCurrency;

    const currency = await this.getCurrency(defaultCode);
    if (!currency) {
      throw new Error(`Default currency ${defaultCode} not found`);
    }

    return currency;
  }

  /**
   * Convert amount between currencies
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<PriceConversion> {
    fromCurrency = fromCurrency.toUpperCase();
    toCurrency = toCurrency.toUpperCase();

    if (fromCurrency === toCurrency) {
      return {
        original_amount: amount,
        original_currency: fromCurrency,
        converted_amount: amount,
        target_currency: toCurrency,
        exchange_rate: 1,
        converted_at: new Date().toISOString(),
      };
    }

    // Get exchange rates relative to default currency
    const fromRate = await this.getExchangeRate(fromCurrency);
    const toRate = await this.getExchangeRate(toCurrency);

    // Convert: amount in from -> default -> to
    const amountInDefault = amount / fromRate;
    const convertedAmount = amountInDefault * toRate;
    const exchangeRate = toRate / fromRate;

    // Round to appropriate decimal places
    const toCurrencyInfo = SUPPORTED_CURRENCIES[toCurrency];
    const decimalPlaces = toCurrencyInfo?.decimal_places ?? 2;
    const roundedAmount = Math.round(convertedAmount * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);

    return {
      original_amount: amount,
      original_currency: fromCurrency,
      converted_amount: roundedAmount,
      target_currency: toCurrency,
      exchange_rate: exchangeRate,
      converted_at: new Date().toISOString(),
    };
  }

  /**
   * Get exchange rate for a currency (relative to default)
   */
  async getExchangeRate(currencyCode: string): Promise<number> {
    currencyCode = currencyCode.toUpperCase();

    // Check cache first
    const cached = ratesCache.get(currencyCode);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.rate;
    }

    // Get from database
    const { data, error } = await supabase
      .from('currencies')
      .select('exchange_rate')
      .eq('code', currencyCode)
      .single();

    if (error || !data) {
      throw new Error(`Exchange rate not found for ${currencyCode}`);
    }

    // Update cache
    ratesCache.set(currencyCode, {
      rate: data.exchange_rate,
      timestamp: Date.now(),
    });

    return data.exchange_rate;
  }

  /**
   * Update exchange rate for a currency
   */
  async updateExchangeRate(
    currencyCode: string,
    rate: number,
    adminUserId?: string
  ): Promise<Currency> {
    currencyCode = currencyCode.toUpperCase();

    const { data, error } = await supabase
      .from('currencies')
      .update({
        exchange_rate: rate,
        last_updated: new Date().toISOString(),
      })
      .eq('code', currencyCode)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Clear cache
    ratesCache.delete(currencyCode);

    return data;
  }

  /**
   * Update all exchange rates from external API
   */
  async updateAllRatesFromAPI(): Promise<void> {
    const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
    if (!API_KEY) {
      console.warn('[CurrencyService] No exchange rate API key configured');
      return;
    }

    try {
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${this.defaultCurrency}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const rates = data.rates as Record<string, number>;

      // Update each supported currency
      for (const code of Object.keys(SUPPORTED_CURRENCIES)) {
        if (rates[code]) {
          await this.updateExchangeRate(code, rates[code]);
        }
      }

      logger.info('[CurrencyService] Exchange rates updated successfully');
    } catch (error) {
      logger.error('[CurrencyService] Failed to update exchange rates:', error);
      throw error;
    }
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currencyCode: string, locale?: string): string {
    currencyCode = currencyCode.toUpperCase();
    locale = locale || 'en-US';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  }

  /**
   * Get currency for Stripe (lowercase)
   */
  getStripeCurrency(currencyCode: string): string {
    return currencyCode.toLowerCase();
  }

  /**
   * Convert amount to Stripe format (smallest currency unit)
   */
  toStripeAmount(amount: number, currencyCode: string): number {
    const currency = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()];
    const decimalPlaces = currency?.decimal_places ?? 2;
    
    // Stripe expects amounts in smallest unit (cents for most currencies)
    // KWD has 3 decimal places, so multiply by 1000
    return Math.round(amount * Math.pow(10, decimalPlaces));
  }

  /**
   * Convert Stripe amount to regular amount
   */
  fromStripeAmount(stripeAmount: number, currencyCode: string): number {
    const currency = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()];
    const decimalPlaces = currency?.decimal_places ?? 2;
    
    return stripeAmount / Math.pow(10, decimalPlaces);
  }

  /**
   * Check if currency is supported by Stripe
   */
  isStripeSupportedCurrency(currencyCode: string): boolean {
    // Stripe supports all major currencies
    const stripeSupported = [
      'EUR', 'USD', 'GBP', 'AED', 'SAR', 'QAR', 'KWD', 'CHF',
      'AUD', 'CAD', 'JPY', 'SGD', 'HKD', 'INR', 'BRL', 'MXN'
    ];
    return stripeSupported.includes(currencyCode.toUpperCase());
  }

  /**
   * Create multi-currency price for display
   */
  async getMultiCurrencyPrices(
    baseAmount: number,
    baseCurrency: string,
    targetCurrencies?: string[]
  ): Promise<Record<string, { amount: number; formatted: string }>> {
    const currencies = targetCurrencies || Object.keys(SUPPORTED_CURRENCIES);
    const prices: Record<string, { amount: number; formatted: string }> = {};

    for (const currency of currencies) {
      const conversion = await this.convert(baseAmount, baseCurrency, currency);
      prices[currency] = {
        amount: conversion.converted_amount,
        formatted: this.formatAmount(conversion.converted_amount, currency),
      };
    }

    return prices;
  }

  /**
   * Initialize default currencies in database
   */
  async initializeCurrencies(): Promise<void> {
    const defaultRates: Record<string, number> = {
      EUR: 1,
      USD: 1.08,
      GBP: 0.86,
      AED: 3.97,
      SAR: 4.05,
      QAR: 3.93,
      KWD: 0.33,
      CHF: 0.95,
    };

    for (const [code, info] of Object.entries(SUPPORTED_CURRENCIES)) {
      const { data: existing } = await supabase
        .from('currencies')
        .select('code')
        .eq('code', code)
        .single();

      if (!existing) {
        await supabase.from('currencies').insert({
          ...info,
          exchange_rate: defaultRates[code] || 1,
          is_active: true,
          is_default: code === 'EUR',
          last_updated: new Date().toISOString(),
        });
      }
    }

    logger.info('[CurrencyService] Currencies initialized');
  }
}

export const currencyService = new CurrencyService();
