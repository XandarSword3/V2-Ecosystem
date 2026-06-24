/**
 * Pricing Pipeline Unit Tests
 * 
 * Tests the unified pricing pipeline with all engine configurations.
 * Covers: subtotal calculation, tax, service charge, delivery fee,
 * discount application order, invariant validation, rounding, and edge cases.
 */

import { PricingPipeline } from '../../../src/engines/pricing-pipeline.js';
import type { PricingPipelineDeps, CouponResolver, GiftCardResolver, LoyaltyResolver } from '../../../src/engines/pricing-pipeline.js';
import type { PricingLineItem, PricingConfig, PricingContext } from '../../../../shared/types/engines.js';
import { instantTransactionEngine } from '../../../src/engines/definitions/instant-transaction.js';
import { timeExclusiveReservationEngine } from '../../../src/engines/definitions/time-exclusive-reservation.js';
import { sharedCapacityAccessEngine } from '../../../src/engines/definitions/shared-capacity-access.js';

// ============================================
// Mock Dependencies
// ============================================

function createMockTaxService(rate: number = 0.11) {
  return {
    getTaxRate: vi.fn().mockResolvedValue(rate),
    updateTaxConfiguration: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockOrderConfigService(serviceChargeRate = 0.10, deliveryFee = 5) {
  return {
    getOrderConfig: vi.fn().mockResolvedValue({ serviceChargeRate, deliveryFee }),
    updateOrderConfig: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockCouponResolver(discount: number | null = null): CouponResolver {
  return {
    apply: vi.fn().mockResolvedValue(
      discount !== null
        ? { discountAmount: discount, taxSavings: 0, couponId: 'coupon-123' }
        : null,
    ),
  };
}

function createMockGiftCardResolver(amounts: number[] = []): GiftCardResolver {
  let callIndex = 0;
  return {
    redeem: vi.fn().mockImplementation(async (_code: string, maxAmount: number) => {
      if (callIndex >= amounts.length) return null;
      const amount = Math.min(amounts[callIndex++], maxAmount);
      return { amountDeducted: amount, giftCardId: `gc-${callIndex}` };
    }),
  };
}

function createMockLoyaltyResolver(redeemAmount: number | null = null, earnAmount: number = 0): LoyaltyResolver {
  return {
    redeem: vi.fn().mockResolvedValue(
      redeemAmount !== null
        ? { amountDeducted: redeemAmount, pointsUsed: redeemAmount * 100 }
        : null,
    ),
    earn: vi.fn().mockResolvedValue(earnAmount),
  };
}

function createDeps(overrides: Partial<PricingPipelineDeps> = {}): PricingPipelineDeps {
  return {
    taxService: createMockTaxService(),
    orderConfigService: createMockOrderConfigService(),
    couponResolver: createMockCouponResolver(),
    giftCardResolver: createMockGiftCardResolver(),
    loyaltyResolver: createMockLoyaltyResolver(),
    ...overrides,
  };
}

function createLineItem(overrides: Partial<PricingLineItem> = {}): PricingLineItem {
  return {
    itemId: 'item-1',
    name: 'Test Item',
    unitPrice: 10,
    quantity: 1,
    unitAdjustment: 0,
    ...overrides,
  };
}

function createContext(overrides: Partial<PricingContext> = {}): PricingContext {
  return {
    moduleId: 'mod-1',
    engineType: 'instant_transaction',
    conditions: {},
    ...overrides,
  };
}

// ============================================
// Engine A: Instant Transaction Pricing
// ============================================

describe('PricingPipeline - Instant Transaction (Engine A)', () => {
  let pipeline: PricingPipeline;
  let deps: PricingPipelineDeps;

  beforeEach(() => {
    deps = createDeps();
    pipeline = new PricingPipeline(deps);
  });

  describe('basic subtotal calculation', () => {
    it('should calculate subtotal from single item', async () => {
      const items = [createLineItem({ unitPrice: 25, quantity: 2 })];
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, createContext());

      expect(result.subtotal).toBe(50);
    });

    it('should sum multiple line items', async () => {
      const items = [
        createLineItem({ itemId: 'a', unitPrice: 10, quantity: 3 }),
        createLineItem({ itemId: 'b', unitPrice: 5, quantity: 2 }),
      ];
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, createContext());

      expect(result.subtotal).toBe(40); // (10*3) + (5*2)
    });

    it('should include unit adjustments (modifiers)', async () => {
      const items = [createLineItem({ unitPrice: 10, unitAdjustment: 2, quantity: 3 })];
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, createContext());

      expect(result.subtotal).toBe(36); // (10+2)*3
    });
  });

  describe('tax calculation', () => {
    it('should apply 11% tax by default', async () => {
      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, createContext());

      expect(result.taxRate).toBe(0.11);
      expect(result.taxAmount).toBe(11);
    });

    it('should use custom tax rate from service', async () => {
      const customDeps = createDeps({ taxService: createMockTaxService(0.20) });
      const customPipeline = new PricingPipeline(customDeps);

      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const result = await customPipeline.calculate(items, instantTransactionEngine.pricing, createContext());

      expect(result.taxRate).toBe(0.20);
      expect(result.taxAmount).toBe(20);
    });
  });

  describe('service charge', () => {
    it('should apply 10% service charge for dine-in', async () => {
      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ conditions: { orderType: 'dine_in' } });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.serviceCharge).toBe(10);
      expect(result.serviceChargeRate).toBe(0.10);
    });

    it('should NOT apply service charge for takeaway', async () => {
      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ conditions: { orderType: 'takeaway' } });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.serviceCharge).toBe(0);
    });
  });

  describe('delivery fee', () => {
    it('should apply delivery fee for delivery orders', async () => {
      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ conditions: { orderType: 'delivery' } });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.deliveryFee).toBe(5);
    });

    it('should NOT apply delivery fee for dine-in', async () => {
      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ conditions: { orderType: 'dine_in' } });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.deliveryFee).toBe(0);
    });
  });

  describe('complete dine-in order', () => {
    it('should calculate subtotal + tax + service charge correctly', async () => {
      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ conditions: { orderType: 'dine_in' } });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.subtotal).toBe(100);
      expect(result.taxAmount).toBe(11);        // 100 * 0.11
      expect(result.serviceCharge).toBe(10);     // 100 * 0.10
      expect(result.deliveryFee).toBe(0);
      expect(result.preDiscountTotal).toBe(121); // 100 + 11 + 10
      expect(result.totalAmount).toBe(121);
    });
  });

  describe('complete delivery order', () => {
    it('should calculate subtotal + tax + delivery fee correctly', async () => {
      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ conditions: { orderType: 'delivery' } });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.subtotal).toBe(100);
      expect(result.taxAmount).toBe(11);   // 100 * 0.11
      expect(result.serviceCharge).toBe(0);
      expect(result.deliveryFee).toBe(5);
      expect(result.preDiscountTotal).toBe(116); // 100 + 11 + 5
      expect(result.totalAmount).toBe(116);
    });
  });
});

// ============================================
// Engine B: Reservation Pricing
// ============================================

describe('PricingPipeline - Time-Exclusive Reservation (Engine B)', () => {
  let pipeline: PricingPipeline;

  beforeEach(() => {
    pipeline = new PricingPipeline(createDeps());
  });

  it('should calculate multi-night booking with add-ons', async () => {
    const items = [
      createLineItem({ itemId: 'accommodation unit-1', name: 'AccommodationUnit A (3 nights)', unitPrice: 200, quantity: 3 }),
      createLineItem({ itemId: 'addon-bbq', name: 'BBQ Package', unitPrice: 25, quantity: 3, metadata: { type: 'per_night' } }),
      createLineItem({ itemId: 'addon-bedding', name: 'Extra Bedding', unitPrice: 15, quantity: 1, metadata: { type: 'one_time' } }),
    ];

    const context = createContext({
      engineType: 'time_exclusive_reservation',
      conditions: {
        depositConfig: { type: 'percentage', rate: 0.3 },
      },
    });

    const result = await pipeline.calculate(items, timeExclusiveReservationEngine.pricing, context);

    // Subtotal: (200*3) + (25*3) + (15*1) = 600 + 75 + 15 = 690
    expect(result.subtotal).toBe(690);
    // Tax: 690 * 0.11 = 75.9
    expect(result.taxAmount).toBe(75.9);
    // No service charge, no delivery fee
    expect(result.serviceCharge).toBe(0);
    expect(result.deliveryFee).toBe(0);
    // Total: 690 + 75.9 = 765.9
    expect(result.totalAmount).toBe(765.9);
    // Deposit: 765.9 * 0.3 = 229.77
    expect(result.depositAmount).toBe(229.77);
  });

  it('should NOT apply service charge or delivery fee', async () => {
    const items = [createLineItem({ unitPrice: 500, quantity: 1 })];
    const context = createContext({ engineType: 'time_exclusive_reservation' });
    const result = await pipeline.calculate(items, timeExclusiveReservationEngine.pricing, context);

    expect(result.serviceCharge).toBe(0);
    expect(result.deliveryFee).toBe(0);
  });
});

// ============================================
// Engine C: Shared Capacity Access Pricing
// ============================================

describe('PricingPipeline - Shared Capacity Access (Engine C)', () => {
  let pipeline: PricingPipeline;

  beforeEach(() => {
    pipeline = new PricingPipeline(createDeps());
  });

  it('should calculate adult/child ticket pricing', async () => {
    const items = [
      createLineItem({ itemId: 'session-1', name: 'Adult', unitPrice: 15, quantity: 2 }),
      createLineItem({ itemId: 'session-1', name: 'Child', unitPrice: 8, quantity: 3 }),
    ];

    const context = createContext({ engineType: 'shared_capacity_access' });
    const result = await pipeline.calculate(items, sharedCapacityAccessEngine.pricing, context);

    // Subtotal: (15*2) + (8*3) = 30 + 24 = 54
    expect(result.subtotal).toBe(54);
    // Tax: 54 * 0.11 = 5.94
    expect(result.taxAmount).toBe(5.94);
    // Total: 54 + 5.94 = 59.94
    expect(result.totalAmount).toBe(59.94);
    // No service charge, no delivery fee
    expect(result.serviceCharge).toBe(0);
    expect(result.deliveryFee).toBe(0);
  });
});

// ============================================
// Discount Application
// ============================================

describe('PricingPipeline - Discounts', () => {
  describe('coupon discounts', () => {
    it('should apply coupon discount to subtotal', async () => {
      const deps = createDeps({
        couponResolver: createMockCouponResolver(20),
      });
      const pipeline = new PricingPipeline(deps);

      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ couponCode: 'SAVE20' });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      // Coupon is pre-tax: reduces taxable amount
      // Tax on (100 - 20) = 80 * 0.11 = 8.8
      expect(result.taxAmount).toBe(8.8);
      expect(result.discounts).toHaveLength(1);
      expect(result.discounts[0].type).toBe('coupon');
      expect(result.discounts[0].amount).toBe(20);
    });

    it('should not apply coupon when code is missing', async () => {
      const deps = createDeps({
        couponResolver: createMockCouponResolver(20),
      });
      const pipeline = new PricingPipeline(deps);

      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext(); // No coupon code
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.discounts).toHaveLength(0);
    });
  });

  describe('gift card redemption', () => {
    it('should apply gift card after coupon', async () => {
      const deps = createDeps({
        giftCardResolver: createMockGiftCardResolver([30]),
      });
      const pipeline = new PricingPipeline(deps);

      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ giftCardCodes: ['GC-001'] });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      const gcDiscount = result.discounts.find(d => d.type === 'gift_card');
      expect(gcDiscount).toBeDefined();
      expect(gcDiscount!.amount).toBe(30);
    });

    it('should cap gift card at remaining total', async () => {
      const deps = createDeps({
        giftCardResolver: createMockGiftCardResolver([500]),
      });
      const pipeline = new PricingPipeline(deps);

      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ giftCardCodes: ['GC-001'] });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      // Total is 111 (100 + 11 tax), gift card capped at that
      expect(result.totalAmount).toBe(0);
    });
  });

  describe('loyalty points', () => {
    it('should apply loyalty discount after gift cards', async () => {
      const deps = createDeps({
        loyaltyResolver: createMockLoyaltyResolver(5),
      });
      const pipeline = new PricingPipeline(deps);

      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({ customerId: 'user-1', loyaltyPointsToRedeem: 500 });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      const loyaltyDiscount = result.discounts.find(d => d.type === 'loyalty');
      expect(loyaltyDiscount).toBeDefined();
      expect(loyaltyDiscount!.amount).toBe(5);
    });
  });

  describe('discount order: coupon → gift card → loyalty', () => {
    it('should apply discounts in correct order', async () => {
      const deps = createDeps({
        couponResolver: createMockCouponResolver(10),
        giftCardResolver: createMockGiftCardResolver([20]),
        loyaltyResolver: createMockLoyaltyResolver(5),
      });
      const pipeline = new PricingPipeline(deps);

      const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
      const context = createContext({
        couponCode: 'SAVE10',
        giftCardCodes: ['GC-001'],
        customerId: 'user-1',
        loyaltyPointsToRedeem: 500,
      });
      const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

      expect(result.discounts).toHaveLength(3);
      expect(result.discounts[0].type).toBe('coupon');
      expect(result.discounts[1].type).toBe('gift_card');
      expect(result.discounts[2].type).toBe('loyalty');
    });
  });
});

// ============================================
// Invariants & Edge Cases
// ============================================

describe('PricingPipeline - Invariants', () => {
  it('should never produce negative totalAmount', async () => {
    const deps = createDeps({
      couponResolver: createMockCouponResolver(200),
    });
    const pipeline = new PricingPipeline(deps);

    const items = [createLineItem({ unitPrice: 50, quantity: 1 })];
    const context = createContext({ couponCode: 'HUGE' });
    const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

    expect(result.totalAmount).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty line items', async () => {
    const pipeline = new PricingPipeline(createDeps());
    const result = await pipeline.calculate([], instantTransactionEngine.pricing, createContext());

    expect(result.subtotal).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.lineItems).toHaveLength(0);
  });

  it('should handle zero-price items', async () => {
    const pipeline = new PricingPipeline(createDeps());
    const items = [createLineItem({ unitPrice: 0, quantity: 5 })];
    const result = await pipeline.calculate(items, instantTransactionEngine.pricing, createContext());

    expect(result.subtotal).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('should round to 2 decimal places', async () => {
    const pipeline = new PricingPipeline(createDeps());
    const items = [createLineItem({ unitPrice: 33.33, quantity: 3 })];
    const result = await pipeline.calculate(items, instantTransactionEngine.pricing, createContext());

    // 33.33 * 3 = 99.99
    expect(result.subtotal).toBe(99.99);
    // 99.99 * 0.11 = 10.9989 → rounded to 11
    expect(result.taxAmount).toBe(11);
  });

  it('should satisfy invariant: totalAmount = subtotal + tax + serviceCharge + deliveryFee - totalDiscount', async () => {
    const deps = createDeps({
      couponResolver: createMockCouponResolver(15),
    });
    const pipeline = new PricingPipeline(deps);

    const items = [createLineItem({ unitPrice: 100, quantity: 2 })];
    const context = createContext({
      conditions: { orderType: 'dine_in' },
      couponCode: 'SAVE15',
    });
    const result = await pipeline.calculate(items, instantTransactionEngine.pricing, context);

    const expected = result.subtotal + result.taxAmount + result.serviceCharge + result.deliveryFee - result.totalDiscount;
    expect(Math.abs(result.totalAmount - Math.max(0, expected))).toBeLessThanOrEqual(0.02);
  });
});

// ============================================
// Engines that skip features
// ============================================

describe('PricingPipeline - Engine feature skipping', () => {
  it('should skip tax when engine config says applyTax=false', async () => {
    const pipeline = new PricingPipeline(createDeps());
    const noTaxConfig: PricingConfig = { ...instantTransactionEngine.pricing, applyTax: false };
    const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
    const result = await pipeline.calculate(items, noTaxConfig, createContext());

    expect(result.taxAmount).toBe(0);
    expect(result.taxRate).toBe(0);
  });

  it('should skip discounts when engine config disables them', async () => {
    const deps = createDeps({
      couponResolver: createMockCouponResolver(20),
    });
    const pipeline = new PricingPipeline(deps);

    const noDiscountConfig: PricingConfig = {
      ...instantTransactionEngine.pricing,
      supportsCoupons: false,
      supportsGiftCards: false,
      supportsLoyaltyRedemption: false,
    };

    const items = [createLineItem({ unitPrice: 100, quantity: 1 })];
    const context = createContext({ couponCode: 'SAVE20' });
    const result = await pipeline.calculate(items, noDiscountConfig, context);

    expect(result.discounts).toHaveLength(0);
    expect(result.totalDiscount).toBe(0);
  });
});
