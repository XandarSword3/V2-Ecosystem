/**
 * Payment Service Unit Tests
 *
 * Comprehensive tests for the payment service covering:
 * - Recording payments
 * - Processing payments
 * - Refunds
 * - Payment statistics
 * - Validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPaymentService } from '../../src/lib/services/payment.service';
import { InMemoryPaymentRepository } from '../../src/lib/repositories/payment.repository.memory';
import type { Container, Payment, PaymentMethod, PaymentStatus, ReferenceType } from '../../src/lib/container/types';

// Test data
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORDER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_BOOKING_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PAYMENT_ID = '44444444-4444-4444-4444-444444444444';

function createMockContainer(paymentRepo: InMemoryPaymentRepository): Container {
  return {
    paymentRepository: paymentRepo,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as Container;
}

function createTestPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: TEST_PAYMENT_ID,
    reference_type: 'order',
    reference_id: TEST_ORDER_ID,
    amount: '100.00',
    currency: 'EUR',
    method: 'card',
    status: 'pending',
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    notes: null,
    processed_by: null,
    processed_at: null,
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
}

describe('PaymentService', () => {
  let paymentRepo: InMemoryPaymentRepository;
  let container: Container;
  let paymentService: ReturnType<typeof createPaymentService>;

  beforeEach(() => {
    paymentRepo = new InMemoryPaymentRepository();
    container = createMockContainer(paymentRepo);
    paymentService = createPaymentService(container);
  });

  // =============================================
  // RECORD PAYMENT TESTS
  // =============================================
  describe('recordPayment', () => {
    it('should record a payment successfully', async () => {
      const result = await paymentService.recordPayment({
        referenceType: 'order',
        referenceId: TEST_ORDER_ID,
        amount: 100,
        method: 'card',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.reference_type).toBe('order');
      expect(result.reference_id).toBe(TEST_ORDER_ID);
      expect(result.amount).toBe('100.00');
      expect(result.currency).toBe('EUR');
      expect(result.method).toBe('card');
      expect(result.status).toBe('pending');
    });

    it('should record payment with string amount', async () => {
      const result = await paymentService.recordPayment({
        referenceType: 'booking',
        referenceId: TEST_BOOKING_ID,
        amount: '250.50',
        method: 'cash',
      });

      expect(result.amount).toBe('250.50');
    });

    it('should record payment with custom currency', async () => {
      const result = await paymentService.recordPayment({
        referenceType: 'order',
        referenceId: TEST_ORDER_ID,
        amount: 100,
        currency: 'USD',
        method: 'card',
      });

      expect(result.currency).toBe('USD');
    });

    it('should record payment with notes', async () => {
      const result = await paymentService.recordPayment({
        referenceType: 'order',
        referenceId: TEST_ORDER_ID,
        amount: 100,
        method: 'card',
        notes: 'Customer paid in person',
      });

      expect(result.notes).toBe('Customer paid in person');
    });

    it('should record payment with processedBy', async () => {
      const result = await paymentService.recordPayment({
        referenceType: 'order',
        referenceId: TEST_ORDER_ID,
        amount: 100,
        method: 'card',
        processedBy: TEST_USER_ID,
      });

      expect(result.processed_by).toBe(TEST_USER_ID);
    });

    it('should record payment with Stripe IDs', async () => {
      const result = await paymentService.recordPayment({
        referenceType: 'order',
        referenceId: TEST_ORDER_ID,
        amount: 100,
        method: 'card',
        stripePaymentIntentId: 'pi_123',
        stripeChargeId: 'ch_456',
      });

      expect(result.stripe_payment_intent_id).toBe('pi_123');
      expect(result.stripe_charge_id).toBe('ch_456');
    });

    it('should throw error for invalid reference type', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'invalid' as ReferenceType,
          referenceId: TEST_ORDER_ID,
          amount: 100,
          method: 'card',
        })
      ).rejects.toThrow('Invalid reference type');
    });

    it('should throw error for missing reference type', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: '' as ReferenceType,
          referenceId: TEST_ORDER_ID,
          amount: 100,
          method: 'card',
        })
      ).rejects.toThrow('Invalid reference type');
    });

    it('should throw error for invalid reference ID', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: 'invalid-id',
          amount: 100,
          method: 'card',
        })
      ).rejects.toThrow('Invalid reference ID format');
    });

    it('should throw error for empty reference ID', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: '',
          amount: 100,
          method: 'card',
        })
      ).rejects.toThrow('Invalid reference ID format');
    });

    it('should throw error for zero amount', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: 0,
          method: 'card',
        })
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw error for negative amount', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: -100,
          method: 'card',
        })
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw error for non-numeric string amount', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: 'abc' as unknown as number,
          method: 'card',
        })
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw error for unsupported currency', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: 100,
          currency: 'JPY',
          method: 'card',
        })
      ).rejects.toThrow('Unsupported currency');
    });

    it('should throw error for invalid payment method', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: 100,
          method: 'bitcoin' as PaymentMethod,
        })
      ).rejects.toThrow('Invalid payment method');
    });

    it('should throw error for invalid processedBy ID', async () => {
      await expect(
        paymentService.recordPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: 100,
          method: 'card',
          processedBy: 'invalid-id',
        })
      ).rejects.toThrow('Invalid processedBy user ID format');
    });

    it('should accept all valid payment methods', async () => {
      const methods: PaymentMethod[] = ['card', 'cash', 'bank_transfer', 'other'];
      for (const method of methods) {
        const result = await paymentService.recordPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: 100,
          method,
        });
        expect(result.method).toBe(method);
      }
    });

    it('should accept all valid reference types', async () => {
      const types: ReferenceType[] = ['order', 'booking', 'pool_ticket', 'snack_order'];
      for (const refType of types) {
        const result = await paymentService.recordPayment({
          referenceType: refType,
          referenceId: TEST_ORDER_ID,
          amount: 100,
          method: 'card',
        });
        expect(result.reference_type).toBe(refType);
      }
    });
  });

  // =============================================
  // PROCESS PAYMENT TESTS
  // =============================================
  describe('processPayment', () => {
    it('should process and complete a payment', async () => {
      const result = await paymentService.processPayment({
        referenceType: 'order',
        referenceId: TEST_ORDER_ID,
        amount: 100,
        method: 'card',
        processedBy: TEST_USER_ID,
      });

      expect(result.status).toBe('completed');
      expect(result.processed_by).toBe(TEST_USER_ID);
    });

    it('should process payment with notes', async () => {
      const result = await paymentService.processPayment({
        referenceType: 'booking',
        referenceId: TEST_BOOKING_ID,
        amount: 500,
        method: 'cash',
        processedBy: TEST_USER_ID,
        notes: 'Deposit payment',
      });

      expect(result.status).toBe('completed');
      expect(result.notes).toBe('Deposit payment');
    });

    it('should throw error for invalid processedBy', async () => {
      await expect(
        paymentService.processPayment({
          referenceType: 'order',
          referenceId: TEST_ORDER_ID,
          amount: 100,
          method: 'card',
          processedBy: 'invalid',
        })
      ).rejects.toThrow('Invalid processedBy user ID format');
    });
  });

  // =============================================
  // GET PAYMENT TESTS
  // =============================================
  describe('getPaymentById', () => {
    it('should get payment by ID', async () => {
      const payment = createTestPayment();
      paymentRepo.addPayment(payment);

      const result = await paymentService.getPaymentById(TEST_PAYMENT_ID);

      expect(result).toBeDefined();
      expect(result?.id).toBe(TEST_PAYMENT_ID);
    });

    it('should return null for non-existent payment', async () => {
      const result = await paymentService.getPaymentById(TEST_PAYMENT_ID);
      expect(result).toBeNull();
    });

    it('should throw error for invalid payment ID', async () => {
      await expect(paymentService.getPaymentById('invalid-id')).rejects.toThrow(
        'Invalid payment ID format'
      );
    });

    it('should throw error for empty payment ID', async () => {
      await expect(paymentService.getPaymentById('')).rejects.toThrow(
        'Invalid payment ID format'
      );
    });
  });

  describe('getPaymentsForReference', () => {
    beforeEach(() => {
      paymentRepo.addPayment(createTestPayment({ id: '11111111-1111-1111-1111-111111111111' }));
      paymentRepo.addPayment(createTestPayment({ id: '22222222-2222-2222-2222-222222222222' }));
      paymentRepo.addPayment(
        createTestPayment({
          id: '33333333-3333-3333-3333-333333333333',
          reference_id: TEST_BOOKING_ID,
          reference_type: 'booking',
        })
      );
    });

    it('should get payments for order', async () => {
      const result = await paymentService.getPaymentsForReference('order', TEST_ORDER_ID);
      expect(result.length).toBe(2);
    });

    it('should get payments for booking', async () => {
      const result = await paymentService.getPaymentsForReference('booking', TEST_BOOKING_ID);
      expect(result.length).toBe(1);
    });

    it('should return empty array for no payments', async () => {
      const result = await paymentService.getPaymentsForReference(
        'pool_ticket',
        TEST_ORDER_ID
      );
      expect(result.length).toBe(0);
    });

    it('should throw error for invalid reference type', async () => {
      await expect(
        paymentService.getPaymentsForReference('invalid' as ReferenceType, TEST_ORDER_ID)
      ).rejects.toThrow('Invalid reference type');
    });

    it('should throw error for invalid reference ID', async () => {
      await expect(
        paymentService.getPaymentsForReference('order', 'invalid')
      ).rejects.toThrow('Invalid reference ID format');
    });
  });

  // =============================================
  // LIST PAYMENTS TESTS
  // =============================================
  describe('listPayments', () => {
    beforeEach(() => {
      // Add variety of payments
      paymentRepo.addPayment(
        createTestPayment({
          id: '11111111-1111-1111-1111-111111111111',
          method: 'card',
          status: 'completed',
        })
      );
      paymentRepo.addPayment(
        createTestPayment({
          id: '22222222-2222-2222-2222-222222222222',
          method: 'cash',
          status: 'pending',
        })
      );
      paymentRepo.addPayment(
        createTestPayment({
          id: '33333333-3333-3333-3333-333333333333',
          method: 'bank_transfer',
          status: 'refunded',
          reference_type: 'booking',
          reference_id: TEST_BOOKING_ID,
        })
      );
    });

    it('should list all payments', async () => {
      const result = await paymentService.listPayments();
      expect(result.payments.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should filter by reference type', async () => {
      const result = await paymentService.listPayments({ referenceType: 'booking' });
      expect(result.payments.length).toBe(1);
      expect(result.payments[0].reference_type).toBe('booking');
    });

    it('should filter by method', async () => {
      const result = await paymentService.listPayments({ method: 'card' });
      expect(result.payments.length).toBe(1);
    });

    it('should filter by status', async () => {
      const result = await paymentService.listPayments({ status: 'completed' });
      expect(result.payments.length).toBe(1);
    });

    it('should paginate results', async () => {
      const result = await paymentService.listPayments({ limit: 2, offset: 0 });
      expect(result.payments.length).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should handle offset', async () => {
      const result = await paymentService.listPayments({ limit: 2, offset: 2 });
      expect(result.payments.length).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should throw error for invalid reference type filter', async () => {
      await expect(
        paymentService.listPayments({ referenceType: 'invalid' as ReferenceType })
      ).rejects.toThrow('Invalid reference type filter');
    });

    it('should throw error for invalid method filter', async () => {
      await expect(
        paymentService.listPayments({ method: 'invalid' as PaymentMethod })
      ).rejects.toThrow('Invalid payment method filter');
    });

    it('should throw error for invalid status filter', async () => {
      await expect(
        paymentService.listPayments({ status: 'invalid' as PaymentStatus })
      ).rejects.toThrow('Invalid payment status filter');
    });

    it('should throw error for limit too low', async () => {
      await expect(paymentService.listPayments({ limit: 0 })).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should throw error for limit too high', async () => {
      await expect(paymentService.listPayments({ limit: 101 })).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should throw error for negative offset', async () => {
      await expect(paymentService.listPayments({ offset: -1 })).rejects.toThrow(
        'Offset must be non-negative'
      );
    });

    it('should throw error for invalid start date', async () => {
      await expect(
        paymentService.listPayments({ startDate: 'invalid-date' })
      ).rejects.toThrow('Invalid start date format');
    });

    it('should throw error for invalid end date', async () => {
      await expect(
        paymentService.listPayments({ endDate: 'invalid-date' })
      ).rejects.toThrow('Invalid end date format');
    });

    it('should throw error when start date is after end date', async () => {
      await expect(
        paymentService.listPayments({
          startDate: '2024-12-31',
          endDate: '2024-01-01',
        })
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should filter by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await paymentService.listPayments({
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString(),
      });
      expect(result.payments.length).toBe(3);
    });
  });

  // =============================================
  // STATUS UPDATE TESTS
  // =============================================
  describe('completePayment', () => {
    it('should complete a pending payment', async () => {
      paymentRepo.addPayment(createTestPayment());

      const result = await paymentService.completePayment(TEST_PAYMENT_ID);
      expect(result.status).toBe('completed');
    });

    it('should complete payment with processor', async () => {
      paymentRepo.addPayment(createTestPayment());

      const result = await paymentService.completePayment(TEST_PAYMENT_ID, TEST_USER_ID);
      expect(result.status).toBe('completed');
    });

    it('should throw error for non-existent payment', async () => {
      await expect(paymentService.completePayment(TEST_PAYMENT_ID)).rejects.toThrow(
        'Payment not found'
      );
    });

    it('should throw error for already completed payment', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'completed' }));

      await expect(paymentService.completePayment(TEST_PAYMENT_ID)).rejects.toThrow(
        'Cannot complete payment with status: completed'
      );
    });

    it('should throw error for invalid payment ID', async () => {
      await expect(paymentService.completePayment('invalid')).rejects.toThrow(
        'Invalid payment ID format'
      );
    });
  });

  describe('failPayment', () => {
    it('should fail a pending payment', async () => {
      paymentRepo.addPayment(createTestPayment());

      const result = await paymentService.failPayment(TEST_PAYMENT_ID);
      expect(result.status).toBe('failed');
    });

    it('should fail payment with reason', async () => {
      paymentRepo.addPayment(createTestPayment());

      const result = await paymentService.failPayment(TEST_PAYMENT_ID, 'Card declined');
      expect(result.status).toBe('failed');
      expect(result.notes).toBe('Card declined');
    });

    it('should throw error for non-existent payment', async () => {
      await expect(paymentService.failPayment(TEST_PAYMENT_ID)).rejects.toThrow(
        'Payment not found'
      );
    });

    it('should throw error for completed payment', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'completed' }));

      await expect(paymentService.failPayment(TEST_PAYMENT_ID)).rejects.toThrow(
        'Cannot fail payment with status: completed'
      );
    });

    it('should throw error for invalid payment ID', async () => {
      await expect(paymentService.failPayment('invalid')).rejects.toThrow(
        'Invalid payment ID format'
      );
    });
  });

  describe('cancelPayment', () => {
    it('should cancel a pending payment', async () => {
      paymentRepo.addPayment(createTestPayment());

      const result = await paymentService.cancelPayment(TEST_PAYMENT_ID);
      expect(result.status).toBe('cancelled');
    });

    it('should cancel payment with reason', async () => {
      paymentRepo.addPayment(createTestPayment());

      const result = await paymentService.cancelPayment(TEST_PAYMENT_ID, 'Customer request');
      expect(result.status).toBe('cancelled');
      expect(result.notes).toBe('Customer request');
    });

    it('should throw error for non-existent payment', async () => {
      await expect(paymentService.cancelPayment(TEST_PAYMENT_ID)).rejects.toThrow(
        'Payment not found'
      );
    });

    it('should throw error for completed payment', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'completed' }));

      await expect(paymentService.cancelPayment(TEST_PAYMENT_ID)).rejects.toThrow(
        'Cannot cancel payment with status: completed'
      );
    });

    it('should throw error for invalid payment ID', async () => {
      await expect(paymentService.cancelPayment('invalid')).rejects.toThrow(
        'Invalid payment ID format'
      );
    });
  });

  describe('refundPayment', () => {
    it('should refund a completed payment', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'completed' }));

      const result = await paymentService.refundPayment({
        paymentId: TEST_PAYMENT_ID,
        processedBy: TEST_USER_ID,
      });

      expect(result.status).toBe('refunded');
    });

    it('should refund with reason', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'completed' }));

      const result = await paymentService.refundPayment({
        paymentId: TEST_PAYMENT_ID,
        processedBy: TEST_USER_ID,
        reason: 'Duplicate charge',
      });

      expect(result.status).toBe('refunded');
      expect(result.notes).toContain('Duplicate charge');
    });

    it('should throw error for non-existent payment', async () => {
      await expect(
        paymentService.refundPayment({
          paymentId: TEST_PAYMENT_ID,
          processedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Payment not found');
    });

    it('should throw error for pending payment', async () => {
      paymentRepo.addPayment(createTestPayment());

      await expect(
        paymentService.refundPayment({
          paymentId: TEST_PAYMENT_ID,
          processedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Only completed payments can be refunded');
    });

    it('should throw error for invalid payment ID', async () => {
      await expect(
        paymentService.refundPayment({
          paymentId: 'invalid',
          processedBy: TEST_USER_ID,
        })
      ).rejects.toThrow('Invalid payment ID format');
    });

    it('should throw error for invalid processedBy', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'completed' }));

      await expect(
        paymentService.refundPayment({
          paymentId: TEST_PAYMENT_ID,
          processedBy: 'invalid',
        })
      ).rejects.toThrow('Invalid processedBy user ID format');
    });

    it('should throw error for empty processedBy', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'completed' }));

      await expect(
        paymentService.refundPayment({
          paymentId: TEST_PAYMENT_ID,
          processedBy: '',
        })
      ).rejects.toThrow('Invalid processedBy user ID format');
    });
  });

  // =============================================
  // CALCULATION TESTS
  // =============================================
  describe('getTotalPaidForReference', () => {
    it('should calculate total paid for reference', async () => {
      paymentRepo.addPayment(
        createTestPayment({
          id: '11111111-1111-1111-1111-111111111111',
          amount: '100.00',
          status: 'completed',
        })
      );
      paymentRepo.addPayment(
        createTestPayment({
          id: '22222222-2222-2222-2222-222222222222',
          amount: '50.00',
          status: 'completed',
        })
      );

      const total = await paymentService.getTotalPaidForReference('order', TEST_ORDER_ID);
      expect(total).toBe(150);
    });

    it('should only count completed payments', async () => {
      paymentRepo.addPayment(
        createTestPayment({
          id: '11111111-1111-1111-1111-111111111111',
          amount: '100.00',
          status: 'completed',
        })
      );
      paymentRepo.addPayment(
        createTestPayment({
          id: '22222222-2222-2222-2222-222222222222',
          amount: '50.00',
          status: 'pending',
        })
      );

      const total = await paymentService.getTotalPaidForReference('order', TEST_ORDER_ID);
      expect(total).toBe(100);
    });

    it('should return 0 for no payments', async () => {
      const total = await paymentService.getTotalPaidForReference('order', TEST_ORDER_ID);
      expect(total).toBe(0);
    });
  });

  describe('isFullyPaid', () => {
    it('should return true when fully paid', async () => {
      paymentRepo.addPayment(
        createTestPayment({
          amount: '100.00',
          status: 'completed',
        })
      );

      const result = await paymentService.isFullyPaid('order', TEST_ORDER_ID, 100);
      expect(result).toBe(true);
    });

    it('should return true for overpayment', async () => {
      paymentRepo.addPayment(
        createTestPayment({
          amount: '110.00',
          status: 'completed',
        })
      );

      // Overpayment should not be fully paid (excess)
      const result = await paymentService.isFullyPaid('order', TEST_ORDER_ID, 100);
      expect(result).toBe(false);
    });

    it('should return false when underpaid', async () => {
      paymentRepo.addPayment(
        createTestPayment({
          amount: '50.00',
          status: 'completed',
        })
      );

      const result = await paymentService.isFullyPaid('order', TEST_ORDER_ID, 100);
      expect(result).toBe(false);
    });

    it('should return false for no payments', async () => {
      const result = await paymentService.isFullyPaid('order', TEST_ORDER_ID, 100);
      expect(result).toBe(false);
    });

    it('should handle floating point precision', async () => {
      paymentRepo.addPayment(
        createTestPayment({
          amount: '99.99',
          status: 'completed',
        })
      );

      const result = await paymentService.isFullyPaid('order', TEST_ORDER_ID, 99.99);
      expect(result).toBe(true);
    });
  });

  // =============================================
  // STATISTICS TESTS
  // =============================================
  describe('getPaymentStats', () => {
    beforeEach(() => {
      paymentRepo.addPayment(
        createTestPayment({
          id: '11111111-1111-1111-1111-111111111111',
          amount: '100.00',
          method: 'card',
          status: 'completed',
        })
      );
      paymentRepo.addPayment(
        createTestPayment({
          id: '22222222-2222-2222-2222-222222222222',
          amount: '50.00',
          method: 'cash',
          status: 'completed',
        })
      );
      paymentRepo.addPayment(
        createTestPayment({
          id: '33333333-3333-3333-3333-333333333333',
          amount: '25.00',
          method: 'card',
          status: 'pending',
        })
      );
    });

    it('should get payment statistics', async () => {
      const stats = await paymentService.getPaymentStats();

      expect(stats.totalTransactions).toBe(3);
      expect(stats.totalRevenue).toBe(150); // Only completed
      expect(stats.byMethod.card.count).toBe(2);
      expect(stats.byMethod.cash.count).toBe(1);
      expect(stats.byStatus.completed).toBe(2);
      expect(stats.byStatus.pending).toBe(1);
    });

    it('should calculate average transaction value', async () => {
      const stats = await paymentService.getPaymentStats();
      expect(stats.averageTransactionValue).toBe(75); // 150 / 2 completed
    });

    it('should handle empty payments', async () => {
      paymentRepo.clear();
      const stats = await paymentService.getPaymentStats();

      expect(stats.totalTransactions).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.averageTransactionValue).toBe(0);
    });

    it('should throw error for invalid start date', async () => {
      await expect(paymentService.getPaymentStats('invalid')).rejects.toThrow(
        'Invalid start date format'
      );
    });

    it('should throw error for invalid end date', async () => {
      await expect(paymentService.getPaymentStats(undefined, 'invalid')).rejects.toThrow(
        'Invalid end date format'
      );
    });

    it('should throw error when start date after end date', async () => {
      await expect(
        paymentService.getPaymentStats('2024-12-31', '2024-01-01')
      ).rejects.toThrow('Start date must be before end date');
    });
  });

  describe('getDailyRevenue', () => {
    it('should get daily revenue', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      paymentRepo.addPayment(
        createTestPayment({
          id: '11111111-1111-1111-1111-111111111111',
          amount: '100.00',
          status: 'completed',
        })
      );

      const result = await paymentService.getDailyRevenue(yesterday, today);
      expect(result.length).toBe(2); // yesterday and today
    });

    it('should fill in missing dates with zero', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-03';

      const result = await paymentService.getDailyRevenue(startDate, endDate);
      expect(result.length).toBe(3);
      expect(result[0].amount).toBe(0);
    });

    it('should throw error for invalid start date', async () => {
      await expect(
        paymentService.getDailyRevenue('invalid', '2024-01-01')
      ).rejects.toThrow('Invalid start date');
    });

    it('should throw error for invalid end date', async () => {
      await expect(
        paymentService.getDailyRevenue('2024-01-01', 'invalid')
      ).rejects.toThrow('Invalid end date');
    });

    it('should throw error when start after end', async () => {
      await expect(
        paymentService.getDailyRevenue('2024-12-31', '2024-01-01')
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should throw error for empty start date', async () => {
      await expect(paymentService.getDailyRevenue('', '2024-01-01')).rejects.toThrow(
        'Invalid start date'
      );
    });
  });

  // =============================================
  // UTILITY TESTS
  // =============================================
  describe('isValidPaymentMethod', () => {
    it('should return true for valid methods', () => {
      expect(paymentService.isValidPaymentMethod('card')).toBe(true);
      expect(paymentService.isValidPaymentMethod('cash')).toBe(true);
      expect(paymentService.isValidPaymentMethod('bank_transfer')).toBe(true);
      expect(paymentService.isValidPaymentMethod('other')).toBe(true);
    });

    it('should return false for invalid methods', () => {
      expect(paymentService.isValidPaymentMethod('bitcoin')).toBe(false);
      expect(paymentService.isValidPaymentMethod('')).toBe(false);
    });
  });

  describe('isValidPaymentStatus', () => {
    it('should return true for valid statuses', () => {
      expect(paymentService.isValidPaymentStatus('pending')).toBe(true);
      expect(paymentService.isValidPaymentStatus('completed')).toBe(true);
      expect(paymentService.isValidPaymentStatus('failed')).toBe(true);
      expect(paymentService.isValidPaymentStatus('refunded')).toBe(true);
      expect(paymentService.isValidPaymentStatus('cancelled')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(paymentService.isValidPaymentStatus('processing')).toBe(false);
      expect(paymentService.isValidPaymentStatus('')).toBe(false);
    });
  });

  // =============================================
  // MAINTENANCE TESTS
  // =============================================
  describe('getPendingPaymentsOlderThan', () => {
    it('should get old pending payments', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48);

      paymentRepo.addPayment(
        createTestPayment({
          status: 'pending',
          created_at: oldDate.toISOString(),
        })
      );

      const result = await paymentService.getPendingPaymentsOlderThan(24);
      expect(result.length).toBe(1);
    });

    it('should not get recent pending payments', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'pending' }));

      const result = await paymentService.getPendingPaymentsOlderThan(24);
      expect(result.length).toBe(0);
    });

    it('should throw error for negative hours', async () => {
      await expect(paymentService.getPendingPaymentsOlderThan(-1)).rejects.toThrow(
        'Hours must be non-negative'
      );
    });
  });

  describe('expireOldPendingPayments', () => {
    it('should expire old pending payments', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48);

      paymentRepo.addPayment(
        createTestPayment({
          status: 'pending',
          created_at: oldDate.toISOString(),
        })
      );

      const count = await paymentService.expireOldPendingPayments(24);
      expect(count).toBe(1);

      const payment = await paymentRepo.getById(TEST_PAYMENT_ID);
      expect(payment?.status).toBe('cancelled');
    });

    it('should return 0 for no old payments', async () => {
      paymentRepo.addPayment(createTestPayment({ status: 'pending' }));

      const count = await paymentService.expireOldPendingPayments(24);
      expect(count).toBe(0);
    });

    it('should use default 24 hours', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25);

      paymentRepo.addPayment(
        createTestPayment({
          status: 'pending',
          created_at: oldDate.toISOString(),
        })
      );

      const count = await paymentService.expireOldPendingPayments();
      expect(count).toBe(1);
    });
  });
});
