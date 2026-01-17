/**
 * Package Service Tests
 *
 * Unit tests for the Package/Promotion Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPackageService, PackageServiceError } from '../../src/lib/services/package.service';
import { InMemoryPackageRepository } from '../../src/lib/repositories/package.repository.memory';
import type { Container } from '../../src/lib/container/types';

// Test UUIDs
const GUEST_1 = '11111111-1111-1111-1111-111111111111';
const BOOKING_1 = '22222222-2222-2222-2222-222222222222';
const ROOM_TYPE_1 = '33333333-3333-3333-3333-333333333333';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(packageRepository: InMemoryPackageRepository): Container {
  return {
    packageRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

describe('PackageService', () => {
  let repository: InMemoryPackageRepository;
  let container: Container;
  let service: ReturnType<typeof createPackageService>;

  beforeEach(() => {
    repository = new InMemoryPackageRepository();
    container = createMockContainer(repository);
    service = createPackageService(container);
  });

  // ============================================
  // CREATE PACKAGE TESTS
  // ============================================
  describe('createPackage', () => {
    it('should create package with required fields', async () => {
      const pkg = await service.createPackage({
        name: 'Romantic Getaway',
        code: 'ROMANCE',
        type: 'romantic',
        description: 'A perfect romantic escape for couples.',
        includes: ['Champagne on arrival', 'Couples spa treatment', 'Romantic dinner'],
        basePrice: 500,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      expect(pkg).toBeDefined();
      expect(pkg.name).toBe('Romantic Getaway');
      expect(pkg.code).toBe('ROMANCE');
      expect(pkg.status).toBe('draft');
      expect(pkg.finalPrice).toBe(500);
    });

    it('should create package with discount', async () => {
      const pkg = await service.createPackage({
        name: 'Summer Special',
        code: 'SUMMER',
        type: 'family',
        description: 'Family fun package for the summer.',
        includes: ['Pool access', 'Kids club', 'Family dinner'],
        basePrice: 400,
        discountPercentage: 20,
        validFrom: '2026-06-01',
        validTo: '2026-08-31',
      });

      expect(pkg.basePrice).toBe(400);
      expect(pkg.discountPercentage).toBe(20);
      expect(pkg.finalPrice).toBe(320);
    });

    it('should uppercase the code', async () => {
      const pkg = await service.createPackage({
        name: 'Test Package',
        code: 'test',
        type: 'room_only',
        description: 'This is a test package description.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      expect(pkg.code).toBe('TEST');
    });

    it('should reject empty name', async () => {
      await expect(
        service.createPackage({
          name: '',
          code: 'TEST',
          type: 'room_only',
          description: 'This is a test package description.',
          includes: ['Room'],
          basePrice: 100,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_NAME',
      });
    });

    it('should reject empty code', async () => {
      await expect(
        service.createPackage({
          name: 'Test',
          code: '',
          type: 'room_only',
          description: 'This is a test package description.',
          includes: ['Room'],
          basePrice: 100,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CODE',
      });
    });

    it('should reject duplicate code', async () => {
      await service.createPackage({
        name: 'First Package',
        code: 'DUP',
        type: 'room_only',
        description: 'This is a test package description.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      await expect(
        service.createPackage({
          name: 'Second Package',
          code: 'DUP',
          type: 'room_only',
          description: 'This is another test package.',
          includes: ['Room'],
          basePrice: 150,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'DUPLICATE_CODE',
      });
    });

    it('should reject invalid type', async () => {
      await expect(
        service.createPackage({
          name: 'Test',
          code: 'TEST',
          type: 'invalid' as any,
          description: 'This is a test package description.',
          includes: ['Room'],
          basePrice: 100,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_TYPE',
      });
    });

    it('should reject short description', async () => {
      await expect(
        service.createPackage({
          name: 'Test',
          code: 'TEST',
          type: 'room_only',
          description: 'Short',
          includes: ['Room'],
          basePrice: 100,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DESCRIPTION',
      });
    });

    it('should reject empty includes', async () => {
      await expect(
        service.createPackage({
          name: 'Test',
          code: 'TEST',
          type: 'room_only',
          description: 'This is a test package description.',
          includes: [],
          basePrice: 100,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_INCLUDES',
      });
    });

    it('should reject non-positive price', async () => {
      await expect(
        service.createPackage({
          name: 'Test',
          code: 'TEST',
          type: 'room_only',
          description: 'This is a test package description.',
          includes: ['Room'],
          basePrice: 0,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PRICE',
      });
    });

    it('should reject invalid discount', async () => {
      await expect(
        service.createPackage({
          name: 'Test',
          code: 'TEST',
          type: 'room_only',
          description: 'This is a test package description.',
          includes: ['Room'],
          basePrice: 100,
          discountPercentage: 110,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DISCOUNT',
      });
    });

    it('should reject invalid date range', async () => {
      await expect(
        service.createPackage({
          name: 'Test',
          code: 'TEST',
          type: 'room_only',
          description: 'This is a test package description.',
          includes: ['Room'],
          basePrice: 100,
          validFrom: '2026-12-31',
          validTo: '2026-01-01',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DATE_RANGE',
      });
    });
  });

  // ============================================
  // GET PACKAGE TESTS
  // ============================================
  describe('getPackage', () => {
    it('should retrieve package by ID', async () => {
      const created = await service.createPackage({
        name: 'Test Package',
        code: 'TEST',
        type: 'room_only',
        description: 'This is a test package description.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      const found = await service.getPackage(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent package', async () => {
      const found = await service.getPackage(GUEST_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getPackage(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_PACKAGE_ID',
      });
    });
  });

  describe('getPackageByCode', () => {
    it('should retrieve package by code', async () => {
      await service.createPackage({
        name: 'Test Package',
        code: 'FINDME',
        type: 'room_only',
        description: 'This is a test package description.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      const found = await service.getPackageByCode('findme');
      expect(found).toBeDefined();
      expect(found?.code).toBe('FINDME');
    });
  });

  // ============================================
  // UPDATE PACKAGE TESTS
  // ============================================
  describe('updatePackage', () => {
    let packageId: string;

    beforeEach(async () => {
      const pkg = await service.createPackage({
        name: 'Original Name',
        code: 'ORIG',
        type: 'room_only',
        description: 'Original description for the package.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      packageId = pkg.id;
    });

    it('should update package name', async () => {
      const updated = await service.updatePackage(packageId, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should recalculate final price on discount change', async () => {
      const updated = await service.updatePackage(packageId, {
        discountPercentage: 25,
      });

      expect(updated.finalPrice).toBe(75);
    });

    it('should reject invalid discount', async () => {
      await expect(
        service.updatePackage(packageId, { discountPercentage: -10 })
      ).rejects.toMatchObject({
        code: 'INVALID_DISCOUNT',
      });
    });
  });

  // ============================================
  // DELETE PACKAGE TESTS
  // ============================================
  describe('deletePackage', () => {
    it('should delete draft package', async () => {
      const pkg = await service.createPackage({
        name: 'To Delete',
        code: 'DEL',
        type: 'room_only',
        description: 'This package will be deleted.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      await service.deletePackage(pkg.id);

      const found = await service.getPackage(pkg.id);
      expect(found).toBeNull();
    });

    it('should reject active package', async () => {
      const pkg = await service.createPackage({
        name: 'Active Package',
        code: 'ACTIVE',
        type: 'room_only',
        description: 'This package is active and cannot be deleted.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });
      await service.activatePackage(pkg.id);

      await expect(service.deletePackage(pkg.id)).rejects.toMatchObject({
        code: 'CANNOT_DELETE_ACTIVE',
      });
    });
  });

  // ============================================
  // STATUS MANAGEMENT TESTS
  // ============================================
  describe('activatePackage', () => {
    it('should activate package', async () => {
      const pkg = await service.createPackage({
        name: 'Test',
        code: 'ACT',
        type: 'room_only',
        description: 'This package will be activated.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });

      const activated = await service.activatePackage(pkg.id);
      expect(activated.status).toBe('active');
    });

    it('should reject already active', async () => {
      const pkg = await service.createPackage({
        name: 'Test',
        code: 'ACT2',
        type: 'room_only',
        description: 'This package is already active.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });
      await service.activatePackage(pkg.id);

      await expect(service.activatePackage(pkg.id)).rejects.toMatchObject({
        code: 'ALREADY_ACTIVE',
      });
    });

    it('should reject expired package', async () => {
      const pkg = await service.createPackage({
        name: 'Expired',
        code: 'EXP',
        type: 'room_only',
        description: 'This package has already expired.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2020-01-01',
        validTo: '2020-12-31',
      });

      await expect(service.activatePackage(pkg.id)).rejects.toMatchObject({
        code: 'PACKAGE_EXPIRED',
      });
    });
  });

  describe('deactivatePackage', () => {
    it('should deactivate package', async () => {
      const pkg = await service.createPackage({
        name: 'Test',
        code: 'DEACT',
        type: 'room_only',
        description: 'This package will be deactivated.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });
      await service.activatePackage(pkg.id);

      const deactivated = await service.deactivatePackage(pkg.id);
      expect(deactivated.status).toBe('inactive');
    });
  });

  describe('publishPackage', () => {
    it('should publish draft package', async () => {
      const pkg = await service.createPackage({
        name: 'Draft Package',
        code: 'PUB',
        type: 'room_only',
        description: 'This draft package will be published.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });

      const published = await service.publishPackage(pkg.id);
      expect(published.status).toBe('active');
    });

    it('should reject non-draft package', async () => {
      const pkg = await service.createPackage({
        name: 'Active Package',
        code: 'PUB2',
        type: 'room_only',
        description: 'This package is already active.',
        includes: ['Room'],
        basePrice: 100,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });
      await service.activatePackage(pkg.id);

      await expect(service.publishPackage(pkg.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  // ============================================
  // AVAILABILITY TESTS
  // ============================================
  describe('checkAvailability', () => {
    let packageId: string;

    beforeEach(async () => {
      const pkg = await service.createPackage({
        name: 'Available Package',
        code: 'AVAIL',
        type: 'romantic',
        description: 'This package is available for booking.',
        includes: ['Room', 'Dinner'],
        basePrice: 300,
        minNights: 2,
        maxNights: 7,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      await service.activatePackage(pkg.id);
      packageId = pkg.id;
    });

    it('should return true for available package', async () => {
      const available = await service.checkAvailability(packageId, '2026-06-15', 3);
      expect(available).toBe(true);
    });

    it('should return false for inactive package', async () => {
      await service.deactivatePackage(packageId);
      const available = await service.checkAvailability(packageId, '2026-06-15', 3);
      expect(available).toBe(false);
    });

    it('should return false for date outside range', async () => {
      const available = await service.checkAvailability(packageId, '2027-06-15', 3);
      expect(available).toBe(false);
    });

    it('should return false for nights below minimum', async () => {
      const available = await service.checkAvailability(packageId, '2026-06-15', 1);
      expect(available).toBe(false);
    });
  });

  // ============================================
  // REDEMPTION TESTS
  // ============================================
  describe('redeemPackage', () => {
    let packageId: string;

    beforeEach(async () => {
      const pkg = await service.createPackage({
        name: 'Redeemable Package',
        code: 'REDEEM',
        type: 'all_inclusive',
        description: 'This all-inclusive package can be redeemed.',
        includes: ['Room', 'All meals', 'Drinks'],
        basePrice: 500,
        discountPercentage: 10,
        maxRedemptions: 5,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });
      await service.activatePackage(pkg.id);
      packageId = pkg.id;
    });

    it('should redeem package', async () => {
      const redemption = await service.redeemPackage({
        packageId,
        bookingId: BOOKING_1,
        guestId: GUEST_1,
      });

      expect(redemption).toBeDefined();
      expect(redemption.totalAmount).toBe(450);
      expect(redemption.discountAmount).toBe(50);
    });

    it('should increment redemption count', async () => {
      await service.redeemPackage({
        packageId,
        bookingId: BOOKING_1,
        guestId: GUEST_1,
      });

      const pkg = await service.getPackage(packageId);
      expect(pkg?.currentRedemptions).toBe(1);
    });

    it('should reject inactive package', async () => {
      await service.deactivatePackage(packageId);

      await expect(
        service.redeemPackage({
          packageId,
          bookingId: BOOKING_1,
          guestId: GUEST_1,
        })
      ).rejects.toMatchObject({
        code: 'PACKAGE_NOT_ACTIVE',
      });
    });

    it('should reject invalid booking ID', async () => {
      await expect(
        service.redeemPackage({
          packageId,
          bookingId: INVALID_UUID,
          guestId: GUEST_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_BOOKING_ID',
      });
    });
  });

  // ============================================
  // PRICING TESTS
  // ============================================
  describe('calculatePrice', () => {
    let packageId: string;

    beforeEach(async () => {
      const pkg = await service.createPackage({
        name: 'Priced Package',
        code: 'PRICE',
        type: 'bed_and_breakfast',
        description: 'Bed and breakfast package for pricing test.',
        includes: ['Room', 'Breakfast'],
        basePrice: 100,
        discountPercentage: 15,
        minNights: 1,
        maxNights: 14,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      packageId = pkg.id;
    });

    it('should calculate price for nights', async () => {
      const price = await service.calculatePrice(packageId, 3);

      expect(price.baseTotal).toBe(300);
      expect(price.discount).toBe(45);
      expect(price.finalTotal).toBe(255);
    });

    it('should reject below minimum nights', async () => {
      const pkg = await service.createPackage({
        name: 'Min Nights',
        code: 'MIN',
        type: 'room_only',
        description: 'Package with minimum nights requirement.',
        includes: ['Room'],
        basePrice: 100,
        minNights: 3,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      await expect(service.calculatePrice(pkg.id, 2)).rejects.toMatchObject({
        code: 'BELOW_MIN_NIGHTS',
      });
    });

    it('should reject above maximum nights', async () => {
      await expect(service.calculatePrice(packageId, 20)).rejects.toMatchObject({
        code: 'ABOVE_MAX_NIGHTS',
      });
    });
  });

  describe('applyDiscount', () => {
    it('should apply new discount', async () => {
      const pkg = await service.createPackage({
        name: 'Discount Test',
        code: 'DISC',
        type: 'room_only',
        description: 'Package for testing discount application.',
        includes: ['Room'],
        basePrice: 200,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      const discounted = await service.applyDiscount(pkg.id, 30);
      expect(discounted.discountPercentage).toBe(30);
      expect(discounted.finalPrice).toBe(140);
    });

    it('should reject invalid discount', async () => {
      const pkg = await service.createPackage({
        name: 'Invalid Discount',
        code: 'INVD',
        type: 'room_only',
        description: 'Package for testing invalid discount.',
        includes: ['Room'],
        basePrice: 200,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      await expect(service.applyDiscount(pkg.id, -5)).rejects.toMatchObject({
        code: 'INVALID_DISCOUNT',
      });
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats', async () => {
      const stats = await service.getStats();

      expect(stats.totalPackages).toBe(0);
      expect(stats.activePackages).toBe(0);
      expect(stats.totalRedemptions).toBe(0);
    });

    it('should count packages and redemptions', async () => {
      const pkg = await service.createPackage({
        name: 'Stats Package',
        code: 'STATS',
        type: 'spa',
        description: 'Spa package for statistics testing.',
        includes: ['Spa access', 'Massage'],
        basePrice: 300,
        discountPercentage: 10,
        validFrom: '2026-01-01',
        validTo: '2099-12-31',
      });
      await service.activatePackage(pkg.id);

      await service.redeemPackage({
        packageId: pkg.id,
        bookingId: BOOKING_1,
        guestId: GUEST_1,
      });

      const stats = await service.getStats();

      expect(stats.totalPackages).toBe(1);
      expect(stats.activePackages).toBe(1);
      expect(stats.totalRedemptions).toBe(1);
      expect(stats.totalRevenue).toBe(270);
      expect(stats.totalDiscounts).toBe(30);
      expect(stats.byType.spa).toBe(1);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getPackageTypes', () => {
    it('should return all package types', () => {
      const types = service.getPackageTypes();

      expect(types).toContain('room_only');
      expect(types).toContain('all_inclusive');
      expect(types).toContain('romantic');
      expect(types).toContain('family');
    });
  });

  describe('getPackageStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getPackageStatuses();

      expect(statuses).toContain('draft');
      expect(statuses).toContain('active');
      expect(statuses).toContain('sold_out');
    });
  });
});



