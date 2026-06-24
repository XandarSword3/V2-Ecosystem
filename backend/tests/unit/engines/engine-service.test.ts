/**
 * Engine Service Integration Tests
 * 
 * Tests the EngineService which is the bridge between controllers and the engine framework.
 * Verifies that template type → engine mapping, pricing pipeline, and state machine
 * all work together correctly through the high-level API.
 * 
 * These tests use the REAL engine definitions (A, B, C, D) with mock external deps
 * (TaxService, OrderConfigService, discount resolvers).
 */
import { createEngineService, EngineService, resetEngineService } from '../../../src/engines/engine-service.js';
import type { PricingLineItem, PricingContext } from '../../../../shared/types/engines.js';

// ============================================
// Mock Dependencies
// ============================================

const mockTaxService = {
  getTaxRate: vi.fn().mockResolvedValue(0.11), // 11% default
};

const mockOrderConfigService = {
  getOrderConfig: vi.fn().mockResolvedValue({
    serviceChargeRate: 0.10,
    deliveryFee: 3.00,
  }),
};

const mockCouponResolver = {
  apply: vi.fn(),
};

const mockGiftCardResolver = {
  redeem: vi.fn(),
};

const mockLoyaltyResolver = {
  redeem: vi.fn(),
  earn: vi.fn(),
};

function createTestService(): EngineService {
  return createEngineService({
    taxService: mockTaxService as any,
    orderConfigService: mockOrderConfigService as any,
    couponResolver: mockCouponResolver,
    giftCardResolver: mockGiftCardResolver,
    loyaltyResolver: mockLoyaltyResolver,
  });
}

// ============================================
// Tests
// ============================================

describe('EngineService — Integration', () => {
  let service: EngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetEngineService();
    service = createTestService();
  });

  // ============================================
  // Template → Engine Mapping
  // ============================================

  describe('template type resolution', () => {
    it('should resolve instant_transaction canonical type', () => {
      const engine = service.getEngineForTemplate('instant_transaction');
      expect(engine.type).toBe('instant_transaction');
    });

    it('should resolve time_exclusive_reservation canonical type', () => {
      const engine = service.getEngineForTemplate('time_exclusive_reservation');
      expect(engine.type).toBe('time_exclusive_reservation');
    });

    it('should resolve shared_capacity_access canonical type', () => {
      const engine = service.getEngineForTemplate('shared_capacity_access');
      expect(engine.type).toBe('shared_capacity_access');
    });

    it('should resolve ongoing_entitlement canonical type', () => {
      const engine = service.getEngineForTemplate('ongoing_entitlement');
      expect(engine.type).toBe('ongoing_entitlement');
    });

    it('should throw for unknown template type', () => {
      expect(() => service.getEngineForTemplate('nonexistent')).toThrow();
    });
  });

  // ============================================
  // KioskItem Bar Wiring (Engine A: instant_transaction, menu_service)
  // ============================================

  describe('instant_transaction wiring (Engine A)', () => {
    it('should calculate pricing with tax for kiosk item orders', async () => {
      const lineItems: PricingLineItem[] = [
        { name: 'Burger', unitPrice: 8.00, quantity: 2 },
        { name: 'Fries', unitPrice: 3.50, quantity: 1 },
      ];
      const context: PricingContext = {
        conditions: { orderType: 'takeaway' },
      };

      const result = await service.calculatePricing('instant_transaction', lineItems, context);

      // subtotal = (8*2) + 3.5 = 19.50
      expect(result.subtotal).toBe(19.50);
      // tax = 19.50 * 0.11 = 2.145 → rounded 2.15
      expect(result.taxAmount).toBe(2.15);
      // takeaway → no service charge, no delivery fee
      expect(result.serviceCharge).toBe(0);
      expect(result.deliveryFee).toBe(0);
      // total = 19.50 + 2.15 = 21.65
      expect(result.totalAmount).toBe(21.65);
    });

    it('should NOT apply service charge for takeaway', async () => {
      const lineItems: PricingLineItem[] = [
        { name: 'Coffee', unitPrice: 4.00, quantity: 1 },
      ];

      const result = await service.calculatePricing('instant_transaction', lineItems, {
        conditions: { orderType: 'takeaway' },
      });

      expect(result.serviceCharge).toBe(0);
    });

    it('should apply service charge for dine-in', async () => {
      const lineItems: PricingLineItem[] = [
        { name: 'Steak', unitPrice: 25.00, quantity: 1 },
      ];

      const result = await service.calculatePricing('instant_transaction', lineItems, {
        conditions: { orderType: 'dine_in' },
      });

      // Service charge = 25.00 * 0.10 = 2.50
      expect(result.serviceCharge).toBe(2.50);
    });

    it('should get initial state as pending', () => {
      const state = service.getInitialState('instant_transaction');
      expect(state).toBe('pending');
    });

    it('should validate pending → confirm transition', async () => {
      const result = await service.transitionState('instant_transaction', 'pending', 'confirm', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('confirmed');
    });

    it('should reject invalid transition (pending → deliver)', async () => {
      const result = await service.transitionState('instant_transaction', 'pending', 'deliver', 'staff');
      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should allow cancel from pending', async () => {
      const result = await service.transitionState('instant_transaction', 'pending', 'cancel', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('cancelled');
    });

    it('should get available actions for staff from pending', () => {
      const actions = service.getAvailableActions('instant_transaction', 'pending', 'staff');
      const actionNames = actions.map(a => a.action);
      expect(actionNames).toContain('confirm');
      expect(actionNames).toContain('cancel');
    });

    it('should mark completed as terminal', () => {
      expect(service.isTerminalState('instant_transaction', 'completed')).toBe(true);
      expect(service.isTerminalState('instant_transaction', 'cancelled')).toBe(true);
      expect(service.isTerminalState('instant_transaction', 'pending')).toBe(false);
    });
  });

  // ============================================
  // MenuService Order Wiring (Engine A with discounts)
  // ============================================

  describe('instant_transaction wiring with discounts', () => {
    it('should apply coupon discount to menu service order', async () => {
      mockCouponResolver.apply.mockResolvedValue({
        discountAmount: 5.00,
        taxSavings: 0.55,
        couponId: 'coupon-123',
      });

      const lineItems: PricingLineItem[] = [
        { name: 'Pizza', unitPrice: 15.00, quantity: 2, unitAdjustment: 2.00 },
      ];
      const context: PricingContext = {
        conditions: { orderType: 'dine_in' },
        couponCode: 'SAVE5',
        customerId: 'cust-1',
        moduleId: 'mod-1',
      };

      const result = await service.calculatePricing('instant_transaction', lineItems, context);

      // subtotal = (15+2)*2 = 34
      expect(result.subtotal).toBe(34);
      // coupon: 5.00 off
      expect(result.discounts.length).toBeGreaterThanOrEqual(1);
      expect(result.discounts[0].type).toBe('coupon');
      expect(result.discounts[0].amount).toBe(5);
      expect(result.discounts[0].referenceId).toBe('coupon-123');
      // total should reflect discount
      expect(result.totalAmount).toBeLessThan(result.preDiscountTotal);
    });

    it('should apply gift card after coupon', async () => {
      mockCouponResolver.apply.mockResolvedValue({
        discountAmount: 3.00,
        taxSavings: 0.33,
        couponId: 'c-1',
      });
      mockGiftCardResolver.redeem.mockResolvedValue({
        amountDeducted: 10.00,
        giftCardId: 'gc-1',
      });

      const lineItems: PricingLineItem[] = [
        { name: 'Pasta', unitPrice: 20.00, quantity: 1 },
      ];
      const context: PricingContext = {
        conditions: { orderType: 'takeaway' },
        couponCode: 'CODE',
        giftCardCodes: ['GC-ABC123'],
        customerId: 'cust-1',
      };

      const result = await service.calculatePricing('instant_transaction', lineItems, context);

      const giftCardDiscount = result.discounts.find(d => d.type === 'gift_card');
      expect(giftCardDiscount).toBeDefined();
      expect(giftCardDiscount!.amount).toBe(10);
    });

    it('should apply loyalty points after gift card', async () => {
      mockLoyaltyResolver.redeem.mockResolvedValue({
        amountDeducted: 2.00,
        pointsUsed: 200,
      });

      const lineItems: PricingLineItem[] = [
        { name: 'Salad', unitPrice: 12.00, quantity: 1 },
      ];
      const context: PricingContext = {
        conditions: { orderType: 'takeaway' },
        loyaltyPointsToRedeem: 200,
        customerId: 'cust-1',
      };

      const result = await service.calculatePricing('instant_transaction', lineItems, context);

      const loyaltyDiscount = result.discounts.find(d => d.type === 'loyalty');
      expect(loyaltyDiscount).toBeDefined();
      expect(loyaltyDiscount!.amount).toBe(2);
      expect(loyaltyDiscount!.metadata?.pointsUsed).toBe(200);
    });

    it('should apply delivery fee for delivery orders', async () => {
      const lineItems: PricingLineItem[] = [
        { name: 'Soup', unitPrice: 8.00, quantity: 1 },
      ];

      const result = await service.calculatePricing('instant_transaction', lineItems, {
        conditions: { orderType: 'delivery' },
      });

      expect(result.deliveryFee).toBe(3.00);
    });
  });

  // ============================================
  // Pool Wiring (Engine C: shared_capacity_access, session_access)
  // ============================================

  describe('shared_capacity_access wiring (Engine C)', () => {
    it('should calculate pool ticket pricing with tax', async () => {
      const lineItems: PricingLineItem[] = [
        { name: 'Adult Ticket', unitPrice: 25.00, quantity: 2 },
        { name: 'Child Ticket', unitPrice: 15.00, quantity: 1 },
      ];

      const result = await service.calculatePricing('shared_capacity_access', lineItems, {});

      // subtotal = 50 + 15 = 65
      expect(result.subtotal).toBe(65);
      // tax = 65 * 0.11 = 7.15
      expect(result.taxAmount).toBe(7.15);
      // Engine C: no service charge, no delivery fee
      expect(result.serviceCharge).toBe(0);
      expect(result.deliveryFee).toBe(0);
      // total = 65 + 7.15 = 72.15
      expect(result.totalAmount).toBe(72.15);
    });

    it('should get initial state as valid', () => {
      expect(service.getInitialState('shared_capacity_access')).toBe('valid');
    });

    it('should allow validate_entry transition (valid → active)', async () => {
      const result = await service.transitionState('shared_capacity_access', 'valid', 'validate_entry', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('active');
    });

    it('should allow record_exit from active (active → used)', async () => {
      const result = await service.transitionState('shared_capacity_access', 'active', 'record_exit', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('used');
    });

    it('should reject record_exit from valid (must enter first)', async () => {
      const result = await service.transitionState('shared_capacity_access', 'valid', 'record_exit', 'staff');
      expect(result.allowed).toBe(false);
    });

    it('should allow cancel from valid', async () => {
      const result = await service.transitionState('shared_capacity_access', 'valid', 'cancel', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('cancelled');
    });

    it('should reject cancel from used (terminal)', async () => {
      const result = await service.transitionState('shared_capacity_access', 'used', 'cancel', 'staff');
      expect(result.allowed).toBe(false);
    });

    it('should mark used and cancelled as terminal', () => {
      expect(service.isTerminalState('shared_capacity_access', 'used')).toBe(true);
      expect(service.isTerminalState('shared_capacity_access', 'cancelled')).toBe(true);
      expect(service.isTerminalState('shared_capacity_access', 'valid')).toBe(false);
      expect(service.isTerminalState('shared_capacity_access', 'active')).toBe(false);
    });
  });

  // ============================================
  // Booking Wiring (Engine B: time_exclusive_reservation, multi_day_booking)
  // ============================================

  describe('time_exclusive_reservation wiring (Engine B)', () => {
    it('should get initial state as pending', () => {
      expect(service.getInitialState('time_exclusive_reservation')).toBe('pending');
    });

    it('should allow confirm from pending', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'pending', 'confirm', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('confirmed');
    });

    it('should allow check_in from confirmed', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'confirmed', 'check_in', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('checked_in');
    });

    it('should allow walk-in check_in from pending (shortcut)', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'pending', 'check_in', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('checked_in');
    });

    it('should allow check_out from checked_in', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'checked_in', 'check_out', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('checked_out');
    });

    it('should reject check_out from confirmed (must check in first)', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'confirmed', 'check_out', 'staff');
      expect(result.allowed).toBe(false);
    });

    it('should allow cancel from pending', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'pending', 'cancel', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('cancelled');
    });

    it('should allow cancel from confirmed', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'confirmed', 'cancel', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('cancelled');
    });

    it('should reject cancel from checked_out (terminal)', async () => {
      const result = await service.transitionState('time_exclusive_reservation', 'checked_out', 'cancel', 'staff');
      expect(result.allowed).toBe(false);
    });

    it('should calculate booking pricing with tax, no service charge', async () => {
      const lineItems: PricingLineItem[] = [
        { name: 'Night Rate', unitPrice: 120.00, quantity: 3 },
        { name: 'Extra Bed', unitPrice: 30.00, quantity: 3 },
      ];

      const result = await service.calculatePricing('time_exclusive_reservation', lineItems, {});

      // subtotal = (120*3) + (30*3) = 360 + 90 = 450
      expect(result.subtotal).toBe(450);
      // Engine B: applyTax=true
      expect(result.taxAmount).toBeGreaterThan(0);
      // Engine B: no service charge, no delivery fee
      expect(result.serviceCharge).toBe(0);
      expect(result.deliveryFee).toBe(0);
    });

    it('should mark checked_out and cancelled as terminal', () => {
      expect(service.isTerminalState('time_exclusive_reservation', 'checked_out')).toBe(true);
      expect(service.isTerminalState('time_exclusive_reservation', 'cancelled')).toBe(true);
      expect(service.isTerminalState('time_exclusive_reservation', 'pending')).toBe(false);
    });
  });

  // ============================================
  // Subscription Wiring (Engine D: ongoing_entitlement, subscription)
  // ============================================

  describe('ongoing_entitlement wiring (Engine D)', () => {
    it('should get initial state as pending', () => {
      expect(service.getInitialState('ongoing_entitlement')).toBe('pending');
    });

    it('should allow activate from pending', async () => {
      const result = await service.transitionState('ongoing_entitlement', 'pending', 'activate', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('active');
    });

    it('should allow renew from active', async () => {
      const result = await service.transitionState('ongoing_entitlement', 'active', 'renew', 'system');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('active');
    });

    it('should allow pause from active', async () => {
      const result = await service.transitionState('ongoing_entitlement', 'active', 'pause', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('paused');
    });

    it('should allow resume from paused', async () => {
      const result = await service.transitionState('ongoing_entitlement', 'paused', 'resume', 'staff');
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('active');
    });

    it('should mark cancelled as terminal, expired is NOT terminal', () => {
      expect(service.isTerminalState('ongoing_entitlement', 'cancelled')).toBe(true);
      // expired is NOT terminal — can reactivate or cancel from expired
      expect(service.isTerminalState('ongoing_entitlement', 'expired')).toBe(false);
      expect(service.isTerminalState('ongoing_entitlement', 'active')).toBe(false);
    });
  });

  // ============================================
  // Cross-Engine Consistency
  // ============================================

  describe('cross-engine consistency', () => {
    it('should never produce negative totals', async () => {
      const lineItems: PricingLineItem[] = [
        { name: 'Item', unitPrice: 5.00, quantity: 1 },
      ];

      // Apply massive coupon discount
      mockCouponResolver.apply.mockResolvedValue({
        discountAmount: 100.00,
        taxSavings: 11.00,
        couponId: 'big-coupon',
      });

      const result = await service.calculatePricing('instant_transaction', lineItems, {
        conditions: { orderType: 'takeaway' },
        couponCode: 'BIG',
      });

      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty line items gracefully', async () => {
      const result = await service.calculatePricing('instant_transaction', [], {
        conditions: { orderType: 'takeaway' },
      });

      expect(result.subtotal).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should handle optional PricingContext fields', async () => {
      // Minimal context — all fields optional
      const result = await service.calculatePricing('shared_capacity_access', [
        { name: 'Ticket', unitPrice: 10, quantity: 1 },
      ], {});

      expect(result.subtotal).toBe(10);
      expect(result.totalAmount).toBeGreaterThan(0);
    });

    it('should auto-generate line item IDs when not provided', async () => {
      const result = await service.calculatePricing('instant_transaction', [
        { name: 'A', unitPrice: 5, quantity: 1 },
        { name: 'B', unitPrice: 3, quantity: 2 },
      ], { conditions: { orderType: 'takeaway' } });

      expect(result.lineItems[0].itemId).toBe('line-0');
      expect(result.lineItems[1].itemId).toBe('line-1');
    });

    it('should preserve provided line item IDs', async () => {
      const result = await service.calculatePricing('instant_transaction', [
        { itemId: 'custom-id', name: 'A', unitPrice: 5, quantity: 1 },
      ], { conditions: { orderType: 'takeaway' } });

      expect(result.lineItems[0].itemId).toBe('custom-id');
    });
  });

  // ============================================
  // Error Handling
  // ============================================

  describe('error handling', () => {
    it('should return error for invalid state in transition', async () => {
      const result = await service.transitionState('instant_transaction', 'nonexistent_state', 'confirm', 'staff');
      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should throw for unknown template type in pricing', async () => {
      await expect(
        service.calculatePricing('totally_unknown', [], {})
      ).rejects.toThrow();
    });

    it('should throw for unknown template type in state transition', async () => {
      // resolveEngineType throws for unknown template
      await expect(
        service.transitionState('totally_unknown', 'state', 'action', 'staff')
      ).rejects.toThrow();
    });
  });
});
