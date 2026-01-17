/**
 * Coupon Service Unit Tests
 *
 * Comprehensive tests for the coupon service covering:
 * - Coupon CRUD operations
 * - Validation and application
 * - Usage tracking
 * - Discount calculations
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCouponService, CouponServiceError } from '../../src/lib/services/coupon.service';
import { InMemoryCouponRepository } from '../../src/lib/repositories/coupon.repository.memory';
import type { Container, Coupon, CouponType, CouponScope } from '../../src/lib/container/types';

// Test data
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CREATOR_ID = '22222222-2222-2222-2222-222222222222';
const TEST_COUPON_ID = '33333333-3333-3333-3333-333333333333';
const TEST_ORDER_ID = '44444444-4444-4444-4444-444444444444';
const TEST_PRODUCT_ID = '55555555-5555-5555-5555-555555555555';

function createMockContainer(couponRepo: InMemoryCouponRepository): Container {
  return {
    couponRepository: couponRepo,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as Container;
}

function createTestCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: TEST_COUPON_ID,
    code: 'SAVE10',
    name: 'Save 10%',
    description: 'Get 10% off your order',
    type: 'percentage',
    value: 10,
    scope: 'order',
    scopeIds: null,
    minOrderAmount: null,
    maxDiscountAmount: null,
    usageLimit: null,
    usageCount: 0,
    perUserLimit: null,
    startDate: '2020-01-01T00:00:00.000Z',
    endDate: '2099-12-31T23:59:59.000Z',
    isActive: true,
    createdBy: TEST_CREATOR_ID,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  };
}

describe('CouponService', () => {
  let couponRepo: InMemoryCouponRepository;
  let container: Container;
  let couponService: ReturnType<typeof createCouponService>;

  beforeEach(() => {
    couponRepo = new InMemoryCouponRepository();
    container = createMockContainer(couponRepo);
    couponService = createCouponService(container);
  });

  // =============================================
  // CREATE COUPON TESTS
  // =============================================
  describe('createCoupon', () => {
    it('should create a percentage coupon', async () => {
      const result = await couponService.createCoupon({
        code: 'SUMMER20',
        name: 'Summer Sale',
        type: 'percentage',
        value: 20,
        scope: 'order',
        createdBy: TEST_CREATOR_ID,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBe('SUMMER20');
      expect(result.type).toBe('percentage');
      expect(result.value).toBe(20);
      expect(result.isActive).toBe(true);
      expect(result.usageCount).toBe(0);
    });

    it('should create a fixed amount coupon', async () => {
      const result = await couponService.createCoupon({
        code: 'FLAT25',
        name: '$25 Off',
        type: 'fixed_amount',
        value: 25,
        scope: 'order',
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.type).toBe('fixed_amount');
      expect(result.value).toBe(25);
    });

    it('should create a free shipping coupon', async () => {
      const result = await couponService.createCoupon({
        code: 'FREESHIP',
        name: 'Free Shipping',
        type: 'free_shipping',
        value: 1,
        scope: 'order',
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.type).toBe('free_shipping');
    });

    it('should normalize code to uppercase', async () => {
      const result = await couponService.createCoupon({
        code: 'lowercase',
        name: 'Test',
        type: 'percentage',
        value: 10,
        scope: 'order',
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.code).toBe('LOWERCASE');
    });

    it('should create coupon with usage limits', async () => {
      const result = await couponService.createCoupon({
        code: 'LIMITED',
        name: 'Limited Coupon',
        type: 'percentage',
        value: 15,
        scope: 'order',
        usageLimit: 100,
        perUserLimit: 2,
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.usageLimit).toBe(100);
      expect(result.perUserLimit).toBe(2);
    });

    it('should create coupon with min order amount', async () => {
      const result = await couponService.createCoupon({
        code: 'MIN50',
        name: 'Min $50 Order',
        type: 'percentage',
        value: 10,
        scope: 'order',
        minOrderAmount: 50,
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.minOrderAmount).toBe(50);
    });

    it('should create coupon with max discount cap', async () => {
      const result = await couponService.createCoupon({
        code: 'MAX20',
        name: 'Max $20 Discount',
        type: 'percentage',
        value: 50,
        scope: 'order',
        maxDiscountAmount: 20,
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.maxDiscountAmount).toBe(20);
    });

    it('should create product-specific coupon', async () => {
      const result = await couponService.createCoupon({
        code: 'PROD10',
        name: 'Product Discount',
        type: 'percentage',
        value: 10,
        scope: 'product',
        scopeIds: [TEST_PRODUCT_ID],
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.scope).toBe('product');
      expect(result.scopeIds).toContain(TEST_PRODUCT_ID);
    });

    it('should create coupon with date range', async () => {
      const result = await couponService.createCoupon({
        code: 'HOLIDAY',
        name: 'Holiday Sale',
        type: 'percentage',
        value: 25,
        scope: 'order',
        startDate: '2025-12-20T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.000Z',
        createdBy: TEST_CREATOR_ID,
      });

      expect(result.startDate).toBe('2025-12-20T00:00:00.000Z');
      expect(result.endDate).toBe('2025-12-31T23:59:59.000Z');
    });

    it('should throw error for short code', async () => {
      await expect(
        couponService.createCoupon({
          code: 'AB',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Coupon code must be 4-20 alphanumeric characters');
    });

    it('should throw error for long code', async () => {
      await expect(
        couponService.createCoupon({
          code: 'A'.repeat(25),
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Coupon code must be 4-20 alphanumeric characters');
    });

    it('should throw error for duplicate code', async () => {
      couponRepo.addCoupon(createTestCoupon({ code: 'DUPLICATE' }));

      await expect(
        couponService.createCoupon({
          code: 'DUPLICATE',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('A coupon with this code already exists');
    });

    it('should throw error for short name', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'A',
          type: 'percentage',
          value: 10,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Name must be at least 2 characters');
    });

    it('should throw error for long name', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'A'.repeat(101),
          type: 'percentage',
          value: 10,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Name cannot exceed 100 characters');
    });

    it('should throw error for invalid type', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'invalid' as CouponType,
          value: 10,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Invalid coupon type');
    });

    it('should throw error for invalid scope', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'invalid' as CouponScope,
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Invalid coupon scope');
    });

    it('should throw error for zero value', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 0,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Discount value must be positive');
    });

    it('should throw error for negative value', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: -10,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Discount value must be positive');
    });

    it('should throw error for percentage over 100', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 150,
          scope: 'order',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Percentage discount cannot exceed 100%');
    });

    it('should throw error for negative min order amount', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          minOrderAmount: -50,
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Minimum order amount cannot be negative');
    });

    it('should throw error for zero max discount', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          maxDiscountAmount: 0,
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Maximum discount amount must be positive');
    });

    it('should throw error for zero usage limit', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          usageLimit: 0,
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Usage limit must be at least 1');
    });

    it('should throw error for zero per-user limit', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          perUserLimit: 0,
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Per-user limit must be at least 1');
    });

    it('should throw error when end date before start date', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          startDate: '2025-12-31T00:00:00.000Z',
          endDate: '2025-01-01T00:00:00.000Z',
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('End date must be after start date');
    });

    it('should throw error for invalid creator ID', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'order',
          createdBy: 'invalid',
        })
      ).rejects.toThrow('Invalid creator ID format');
    });

    it('should throw error for invalid scope ID', async () => {
      await expect(
        couponService.createCoupon({
          code: 'VALID',
          name: 'Test',
          type: 'percentage',
          value: 10,
          scope: 'product',
          scopeIds: ['invalid-id'],
          createdBy: TEST_CREATOR_ID,
        })
      ).rejects.toThrow('Invalid scope ID format');
    });
  });

  // =============================================
  // GET COUPON TESTS
  // =============================================
  describe('getCouponById', () => {
    it('should get coupon by ID', async () => {
      couponRepo.addCoupon(createTestCoupon());

      const result = await couponService.getCouponById(TEST_COUPON_ID);

      expect(result).toBeDefined();
      expect(result?.code).toBe('SAVE10');
    });

    it('should return null for non-existent ID', async () => {
      const result = await couponService.getCouponById(TEST_USER_ID);
      expect(result).toBeNull();
    });

    it('should throw error for invalid ID format', async () => {
      await expect(couponService.getCouponById('invalid')).rejects.toThrow(
        'Invalid coupon ID format'
      );
    });
  });

  describe('getCouponByCode', () => {
    it('should get coupon by code', async () => {
      couponRepo.addCoupon(createTestCoupon({ code: 'FINDME' }));

      const result = await couponService.getCouponByCode('FINDME');

      expect(result).toBeDefined();
      expect(result?.code).toBe('FINDME');
    });

    it('should be case insensitive', async () => {
      couponRepo.addCoupon(createTestCoupon({ code: 'UPPER' }));

      const result = await couponService.getCouponByCode('upper');

      expect(result).toBeDefined();
    });

    it('should return null for non-existent code', async () => {
      const result = await couponService.getCouponByCode('NOTFOUND');
      expect(result).toBeNull();
    });

    it('should throw error for empty code', async () => {
      await expect(couponService.getCouponByCode('')).rejects.toThrow('Coupon code is required');
    });
  });

  // =============================================
  // LIST COUPONS TESTS
  // =============================================
  describe('listCoupons', () => {
    beforeEach(() => {
      couponRepo.addCoupon(createTestCoupon({ id: '11111111-1111-1111-1111-111111111111', code: 'PERCENT1', type: 'percentage', scope: 'order' }));
      couponRepo.addCoupon(createTestCoupon({ id: '22222222-2222-2222-2222-222222222222', code: 'FIXED1', type: 'fixed_amount', scope: 'booking' }));
      couponRepo.addCoupon(createTestCoupon({ id: '33333333-3333-3333-3333-333333333333', code: 'INACTIVE', type: 'free_shipping', isActive: false }));
    });

    it('should list all coupons', async () => {
      const result = await couponService.listCoupons();
      expect(result.length).toBe(3);
    });

    it('should filter by type', async () => {
      const result = await couponService.listCoupons({ type: 'percentage' });
      expect(result.length).toBe(1);
      expect(result[0].code).toBe('PERCENT1');
    });

    it('should filter by scope', async () => {
      const result = await couponService.listCoupons({ scope: 'booking' });
      expect(result.length).toBe(1);
      expect(result[0].code).toBe('FIXED1');
    });

    it('should filter by active status', async () => {
      const result = await couponService.listCoupons({ isActive: true });
      expect(result.length).toBe(2);
    });

    it('should search by code', async () => {
      const result = await couponService.listCoupons({ search: 'fixed' });
      expect(result.length).toBe(1);
    });

    it('should throw error for invalid type filter', async () => {
      await expect(
        couponService.listCoupons({ type: 'invalid' as CouponType })
      ).rejects.toThrow('Invalid type filter');
    });

    it('should throw error for invalid scope filter', async () => {
      await expect(
        couponService.listCoupons({ scope: 'invalid' as CouponScope })
      ).rejects.toThrow('Invalid scope filter');
    });
  });

  // =============================================
  // UPDATE COUPON TESTS
  // =============================================
  describe('updateCoupon', () => {
    beforeEach(() => {
      couponRepo.addCoupon(createTestCoupon());
    });

    it('should update coupon name', async () => {
      const result = await couponService.updateCoupon(TEST_COUPON_ID, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should update coupon value', async () => {
      const result = await couponService.updateCoupon(TEST_COUPON_ID, { value: 25 });
      expect(result.value).toBe(25);
    });

    it('should update usage limits', async () => {
      const result = await couponService.updateCoupon(TEST_COUPON_ID, {
        usageLimit: 50,
        perUserLimit: 3,
      });
      expect(result.usageLimit).toBe(50);
      expect(result.perUserLimit).toBe(3);
    });

    it('should deactivate coupon', async () => {
      const result = await couponService.updateCoupon(TEST_COUPON_ID, { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('should throw error for non-existent coupon', async () => {
      await expect(
        couponService.updateCoupon(TEST_USER_ID, { name: 'Test' })
      ).rejects.toThrow('Coupon not found');
    });

    it('should throw error for invalid ID', async () => {
      await expect(
        couponService.updateCoupon('invalid', { name: 'Test' })
      ).rejects.toThrow('Invalid coupon ID format');
    });

    it('should throw error for short name', async () => {
      await expect(
        couponService.updateCoupon(TEST_COUPON_ID, { name: 'A' })
      ).rejects.toThrow('Name must be at least 2 characters');
    });

    it('should throw error for zero value', async () => {
      await expect(
        couponService.updateCoupon(TEST_COUPON_ID, { value: 0 })
      ).rejects.toThrow('Discount value must be positive');
    });
  });

  // =============================================
  // DELETE COUPON TESTS
  // =============================================
  describe('deleteCoupon', () => {
    it('should delete unused coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({ usageCount: 0 }));

      await couponService.deleteCoupon(TEST_COUPON_ID);

      const result = await couponService.getCouponById(TEST_COUPON_ID);
      expect(result).toBeNull();
    });

    it('should throw error for used coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({ usageCount: 5 }));

      await expect(couponService.deleteCoupon(TEST_COUPON_ID)).rejects.toThrow(
        'Cannot delete a coupon that has been used'
      );
    });

    it('should throw error for non-existent coupon', async () => {
      await expect(couponService.deleteCoupon(TEST_COUPON_ID)).rejects.toThrow('Coupon not found');
    });

    it('should throw error for invalid ID', async () => {
      await expect(couponService.deleteCoupon('invalid')).rejects.toThrow(
        'Invalid coupon ID format'
      );
    });
  });

  // =============================================
  // DEACTIVATE COUPON TESTS
  // =============================================
  describe('deactivateCoupon', () => {
    it('should deactivate coupon', async () => {
      couponRepo.addCoupon(createTestCoupon());

      const result = await couponService.deactivateCoupon(TEST_COUPON_ID);

      expect(result.isActive).toBe(false);
    });

    it('should throw error for non-existent coupon', async () => {
      await expect(couponService.deactivateCoupon(TEST_COUPON_ID)).rejects.toThrow(
        'Coupon not found'
      );
    });

    it('should throw error for invalid ID', async () => {
      await expect(couponService.deactivateCoupon('invalid')).rejects.toThrow(
        'Invalid coupon ID format'
      );
    });
  });

  // =============================================
  // VALIDATE COUPON TESTS
  // =============================================
  describe('validateCoupon', () => {
    it('should validate valid coupon', async () => {
      couponRepo.addCoupon(createTestCoupon());

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(true);
      expect(result.coupon).toBeDefined();
      expect(result.discountAmount).toBe(10);
    });

    it('should return invalid for non-existent coupon', async () => {
      const result = await couponService.validateCoupon({
        code: 'NOTEXIST',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('COUPON_NOT_FOUND');
    });

    it('should return invalid for inactive coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({ isActive: false }));

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('COUPON_INACTIVE');
    });

    it('should return invalid for not started coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({ startDate: '2099-01-01T00:00:00.000Z' }));

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('COUPON_NOT_STARTED');
    });

    it('should return invalid for expired coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({ endDate: '2020-01-01T00:00:00.000Z' }));

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('COUPON_EXPIRED');
    });

    it('should return invalid for depleted coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({ usageLimit: 10, usageCount: 10 }));

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('COUPON_DEPLETED');
    });

    it('should return invalid when user limit exceeded', async () => {
      couponRepo.addCoupon(createTestCoupon({ perUserLimit: 1 }));
      couponRepo.addUsage({
        id: 'usage-1',
        couponId: TEST_COUPON_ID,
        userId: TEST_USER_ID,
        orderId: TEST_ORDER_ID,
        bookingId: null,
        discountAmount: 10,
        createdAt: new Date().toISOString(),
      });

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('USER_LIMIT_EXCEEDED');
    });

    it('should return invalid when min amount not met', async () => {
      couponRepo.addCoupon(createTestCoupon({ minOrderAmount: 100 }));

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 50,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('MIN_AMOUNT_NOT_MET');
    });

    it('should return invalid for non-applicable product scope', async () => {
      couponRepo.addCoupon(createTestCoupon({
        scope: 'product',
        scopeIds: [TEST_PRODUCT_ID],
      }));

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
        productIds: ['66666666-6666-6666-6666-666666666666'],
      });

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('SCOPE_NOT_APPLICABLE');
    });

    it('should validate product-specific coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({
        scope: 'product',
        scopeIds: [TEST_PRODUCT_ID],
      }));

      const result = await couponService.validateCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
        productIds: [TEST_PRODUCT_ID],
      });

      expect(result.isValid).toBe(true);
    });
  });

  // =============================================
  // APPLY COUPON TESTS
  // =============================================
  describe('applyCoupon', () => {
    it('should apply coupon and record usage', async () => {
      couponRepo.addCoupon(createTestCoupon());

      const result = await couponService.applyCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
        orderId: TEST_ORDER_ID,
      });

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(10);

      // Check usage was recorded
      const usages = couponRepo.getAllUsages();
      expect(usages.length).toBe(1);
      expect(usages[0].userId).toBe(TEST_USER_ID);
    });

    it('should increment usage count', async () => {
      couponRepo.addCoupon(createTestCoupon());

      await couponService.applyCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      // The repo's incrementUsage updates the Map directly
      const allCoupons = couponRepo.getAll();
      const coupon = allCoupons.find(c => c.id === TEST_COUPON_ID);
      expect(coupon?.usageCount).toBe(1);
    });

    it('should not apply invalid coupon', async () => {
      couponRepo.addCoupon(createTestCoupon({ isActive: false }));

      const result = await couponService.applyCoupon({
        code: 'SAVE10',
        userId: TEST_USER_ID,
        orderAmount: 100,
      });

      expect(result.isValid).toBe(false);
      expect(couponRepo.getAllUsages().length).toBe(0);
    });
  });

  // =============================================
  // CALCULATE DISCOUNT TESTS
  // =============================================
  describe('calculateDiscount', () => {
    it('should calculate percentage discount', () => {
      const coupon = createTestCoupon({ type: 'percentage', value: 20 });
      const discount = couponService.calculateDiscount(coupon, 100);
      expect(discount).toBe(20);
    });

    it('should calculate fixed amount discount', () => {
      const coupon = createTestCoupon({ type: 'fixed_amount', value: 25 });
      const discount = couponService.calculateDiscount(coupon, 100);
      expect(discount).toBe(25);
    });

    it('should return 0 for free shipping', () => {
      const coupon = createTestCoupon({ type: 'free_shipping', value: 1 });
      const discount = couponService.calculateDiscount(coupon, 100);
      expect(discount).toBe(0);
    });

    it('should apply max discount cap', () => {
      const coupon = createTestCoupon({ type: 'percentage', value: 50, maxDiscountAmount: 15 });
      const discount = couponService.calculateDiscount(coupon, 100);
      expect(discount).toBe(15);
    });

    it('should not exceed order amount', () => {
      const coupon = createTestCoupon({ type: 'fixed_amount', value: 100 });
      const discount = couponService.calculateDiscount(coupon, 50);
      expect(discount).toBe(50);
    });

    it('should round to 2 decimal places', () => {
      const coupon = createTestCoupon({ type: 'percentage', value: 33 });
      const discount = couponService.calculateDiscount(coupon, 100);
      expect(discount).toBe(33);
    });
  });

  // =============================================
  // USAGE COUNT TESTS
  // =============================================
  describe('getUserUsageCount', () => {
    it('should return user usage count', async () => {
      couponRepo.addCoupon(createTestCoupon());
      couponRepo.addUsage({
        id: 'usage-1',
        couponId: TEST_COUPON_ID,
        userId: TEST_USER_ID,
        orderId: null,
        bookingId: null,
        discountAmount: 10,
        createdAt: new Date().toISOString(),
      });

      const count = await couponService.getUserUsageCount(TEST_COUPON_ID, TEST_USER_ID);
      expect(count).toBe(1);
    });

    it('should return 0 for no usage', async () => {
      const count = await couponService.getUserUsageCount(TEST_COUPON_ID, TEST_USER_ID);
      expect(count).toBe(0);
    });

    it('should throw error for invalid coupon ID', async () => {
      await expect(
        couponService.getUserUsageCount('invalid', TEST_USER_ID)
      ).rejects.toThrow('Invalid coupon ID format');
    });

    it('should throw error for invalid user ID', async () => {
      await expect(
        couponService.getUserUsageCount(TEST_COUPON_ID, 'invalid')
      ).rejects.toThrow('Invalid user ID format');
    });
  });

  // =============================================
  // STATS TESTS
  // =============================================
  describe('getStats', () => {
    beforeEach(() => {
      couponRepo.addCoupon(createTestCoupon({ id: '11111111-1111-1111-1111-111111111111', type: 'percentage', scope: 'order', usageCount: 10 }));
      couponRepo.addCoupon(createTestCoupon({ id: '22222222-2222-2222-2222-222222222222', type: 'fixed_amount', scope: 'booking', usageCount: 5 }));
      couponRepo.addCoupon(createTestCoupon({ id: '33333333-3333-3333-3333-333333333333', type: 'percentage', scope: 'pool', isActive: false }));
    });

    it('should return coupon stats', async () => {
      const stats = await couponService.getStats();

      expect(stats.totalCoupons).toBe(3);
      expect(stats.activeCoupons).toBe(2);
      expect(stats.totalUsageCount).toBe(15);
    });

    it('should count by type', async () => {
      const stats = await couponService.getStats();

      expect(stats.byType.percentage).toBe(2);
      expect(stats.byType.fixed_amount).toBe(1);
    });

    it('should count by scope', async () => {
      const stats = await couponService.getStats();

      expect(stats.byScope.order).toBe(1);
      expect(stats.byScope.booking).toBe(1);
      expect(stats.byScope.pool).toBe(1);
    });
  });

  // =============================================
  // CODE AVAILABILITY TESTS
  // =============================================
  describe('isCodeAvailable', () => {
    it('should return true for available code', async () => {
      const result = await couponService.isCodeAvailable('NEWCODE');
      expect(result).toBe(true);
    });

    it('should return false for taken code', async () => {
      couponRepo.addCoupon(createTestCoupon({ code: 'TAKEN' }));

      const result = await couponService.isCodeAvailable('TAKEN');
      expect(result).toBe(false);
    });

    it('should return false for invalid code format', async () => {
      const result = await couponService.isCodeAvailable('AB');
      expect(result).toBe(false);
    });
  });

  // =============================================
  // CODE GENERATION TESTS
  // =============================================
  describe('generateCode', () => {
    it('should generate 8 character code', () => {
      const code = couponService.generateCode();
      expect(code.length).toBe(8);
    });

    it('should generate uppercase alphanumeric code', () => {
      const code = couponService.generateCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it('should use prefix if provided', () => {
      const code = couponService.generateCode('NEW');
      expect(code.startsWith('NEW')).toBe(true);
      expect(code.length).toBe(8);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(couponService.generateCode());
      }
      expect(codes.size).toBe(100);
    });
  });

  // =============================================
  // UTILITY TESTS
  // =============================================
  describe('getTypes', () => {
    it('should return all coupon types', () => {
      const types = couponService.getTypes();
      expect(types).toContain('percentage');
      expect(types).toContain('fixed_amount');
      expect(types).toContain('free_shipping');
    });
  });

  describe('getScopes', () => {
    it('should return all coupon scopes', () => {
      const scopes = couponService.getScopes();
      expect(scopes).toContain('order');
      expect(scopes).toContain('product');
      expect(scopes).toContain('category');
      expect(scopes).toContain('booking');
      expect(scopes).toContain('pool');
    });
  });

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================
  describe('CouponServiceError', () => {
    it('should have correct error name', async () => {
      try {
        await couponService.getCouponById('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(CouponServiceError);
        expect((error as CouponServiceError).name).toBe('CouponServiceError');
      }
    });

    it('should have error code', async () => {
      try {
        await couponService.getCouponById('invalid');
      } catch (error) {
        expect((error as CouponServiceError).code).toBe('INVALID_COUPON_ID');
      }
    });
  });
});
