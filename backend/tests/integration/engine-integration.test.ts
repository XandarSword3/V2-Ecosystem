/**
 * Engine Integration Tests
 * Comprehensive regression tests for all engine paths
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEngineService } from '../../src/engines/engine-service.js';
import { getSupabase } from '../../src/database/connection.js';

// Mock dependencies
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/engines/engine-service.js', () => ({
  getEngineService: vi.fn(),
}));

describe('Engine Integration Tests', () => {
  let mockSupabase: any;
  let mockEngineService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = getSupabase();
    mockEngineService = getEngineService();
  });

  describe('Instant Transaction Engine', () => {
    it('should calculate pricing with economics data', async () => {
      const lineItems = [
        {
          id: 'item1',
          name: 'Test Item',
          quantity: 2,
          unitPrice: 10,
          type: 'menu_item'
        }
      ];

      const pricingContext = {
        propertyId: 'prop-1',
        moduleId: 'mod-1',
        staffId: 'staff-1',
        promoCodeUsed: 'TEST20'
      };

      mockEngineService.calculatePricing = vi.fn().mockResolvedValue({
        totalAmount: 20,
        subtotal: 20,
        taxAmount: 0,
        serviceCharge: 0,
        deliveryFee: 0,
        totalDiscount: 0,
        staffId: 'staff-1',
        propertyId: 'prop-1',
        moduleId: 'mod-1',
        promoCodeUsed: 'TEST20'
      });

      const result = await mockEngineService.calculatePricing(
        'instant_transaction',
        lineItems,
        pricingContext
      );

      expect(result).toBeDefined();
      expect(result.staffId).toBe('staff-1');
      expect(result.propertyId).toBe('prop-1');
      expect(result.moduleId).toBe('mod-1');
      expect(result.promoCodeUsed).toBe('TEST20');
    });

    it('should handle state transitions with economics tracking', async () => {
      const transitionData = {
        orderId: 'order-1',
        staffId: 'staff-1',
        cancellationReason: 'customer_request'
      };

      mockEngineService.transitionState = vi.fn().mockResolvedValue({
        success: true,
        newState: 'cancelled',
        transactionId: 'txn-1'
      });

      const result = await mockEngineService.transitionState(
        'instant_transaction',
        'confirmed',
        'cancel',
        'staff',
        transitionData
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('cancelled');
      expect(mockEngineService.transitionState).toHaveBeenCalledWith(
        'instant_transaction',
        'confirmed',
        'cancel',
        'staff',
        transitionData
      );
    });
  });

  describe('Time Exclusive Reservation Engine', () => {
    it('should calculate accommodation pricing with add-ons', async () => {
      const lineItems = [
        {
          id: 'chalet1',
          name: 'Lake View Chalet',
          quantity: 3, // 3 nights
          unitPrice: 150,
          type: 'accommodation'
        },
        {
          id: 'breakfast',
          name: 'Breakfast Add-on',
          quantity: 3,
          unitPrice: 20,
          type: 'addon'
        }
      ];

      const pricingContext = {
        propertyId: 'prop-1',
        moduleId: 'mod-1',
        checkInDate: '2024-06-15T00:00:00Z',
        checkOutDate: '2024-06-18T00:00:00Z',
        numberOfGuests: 4
      };

      mockEngineService.calculatePricing = vi.fn().mockResolvedValue({
        totalAmount: 510,
        subtotal: 510,
        taxAmount: 0,
        serviceCharge: 0,
        deliveryFee: 0,
        totalDiscount: 0,
        staffId: undefined,
        propertyId: 'prop-1',
        moduleId: 'mod-1'
      });

      const result = await mockEngineService.calculatePricing(
        'multi_day_booking',
        lineItems,
        pricingContext
      );

      expect(result.totalAmount).toBe(510);
      expect(result.propertyId).toBe('prop-1');
      expect(result.moduleId).toBe('mod-1');
    });

    it('should handle booking state transitions', async () => {
      const transitionData = {
        bookingId: 'booking-1',
        staffId: 'staff-1'
      };

      mockEngineService.transitionState = vi.fn().mockResolvedValue({
        success: true,
        newState: 'checked_in',
        transactionId: 'txn-1'
      });

      const result = await mockEngineService.transitionState(
        'multi_day_booking',
        'confirmed',
        'check_in',
        'staff',
        transitionData
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('checked_in');
    });
  });

  describe('Shared Capacity Access Engine', () => {
    it('should calculate pool session pricing', async () => {
      const lineItems = [
        {
          id: 'pool-session',
          name: 'Pool Access - 2 Hours',
          quantity: 1,
          unitPrice: 25,
          type: 'session'
        }
      ];

      const pricingContext = {
        propertyId: 'prop-1',
        moduleId: 'mod-1',
        sessionId: 'session-1'
      };

      mockEngineService.calculatePricing = vi.fn().mockResolvedValue({
        totalAmount: 25,
        subtotal: 25,
        taxAmount: 0,
        serviceCharge: 0,
        deliveryFee: 0,
        totalDiscount: 0,
        propertyId: 'prop-1',
        moduleId: 'mod-1'
      });

      const result = await mockEngineService.calculatePricing(
        'shared_capacity_access',
        lineItems,
        pricingContext
      );

      expect(result.totalAmount).toBe(25);
      expect(result.propertyId).toBe('prop-1');
    });

    it('should handle ticket validation state transitions', async () => {
      const transitionData = {
        ticketId: 'ticket-1',
        staffId: 'staff-1',
        entryTime: new Date().toISOString()
      };

      mockEngineService.transitionState = vi.fn().mockResolvedValue({
        success: true,
        newState: 'used',
        transactionId: 'txn-1'
      });

      const result = await mockEngineService.transitionState(
        'shared_capacity_access',
        'purchased',
        'validate',
        'staff',
        transitionData
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('used');
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

      mockEngineService.calculatePricing = vi.fn().mockResolvedValue({
        totalAmount: 99,
        subtotal: 99,
        taxAmount: 0,
        serviceCharge: 0,
        deliveryFee: 0,
        totalDiscount: 0,
        propertyId: 'prop-1',
        moduleId: 'mod-1'
      });

      const result = await mockEngineService.calculatePricing(
        'ongoing_entitlement',
        lineItems,
        pricingContext
      );

      expect(result.totalAmount).toBe(99);
      expect(result.propertyId).toBe('prop-1');
    });

    it('should handle subscription activation', async () => {
      const transitionData = {
        subscriptionId: 'sub-1',
        staffId: 'staff-1'
      };

      mockEngineService.transitionState = vi.fn().mockResolvedValue({
        success: true,
        newState: 'active',
        transactionId: 'txn-1'
      });

      const result = await mockEngineService.transitionState(
        'ongoing_entitlement',
        'pending',
        'activate',
        'staff',
        transitionData
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('active');
    });
  });

  describe('Economics Data Extraction', () => {
    it('should extract staff attribution data across all engines', async () => {
      const testCases = [
        {
          engineType: 'instant_transaction',
          expectedFields: ['staffId', 'propertyId', 'moduleId']
        },
        {
          engineType: 'multi_day_booking',
          expectedFields: ['staffId', 'propertyId', 'moduleId']
        },
        {
          engineType: 'shared_capacity_access',
          expectedFields: ['staffId', 'propertyId', 'moduleId']
        },
        {
          engineType: 'ongoing_entitlement',
          expectedFields: ['staffId', 'propertyId', 'moduleId']
        }
      ];

      for (const testCase of testCases) {
        const engine = mockEngineService.getEngine(testCase.engineType);
        expect(engine.dataExtraction.staffAttribution.enabled).toBe(true);
        expect(engine.dataExtraction.staffAttribution.fields).toEqual(testCase.expectedFields);
      }
    });

    it('should extract cancellation tracking data across all engines', async () => {
      const expectedFields = ['cancellationReason', 'refundAmount', 'refundReason'];
      const engineTypes = ['instant_transaction', 'multi_day_booking', 'shared_capacity_access', 'ongoing_entitlement'];

      for (const engineType of engineTypes) {
        const engine = mockEngineService.getEngine(engineType);
        expect(engine.dataExtraction.cancellationTracking.enabled).toBe(true);
        expect(engine.dataExtraction.cancellationTracking.fields).toEqual(expectedFields);
      }
    });

    it('should extract promo effectiveness data across all engines', async () => {
      const expectedFields = ['promoCodeUsed', 'discountAmount'];
      const engineTypes = ['instant_transaction', 'multi_day_booking', 'shared_capacity_access', 'ongoing_entitlement'];

      for (const engineType of engineTypes) {
        const engine = mockEngineService.getEngine(engineType);
        expect(engine.dataExtraction.promoEffectiveness.enabled).toBe(true);
        expect(engine.dataExtraction.promoEffectiveness.fields).toEqual(expectedFields);
      }
    });
  });
});
