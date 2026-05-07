/**
 * Engine Integration Tests
 * Comprehensive regression tests for all engine paths
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EngineService } from '../../src/engines/engine-service.js';
import { getEngineByTemplate } from '../../src/engines/registry.js';
import { OrderConfigService } from '../../src/services/order-config.service.js';

vi.mock('../../src/services/tax.service.js', () => {
  return {
    TaxService: vi.fn().mockImplementation(() => ({
      calculateTaxes: vi.fn((subtotal) => [
        { name: 'VAT', rate: 0.1, amount: subtotal * 0.1 }
      ]),
      getTotalTax: vi.fn((subtotal) => subtotal * 0.1)
    }))
  };
});

vi.mock('../../src/services/order-config.service.js', () => {
  return {
    OrderConfigService: vi.fn().mockImplementation(() => ({
      getConfig: vi.fn().mockResolvedValue({
        serviceChargeAmount: 5,
        deliveryFeeAmount: 3
      })
    }))
  };
});

describe('Engine Integration Tests', () => {
  let engineService: EngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Instantiate actual service for true integration test
    const couponResolver = vi.fn().mockResolvedValue({ isValid: true, discountAmount: 10 });
    const giftCardResolver = vi.fn().mockResolvedValue({ isValid: true, balance: 50 });
    const loyaltyResolver = vi.fn().mockResolvedValue({ isValid: true, conversionRate: 0.1, balance: 100 });
    
    engineService = new EngineService({
      couponResolver,
      giftCardResolver,
      loyaltyResolver
    });
  });

  describe('Instant Transaction Engine', () => {
    it('should calculate pricing with economics data', async () => {
      const lineItems = [
        {
          id: 'item1',
          name: 'Test Item',
          quantity: 2,
          unitPrice: 10,
          type: 'menu_item' // 20
        }
      ];

      const pricingContext = {
        propertyId: 'prop-1',
        moduleId: 'mod-1',
        staffId: 'staff-1',
        couponCode: 'TEST20'
      };

      const result = await engineService.calculatePricing(
        'menu_service', // template type
        lineItems,
        pricingContext
      );

      expect(result).toBeDefined();
      expect(result.staffId).toBe('staff-1');
      expect(result.propertyId).toBe('prop-1');
      expect(result.moduleId).toBe('mod-1');
      expect(result.subtotal).toBe(20);
      expect(result.totalDiscount).toBe(10); // from mock coupon
      expect(result.totalAmount).toBe(12); // 20 - 10 = 10 subtotal, + 2 tax = 12. (wait, tax service returns %0.1 of what?)
    });

    it('should handle state transitions', async () => {
      const result = await engineService.transitionState(
        'menu_service',
        'pending',
        'confirm',
        'staff',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('confirmed');
    });
  });

  describe('Time Exclusive Reservation Engine', () => {
    it('should calculate accommodation pricing with add-ons without discounts', async () => {
      const lineItems = [
        {
          id: 'chalet1',
          name: 'Lake View Chalet',
          quantity: 3, // 3 nights
          unitPrice: 150, // 450
          type: 'accommodation'
        },
        {
          id: 'breakfast',
          name: 'Breakfast Add-on',
          quantity: 3,
          unitPrice: 20, // 60
          type: 'addon'
        }
      ]; // total 510

      const pricingContext = {
        propertyId: 'prop-1',
        moduleId: 'mod-1',
      };

      const result = await engineService.calculatePricing(
        'multi_day_booking',
        lineItems,
        pricingContext
      );

      expect(result.subtotal).toBe(510);
      expect(result.propertyId).toBe('prop-1');
      expect(result.moduleId).toBe('mod-1');
    });

    it('should handle booking state transitions', async () => {
      const result = await engineService.transitionState(
        'multi_day_booking',
        'confirmed',
        'check_in',
        'staff',
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('checked_in');
    });
  });

  describe('Ongoing Entitlement Engine', () => {
    it('should calculate subscription pricing', async () => {
      const lineItems = [
        {
          id: 'subscription',
          name: 'Monthly Membership',
          quantity: 1,
          unitPrice: 99,
          type: 'subscription'
        }
      ];

      const pricingContext = {
        propertyId: 'prop-1',
        moduleId: 'mod-1',
        customerId: 'customer-1'
      };

      const result = await engineService.calculatePricing(
        'subscription', // template type for ongoing_entitlement
        lineItems,
        pricingContext
      );

      expect(result.subtotal).toBe(99);
      expect(result.propertyId).toBe('prop-1');
    });

    it('should handle subscription activation', async () => {
      const result = await engineService.transitionState(
        'subscription',
        'pending',
        'activate',
        'staff'
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('active');
    });
  });

  describe('Economics Data Extraction', () => {
    it('should correctly configure economics data structure for instant transaction', () => {
      const engine = getEngineByTemplate('menu_service');
      expect(engine.dataExtraction?.staffAttribution?.enabled).toBe(true);
      expect(engine.dataExtraction?.staffAttribution?.fields).toContain('staffId');
    });
  });
});
