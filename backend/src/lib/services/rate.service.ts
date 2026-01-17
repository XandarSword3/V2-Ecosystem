/**
 * Rate/Pricing Service
 *
 * Manages rates, pricing rules, and price calculations.
 * Follows DI pattern for testability.
 */

import type { Container, Rate, RateModifier, RateFilters, RateType, DayOfWeek } from '../container/types.js';

// ============================================
// CONSTANTS
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RATE_TYPES: RateType[] = ['standard', 'seasonal', 'promotional', 'event', 'package'];
const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR'];

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

// ============================================
// TYPES
// ============================================

export interface CreateRateInput {
  name: string;
  description: string;
  rateType: RateType;
  basePrice: number;
  currency?: string;
  applicableItemType: string;
  applicableItemId?: string;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: DayOfWeek[];
  minStay?: number;
  maxStay?: number;
  priority?: number;
}

export interface UpdateRateInput {
  name?: string;
  description?: string;
  rateType?: RateType;
  basePrice?: number;
  currency?: string;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek?: DayOfWeek[];
  minStay?: number;
  maxStay?: number | null;
  priority?: number;
}

export interface AddModifierInput {
  rateId: string;
  name: string;
  modifierType: 'percentage' | 'fixed';
  value: number;
  condition?: string;
}

export interface CalculatePriceInput {
  itemType: string;
  itemId: string | null;
  date: string;
  nights?: number;
  guests?: number;
}

export interface PriceBreakdown {
  basePrice: number;
  modifiers: { name: string; amount: number }[];
  totalPrice: number;
  currency: string;
  appliedRate: Rate | null;
}

export interface RateStats {
  totalRates: number;
  activeRates: number;
  inactiveRates: number;
  byType: Record<RateType, number>;
  avgBasePrice: number;
}

export interface RateService {
  createRate(input: CreateRateInput): Promise<Rate>;
  getRate(id: string): Promise<Rate | null>;
  updateRate(id: string, input: UpdateRateInput): Promise<Rate>;
  deleteRate(id: string): Promise<void>;
  activateRate(id: string): Promise<Rate>;
  deactivateRate(id: string): Promise<Rate>;
  listRates(filters?: RateFilters): Promise<Rate[]>;
  addModifier(input: AddModifierInput): Promise<RateModifier>;
  getModifiers(rateId: string): Promise<RateModifier[]>;
  removeModifier(id: string): Promise<void>;
  calculatePrice(input: CalculatePriceInput): Promise<PriceBreakdown>;
  getBestRate(itemType: string, itemId: string | null, date: string): Promise<Rate | null>;
  getStats(): Promise<RateStats>;
  getRateTypes(): RateType[];
  getDaysOfWeek(): DayOfWeek[];
  getCurrencies(): string[];
}

// ============================================
// ERROR CLASS
// ============================================

export class RateServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'RateServiceError';
  }
}

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

function validateName(name: string): void {
  if (!name || name.trim().length < MIN_NAME_LENGTH) {
    throw new RateServiceError(
      `Name must be at least ${MIN_NAME_LENGTH} characters`,
      'INVALID_NAME'
    );
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new RateServiceError(
      `Name cannot exceed ${MAX_NAME_LENGTH} characters`,
      'INVALID_NAME'
    );
  }
}

function validateDescription(description: string): void {
  if (!description || description.trim().length === 0) {
    throw new RateServiceError('Description is required', 'INVALID_DESCRIPTION');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new RateServiceError(
      `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
      'INVALID_DESCRIPTION'
    );
  }
}

function validateRateType(rateType: RateType): void {
  if (!RATE_TYPES.includes(rateType)) {
    throw new RateServiceError(`Invalid rate type: ${rateType}`, 'INVALID_RATE_TYPE');
  }
}

function validateBasePrice(price: number): void {
  if (price < 0) {
    throw new RateServiceError('Base price cannot be negative', 'INVALID_BASE_PRICE');
  }
}

function validateCurrency(currency: string): void {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new RateServiceError(`Unsupported currency: ${currency}`, 'INVALID_CURRENCY');
  }
}

function validateDateRange(startDate: string | undefined, endDate: string | undefined): void {
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new RateServiceError('Invalid start date format', 'INVALID_START_DATE');
    }
  }
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      throw new RateServiceError('Invalid end date format', 'INVALID_END_DATE');
    }
  }
  if (startDate && endDate) {
    if (new Date(startDate) > new Date(endDate)) {
      throw new RateServiceError('Start date must be before end date', 'INVALID_DATE_RANGE');
    }
  }
}

function validateDaysOfWeek(days: DayOfWeek[]): void {
  for (const day of days) {
    if (!DAYS_OF_WEEK.includes(day)) {
      throw new RateServiceError(`Invalid day of week: ${day}`, 'INVALID_DAY_OF_WEEK');
    }
  }
}

function validateStayLimits(minStay?: number, maxStay?: number | null): void {
  if (minStay !== undefined && minStay < 1) {
    throw new RateServiceError('Minimum stay must be at least 1', 'INVALID_MIN_STAY');
  }
  if (maxStay !== undefined && maxStay !== null) {
    if (maxStay < 1) {
      throw new RateServiceError('Maximum stay must be at least 1', 'INVALID_MAX_STAY');
    }
    if (minStay !== undefined && maxStay < minStay) {
      throw new RateServiceError('Maximum stay cannot be less than minimum stay', 'INVALID_STAY_RANGE');
    }
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createRateService(container: Container): RateService {
  const { rateRepository, logger } = container;

  async function createRate(input: CreateRateInput): Promise<Rate> {
    logger?.info?.('Creating rate', { name: input.name });

    // Validate required fields
    validateName(input.name);
    validateDescription(input.description);
    validateRateType(input.rateType);
    validateBasePrice(input.basePrice);

    const currency = input.currency || 'USD';
    validateCurrency(currency);

    if (!input.applicableItemType || input.applicableItemType.trim().length === 0) {
      throw new RateServiceError('Applicable item type is required', 'INVALID_ITEM_TYPE');
    }

    if (input.applicableItemId && !isValidUUID(input.applicableItemId)) {
      throw new RateServiceError('Invalid applicable item ID', 'INVALID_ITEM_ID');
    }

    validateDateRange(input.startDate, input.endDate);

    if (input.daysOfWeek) {
      validateDaysOfWeek(input.daysOfWeek);
    }

    validateStayLimits(input.minStay, input.maxStay);

    const rate = await rateRepository.create({
      name: input.name.trim(),
      description: input.description.trim(),
      rateType: input.rateType,
      basePrice: input.basePrice,
      currency,
      applicableItemType: input.applicableItemType.trim(),
      applicableItemId: input.applicableItemId || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      daysOfWeek: input.daysOfWeek || [],
      minStay: input.minStay || 1,
      maxStay: input.maxStay || null,
      isActive: true,
      priority: input.priority ?? 0,
    });

    return rate;
  }

  async function getRate(id: string): Promise<Rate | null> {
    if (!isValidUUID(id)) {
      throw new RateServiceError('Invalid rate ID', 'INVALID_RATE_ID');
    }

    return rateRepository.getById(id);
  }

  async function updateRate(id: string, input: UpdateRateInput): Promise<Rate> {
    if (!isValidUUID(id)) {
      throw new RateServiceError('Invalid rate ID', 'INVALID_RATE_ID');
    }

    const rate = await rateRepository.getById(id);
    if (!rate) {
      throw new RateServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    const updates: Partial<Rate> = {};

    if (input.name !== undefined) {
      validateName(input.name);
      updates.name = input.name.trim();
    }

    if (input.description !== undefined) {
      validateDescription(input.description);
      updates.description = input.description.trim();
    }

    if (input.rateType !== undefined) {
      validateRateType(input.rateType);
      updates.rateType = input.rateType;
    }

    if (input.basePrice !== undefined) {
      validateBasePrice(input.basePrice);
      updates.basePrice = input.basePrice;
    }

    if (input.currency !== undefined) {
      validateCurrency(input.currency);
      updates.currency = input.currency;
    }

    const newStartDate = input.startDate !== undefined ? input.startDate : rate.startDate;
    const newEndDate = input.endDate !== undefined ? input.endDate : rate.endDate;

    if (input.startDate !== undefined || input.endDate !== undefined) {
      validateDateRange(newStartDate || undefined, newEndDate || undefined);
      if (input.startDate !== undefined) updates.startDate = input.startDate;
      if (input.endDate !== undefined) updates.endDate = input.endDate;
    }

    if (input.daysOfWeek !== undefined) {
      validateDaysOfWeek(input.daysOfWeek);
      updates.daysOfWeek = input.daysOfWeek;
    }

    const newMinStay = input.minStay !== undefined ? input.minStay : rate.minStay;
    const newMaxStay = input.maxStay !== undefined ? input.maxStay : rate.maxStay;

    if (input.minStay !== undefined || input.maxStay !== undefined) {
      validateStayLimits(newMinStay, newMaxStay);
      if (input.minStay !== undefined) updates.minStay = input.minStay;
      if (input.maxStay !== undefined) updates.maxStay = input.maxStay;
    }

    if (input.priority !== undefined) {
      updates.priority = input.priority;
    }

    return rateRepository.update(id, updates);
  }

  async function deleteRate(id: string): Promise<void> {
    if (!isValidUUID(id)) {
      throw new RateServiceError('Invalid rate ID', 'INVALID_RATE_ID');
    }

    const rate = await rateRepository.getById(id);
    if (!rate) {
      throw new RateServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    await rateRepository.delete(id);
  }

  async function activateRate(id: string): Promise<Rate> {
    if (!isValidUUID(id)) {
      throw new RateServiceError('Invalid rate ID', 'INVALID_RATE_ID');
    }

    const rate = await rateRepository.getById(id);
    if (!rate) {
      throw new RateServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    return rateRepository.update(id, { isActive: true });
  }

  async function deactivateRate(id: string): Promise<Rate> {
    if (!isValidUUID(id)) {
      throw new RateServiceError('Invalid rate ID', 'INVALID_RATE_ID');
    }

    const rate = await rateRepository.getById(id);
    if (!rate) {
      throw new RateServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    return rateRepository.update(id, { isActive: false });
  }

  async function listRates(filters?: RateFilters): Promise<Rate[]> {
    return rateRepository.list(filters);
  }

  async function addModifier(input: AddModifierInput): Promise<RateModifier> {
    if (!isValidUUID(input.rateId)) {
      throw new RateServiceError('Invalid rate ID', 'INVALID_RATE_ID');
    }

    const rate = await rateRepository.getById(input.rateId);
    if (!rate) {
      throw new RateServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    validateName(input.name);

    if (input.modifierType !== 'percentage' && input.modifierType !== 'fixed') {
      throw new RateServiceError('Invalid modifier type', 'INVALID_MODIFIER_TYPE');
    }

    if (input.modifierType === 'percentage' && (input.value < -100 || input.value > 1000)) {
      throw new RateServiceError('Percentage must be between -100 and 1000', 'INVALID_MODIFIER_VALUE');
    }

    return rateRepository.addModifier({
      rateId: input.rateId,
      name: input.name.trim(),
      modifierType: input.modifierType,
      value: input.value,
      condition: input.condition?.trim() || null,
    });
  }

  async function getModifiers(rateId: string): Promise<RateModifier[]> {
    if (!isValidUUID(rateId)) {
      throw new RateServiceError('Invalid rate ID', 'INVALID_RATE_ID');
    }

    const rate = await rateRepository.getById(rateId);
    if (!rate) {
      throw new RateServiceError('Rate not found', 'RATE_NOT_FOUND', 404);
    }

    return rateRepository.getModifiers(rateId);
  }

  async function removeModifier(id: string): Promise<void> {
    if (!isValidUUID(id)) {
      throw new RateServiceError('Invalid modifier ID', 'INVALID_MODIFIER_ID');
    }

    await rateRepository.deleteModifier(id);
  }

  async function getBestRate(
    itemType: string,
    itemId: string | null,
    date: string
  ): Promise<Rate | null> {
    const rates = await rateRepository.getApplicableRates(itemType, itemId, date);
    return rates.length > 0 ? rates[0] : null;
  }

  async function calculatePrice(input: CalculatePriceInput): Promise<PriceBreakdown> {
    const rate = await getBestRate(input.itemType, input.itemId, input.date);

    if (!rate) {
      return {
        basePrice: 0,
        modifiers: [],
        totalPrice: 0,
        currency: 'USD',
        appliedRate: null,
      };
    }

    const nights = input.nights || 1;
    const basePrice = rate.basePrice * nights;
    const modifiers: { name: string; amount: number }[] = [];

    const rateModifiers = await rateRepository.getModifiers(rate.id);
    let totalModifierAmount = 0;

    for (const mod of rateModifiers) {
      let amount = 0;
      if (mod.modifierType === 'percentage') {
        amount = (basePrice * mod.value) / 100;
      } else {
        amount = mod.value * nights;
      }
      modifiers.push({ name: mod.name, amount });
      totalModifierAmount += amount;
    }

    return {
      basePrice,
      modifiers,
      totalPrice: Math.max(0, basePrice + totalModifierAmount),
      currency: rate.currency,
      appliedRate: rate,
    };
  }

  async function getStats(): Promise<RateStats> {
    const allRates = await rateRepository.list();

    const stats: RateStats = {
      totalRates: allRates.length,
      activeRates: 0,
      inactiveRates: 0,
      byType: {
        standard: 0,
        seasonal: 0,
        promotional: 0,
        event: 0,
        package: 0,
      },
      avgBasePrice: 0,
    };

    let totalPrice = 0;

    for (const rate of allRates) {
      if (rate.isActive) {
        stats.activeRates++;
      } else {
        stats.inactiveRates++;
      }

      stats.byType[rate.rateType]++;
      totalPrice += rate.basePrice;
    }

    stats.avgBasePrice = allRates.length > 0
      ? Math.round((totalPrice / allRates.length) * 100) / 100
      : 0;

    return stats;
  }

  function getRateTypes(): RateType[] {
    return [...RATE_TYPES];
  }

  function getDaysOfWeek(): DayOfWeek[] {
    return [...DAYS_OF_WEEK];
  }

  function getCurrencies(): string[] {
    return [...SUPPORTED_CURRENCIES];
  }

  return {
    createRate,
    getRate,
    updateRate,
    deleteRate,
    activateRate,
    deactivateRate,
    listRates,
    addModifier,
    getModifiers,
    removeModifier,
    calculatePrice,
    getBestRate,
    getStats,
    getRateTypes,
    getDaysOfWeek,
    getCurrencies,
  };
}
