/**
 * Rate Service Tests
 *
 * Unit tests for the Rate/Pricing Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRateService, RateServiceError } from '../../src/lib/services/rate.service';
import { InMemoryRateRepository } from '../../src/lib/repositories/rate.repository.memory';
import type { Container, Rate } from '../../src/lib/container/types';

// Test UUIDs
const ROOM_1 = '11111111-1111-1111-1111-111111111111';
const ROOM_2 = '22222222-2222-2222-2222-222222222222';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(rateRepository: InMemoryRateRepository): Container {
  return {
    rateRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

function createTestRate(overrides: Partial<Rate> = {}): Rate {
  const now = new Date().toISOString();
  return {
    id: '99999999-9999-9999-9999-999999999999',
    name: 'Standard Rate',
    description: 'Standard room rate',
    rateType: 'standard',
    basePrice: 100,
    currency: 'USD',
    applicableItemType: 'room',
    applicableItemId: null,
    startDate: null,
    endDate: null,
    daysOfWeek: [],
    minStay: 1,
    maxStay: null,
    isActive: true,
    priority: 0,
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

describe('RateService', () => {
  let repository: InMemoryRateRepository;
  let container: Container;
  let service: ReturnType<typeof createRateService>;

  beforeEach(() => {
    repository = new InMemoryRateRepository();
    container = createMockContainer(repository);
    service = createRateService(container);
  });

  // ============================================
  // CREATE RATE TESTS
  // ============================================
  describe('createRate', () => {
    it('should create a rate', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Standard room rate',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      expect(rate).toBeDefined();
      expect(rate.name).toBe('Standard Rate');
      expect(rate.isActive).toBe(true);
    });

    it('should default to USD currency', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Standard room rate',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      expect(rate.currency).toBe('USD');
    });

    it('should accept custom currency', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Standard room rate',
        rateType: 'standard',
        basePrice: 100,
        currency: 'EUR',
        applicableItemType: 'room',
      });

      expect(rate.currency).toBe('EUR');
    });

    it('should accept date range', async () => {
      const startDate = '2024-06-01';
      const endDate = '2024-08-31';

      const rate = await service.createRate({
        name: 'Summer Rate',
        description: 'Summer seasonal rate',
        rateType: 'seasonal',
        basePrice: 150,
        applicableItemType: 'room',
        startDate,
        endDate,
      });

      expect(rate.startDate).toBe(startDate);
      expect(rate.endDate).toBe(endDate);
    });

    it('should accept days of week', async () => {
      const rate = await service.createRate({
        name: 'Weekend Rate',
        description: 'Weekend pricing',
        rateType: 'standard',
        basePrice: 120,
        applicableItemType: 'room',
        daysOfWeek: ['friday', 'saturday', 'sunday'],
      });

      expect(rate.daysOfWeek).toContain('friday');
      expect(rate.daysOfWeek).toContain('saturday');
    });

    it('should accept specific item ID', async () => {
      const rate = await service.createRate({
        name: 'Suite Rate',
        description: 'Rate for specific suite',
        rateType: 'standard',
        basePrice: 300,
        applicableItemType: 'room',
        applicableItemId: ROOM_1,
      });

      expect(rate.applicableItemId).toBe(ROOM_1);
    });

    it('should reject short name', async () => {
      await expect(
        service.createRate({
          name: 'R',
          description: 'Description',
          rateType: 'standard',
          basePrice: 100,
          applicableItemType: 'room',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_NAME',
      });
    });

    it('should reject empty description', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: '',
          rateType: 'standard',
          basePrice: 100,
          applicableItemType: 'room',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DESCRIPTION',
      });
    });

    it('should reject invalid rate type', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'invalid' as any,
          basePrice: 100,
          applicableItemType: 'room',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_RATE_TYPE',
      });
    });

    it('should reject negative base price', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'standard',
          basePrice: -50,
          applicableItemType: 'room',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_BASE_PRICE',
      });
    });

    it('should reject unsupported currency', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'standard',
          basePrice: 100,
          currency: 'XYZ',
          applicableItemType: 'room',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CURRENCY',
      });
    });

    it('should reject empty item type', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'standard',
          basePrice: 100,
          applicableItemType: '',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ITEM_TYPE',
      });
    });

    it('should reject invalid item ID', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'standard',
          basePrice: 100,
          applicableItemType: 'room',
          applicableItemId: INVALID_UUID,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ITEM_ID',
      });
    });

    it('should reject end date before start date', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'seasonal',
          basePrice: 100,
          applicableItemType: 'room',
          startDate: '2024-08-01',
          endDate: '2024-06-01',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DATE_RANGE',
      });
    });

    it('should reject invalid day of week', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'standard',
          basePrice: 100,
          applicableItemType: 'room',
          daysOfWeek: ['funday' as any],
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DAY_OF_WEEK',
      });
    });

    it('should reject minStay less than 1', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'standard',
          basePrice: 100,
          applicableItemType: 'room',
          minStay: 0,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_MIN_STAY',
      });
    });

    it('should reject maxStay less than minStay', async () => {
      await expect(
        service.createRate({
          name: 'Standard Rate',
          description: 'Description',
          rateType: 'standard',
          basePrice: 100,
          applicableItemType: 'room',
          minStay: 5,
          maxStay: 2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_STAY_RANGE',
      });
    });
  });

  // ============================================
  // GET RATE TESTS
  // ============================================
  describe('getRate', () => {
    it('should retrieve rate by ID', async () => {
      const created = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      const found = await service.getRate(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent rate', async () => {
      const found = await service.getRate(ROOM_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getRate(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_RATE_ID',
      });
    });
  });

  // ============================================
  // UPDATE RATE TESTS
  // ============================================
  describe('updateRate', () => {
    let rateId: string;

    beforeEach(async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });
      rateId = rate.id;
    });

    it('should update name', async () => {
      const updated = await service.updateRate(rateId, {
        name: 'Premium Rate',
      });

      expect(updated.name).toBe('Premium Rate');
    });

    it('should update base price', async () => {
      const updated = await service.updateRate(rateId, {
        basePrice: 150,
      });

      expect(updated.basePrice).toBe(150);
    });

    it('should update rate type', async () => {
      const updated = await service.updateRate(rateId, {
        rateType: 'promotional',
      });

      expect(updated.rateType).toBe('promotional');
    });

    it('should update priority', async () => {
      const updated = await service.updateRate(rateId, {
        priority: 10,
      });

      expect(updated.priority).toBe(10);
    });

    it('should reject non-existent rate', async () => {
      await expect(
        service.updateRate(ROOM_2, { name: 'New Name' })
      ).rejects.toMatchObject({
        code: 'RATE_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.updateRate(INVALID_UUID, { name: 'New Name' })
      ).rejects.toMatchObject({
        code: 'INVALID_RATE_ID',
      });
    });
  });

  // ============================================
  // DELETE RATE TESTS
  // ============================================
  describe('deleteRate', () => {
    it('should delete rate', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      await service.deleteRate(rate.id);

      const found = await service.getRate(rate.id);
      expect(found).toBeNull();
    });

    it('should reject non-existent rate', async () => {
      await expect(service.deleteRate(ROOM_2)).rejects.toMatchObject({
        code: 'RATE_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.deleteRate(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_RATE_ID',
      });
    });
  });

  // ============================================
  // ACTIVATE/DEACTIVATE TESTS
  // ============================================
  describe('activateRate', () => {
    it('should activate rate', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });
      await service.deactivateRate(rate.id);

      const activated = await service.activateRate(rate.id);
      expect(activated.isActive).toBe(true);
    });

    it('should reject non-existent rate', async () => {
      await expect(service.activateRate(ROOM_2)).rejects.toMatchObject({
        code: 'RATE_NOT_FOUND',
      });
    });
  });

  describe('deactivateRate', () => {
    it('should deactivate rate', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      const deactivated = await service.deactivateRate(rate.id);
      expect(deactivated.isActive).toBe(false);
    });

    it('should reject non-existent rate', async () => {
      await expect(service.deactivateRate(ROOM_2)).rejects.toMatchObject({
        code: 'RATE_NOT_FOUND',
      });
    });
  });

  // ============================================
  // LIST RATES TESTS
  // ============================================
  describe('listRates', () => {
    beforeEach(async () => {
      await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      await service.createRate({
        name: 'Summer Rate',
        description: 'Summer seasonal',
        rateType: 'seasonal',
        basePrice: 150,
        applicableItemType: 'room',
        startDate: '2024-06-01',
        endDate: '2024-08-31',
      });

      await service.createRate({
        name: 'Pool Rate',
        description: 'Pool access',
        rateType: 'standard',
        basePrice: 25,
        applicableItemType: 'pool',
      });
    });

    it('should return all rates', async () => {
      const rates = await service.listRates();
      expect(rates.length).toBe(3);
    });

    it('should filter by rate type', async () => {
      const rates = await service.listRates({ rateType: 'seasonal' });
      expect(rates.length).toBe(1);
    });

    it('should filter by item type', async () => {
      const rates = await service.listRates({ itemType: 'pool' });
      expect(rates.length).toBe(1);
    });

    it('should filter active only', async () => {
      const allRates = await service.listRates();
      await service.deactivateRate(allRates[0].id);

      const activeRates = await service.listRates({ activeOnly: true });
      expect(activeRates.length).toBe(2);
    });
  });

  // ============================================
  // MODIFIER TESTS
  // ============================================
  describe('addModifier', () => {
    let rateId: string;

    beforeEach(async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });
      rateId = rate.id;
    });

    it('should add percentage modifier', async () => {
      const modifier = await service.addModifier({
        rateId,
        name: 'VIP Discount',
        modifierType: 'percentage',
        value: -10,
      });

      expect(modifier).toBeDefined();
      expect(modifier.modifierType).toBe('percentage');
      expect(modifier.value).toBe(-10);
    });

    it('should add fixed modifier', async () => {
      const modifier = await service.addModifier({
        rateId,
        name: 'Service Fee',
        modifierType: 'fixed',
        value: 25,
      });

      expect(modifier).toBeDefined();
      expect(modifier.modifierType).toBe('fixed');
      expect(modifier.value).toBe(25);
    });

    it('should reject invalid modifier type', async () => {
      await expect(
        service.addModifier({
          rateId,
          name: 'Invalid',
          modifierType: 'invalid' as any,
          value: 10,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_MODIFIER_TYPE',
      });
    });

    it('should reject percentage over 1000', async () => {
      await expect(
        service.addModifier({
          rateId,
          name: 'Invalid',
          modifierType: 'percentage',
          value: 1500,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_MODIFIER_VALUE',
      });
    });

    it('should reject non-existent rate', async () => {
      await expect(
        service.addModifier({
          rateId: ROOM_2,
          name: 'Test',
          modifierType: 'fixed',
          value: 10,
        })
      ).rejects.toMatchObject({
        code: 'RATE_NOT_FOUND',
      });
    });
  });

  describe('getModifiers', () => {
    it('should return modifiers for rate', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      await service.addModifier({
        rateId: rate.id,
        name: 'Discount',
        modifierType: 'percentage',
        value: -10,
      });

      await service.addModifier({
        rateId: rate.id,
        name: 'Fee',
        modifierType: 'fixed',
        value: 5,
      });

      const modifiers = await service.getModifiers(rate.id);
      expect(modifiers.length).toBe(2);
    });

    it('should reject non-existent rate', async () => {
      await expect(service.getModifiers(ROOM_2)).rejects.toMatchObject({
        code: 'RATE_NOT_FOUND',
      });
    });
  });

  describe('removeModifier', () => {
    it('should remove modifier', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      const modifier = await service.addModifier({
        rateId: rate.id,
        name: 'Discount',
        modifierType: 'percentage',
        value: -10,
      });

      await service.removeModifier(modifier.id);

      const modifiers = await service.getModifiers(rate.id);
      expect(modifiers.length).toBe(0);
    });

    it('should reject invalid modifier ID', async () => {
      await expect(service.removeModifier(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_MODIFIER_ID',
      });
    });
  });

  // ============================================
  // CALCULATE PRICE TESTS
  // ============================================
  describe('calculatePrice', () => {
    it('should calculate base price', async () => {
      await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      const result = await service.calculatePrice({
        itemType: 'room',
        itemId: null,
        date: '2024-07-15',
      });

      expect(result.basePrice).toBe(100);
      expect(result.totalPrice).toBe(100);
    });

    it('should calculate price for multiple nights', async () => {
      await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      const result = await service.calculatePrice({
        itemType: 'room',
        itemId: null,
        date: '2024-07-15',
        nights: 3,
      });

      expect(result.basePrice).toBe(300);
      expect(result.totalPrice).toBe(300);
    });

    it('should apply percentage modifier', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      await service.addModifier({
        rateId: rate.id,
        name: 'VIP Discount',
        modifierType: 'percentage',
        value: -10,
      });

      const result = await service.calculatePrice({
        itemType: 'room',
        itemId: null,
        date: '2024-07-15',
      });

      expect(result.modifiers.length).toBe(1);
      expect(result.totalPrice).toBe(90);
    });

    it('should apply fixed modifier', async () => {
      const rate = await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      await service.addModifier({
        rateId: rate.id,
        name: 'Service Fee',
        modifierType: 'fixed',
        value: 15,
      });

      const result = await service.calculatePrice({
        itemType: 'room',
        itemId: null,
        date: '2024-07-15',
      });

      expect(result.modifiers.length).toBe(1);
      expect(result.totalPrice).toBe(115);
    });

    it('should return zero when no rate applies', async () => {
      const result = await service.calculatePrice({
        itemType: 'spa',
        itemId: null,
        date: '2024-07-15',
      });

      expect(result.basePrice).toBe(0);
      expect(result.totalPrice).toBe(0);
      expect(result.appliedRate).toBeNull();
    });
  });

  // ============================================
  // GET BEST RATE TESTS
  // ============================================
  describe('getBestRate', () => {
    it('should return highest priority rate', async () => {
      await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
        priority: 0,
      });

      await service.createRate({
        name: 'Premium Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 150,
        applicableItemType: 'room',
        priority: 10,
      });

      const best = await service.getBestRate('room', null, '2024-07-15');
      expect(best?.name).toBe('Premium Rate');
    });

    it('should return null when no rate applies', async () => {
      const best = await service.getBestRate('spa', null, '2024-07-15');
      expect(best).toBeNull();
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no rates', async () => {
      const stats = await service.getStats();

      expect(stats.totalRates).toBe(0);
      expect(stats.avgBasePrice).toBe(0);
    });

    it('should count rates by type', async () => {
      await service.createRate({
        name: 'Standard Rate',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      await service.createRate({
        name: 'Summer Rate',
        description: 'Description',
        rateType: 'seasonal',
        basePrice: 150,
        applicableItemType: 'room',
      });

      const stats = await service.getStats();

      expect(stats.totalRates).toBe(2);
      expect(stats.byType.standard).toBe(1);
      expect(stats.byType.seasonal).toBe(1);
    });

    it('should calculate average base price', async () => {
      await service.createRate({
        name: 'Rate 1',
        description: 'Description',
        rateType: 'standard',
        basePrice: 100,
        applicableItemType: 'room',
      });

      await service.createRate({
        name: 'Rate 2',
        description: 'Description',
        rateType: 'standard',
        basePrice: 200,
        applicableItemType: 'room',
      });

      const stats = await service.getStats();
      expect(stats.avgBasePrice).toBe(150);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getRateTypes', () => {
    it('should return all rate types', () => {
      const types = service.getRateTypes();

      expect(types).toContain('standard');
      expect(types).toContain('seasonal');
      expect(types).toContain('promotional');
      expect(types).toContain('event');
      expect(types).toContain('package');
    });
  });

  describe('getDaysOfWeek', () => {
    it('should return all days of week', () => {
      const days = service.getDaysOfWeek();

      expect(days.length).toBe(7);
      expect(days).toContain('monday');
      expect(days).toContain('sunday');
    });
  });

  describe('getCurrencies', () => {
    it('should return supported currencies', () => {
      const currencies = service.getCurrencies();

      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
    });
  });
});
