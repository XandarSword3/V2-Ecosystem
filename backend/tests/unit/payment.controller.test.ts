import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatefulDbHarness } from '../helpers/stateful-db-harness';
import { createMockReqRes } from './utils.js';

const harness = createStatefulDbHarness();

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../src/database/connection', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../src/security/scoped-client.js', () => ({
  getScopedClient: (ctx: any) => harness.client,
  requireTenantScope: (req: any) => req?.user?.tenantId || 'tenant-1',
  tenantContextFor: (req: any) => ({ tenantId: req?.user?.tenantId || 'tenant-1', actorId: req?.user?.userId }),
}));

// Mock Stripe
const mockStripeInstance = {
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ id: 'pi_test_123', client_secret: 'secret_test_123' }),
    retrieve: vi.fn().mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' }),
  },
  refunds: {
    create: vi.fn().mockResolvedValue({ id: 're_test_123', status: 'succeeded' }),
  },
};

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return mockStripeInstance;
  }),
}));

vi.mock('../../src/services/stripe.service.js', () => ({
  getStripeInstance: vi.fn().mockResolvedValue(mockStripeInstance),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    stripe: { secretKey: 'sk_test_123' },
  },
}));

import {
  createPaymentIntent,
  recordCashPayment,
  getTransactions,
} from '../../src/modules/payments/payment.controller.js';

describe('Payment Controller (Genuine Stateful Database Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.clear();
  });

  describe('createPaymentIntent', () => {
    it('creates payment intent using authoritative database amount and returns clientSecret', async () => {
      const orderId = 'a1111111-1111-4111-8111-111111111111';

      // Seed authoritative payable record in transactions
      harness.seed('transactions', [
        {
          id: orderId,
          total_amount: 85.5,
          currency: 'USD',
          payment_status: 'pending',
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
          customer_id: 'cust-1',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        body: {
          referenceType: 'instant_transaction',
          referenceId: orderId,
        },
        user: { userId: 'staff-1', role: 'staff', tenantId: 'tenant-1' },
        property: { id: 'prop-1' },
      });

      await createPaymentIntent(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          clientSecret: 'secret_test_123',
          paymentIntentId: 'pi_test_123',
          amount: 85.5,
          currency: 'USD',
        }),
      });
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 8550, // 85.50 in cents
          currency: 'usd',
        })
      );
    });

    it('rejects payment intent when reference does not exist in database', async () => {
      harness.seed('transactions', []);

      const { req, res, next } = createMockReqRes({
        body: {
          referenceType: 'instant_transaction',
          referenceId: 'b2222222-2222-4222-8222-222222222222',
        },
        user: { userId: 'staff-1', role: 'staff', tenantId: 'tenant-1' },
      });

      await createPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Authoritative record not found'),
        })
      );
    });

    it('rejects cross-tenant payment intent creation (tenant isolation)', async () => {
      const foreignOrderId = 'c3333333-3333-4333-8333-333333333333';

      harness.seed('transactions', [
        {
          id: foreignOrderId,
          total_amount: 50.0,
          currency: 'USD',
          payment_status: 'pending',
          tenant_id: 'tenant-alien', // Belongs to a different tenant!
          property_id: 'prop-alien',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        body: {
          referenceType: 'instant_transaction',
          referenceId: foreignOrderId,
        },
        user: { userId: 'staff-1', role: 'staff', tenantId: 'tenant-1' },
      });

      await createPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("not owned by caller's tenant"),
        })
      );
    });
  });

  describe('recordCashPayment', () => {
    it('records cash payment, creates payment record in db, and marks transaction as paid', async () => {
      const orderId = 'd4444444-4444-4444-8444-444444444444';

      harness.seed('transactions', [
        {
          id: orderId,
          total_amount: 45.0,
          currency: 'USD',
          payment_status: 'pending',
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);
      harness.seed('payments', []);
      harness.seed('site_settings', [{ key: 'payments', value: { currency: 'USD' } }]);

      const { req, res, next } = createMockReqRes({
        body: {
          referenceType: 'instant_transaction',
          referenceId: orderId,
          amount: 45.0,
          notes: 'Received cash at counter',
        },
        user: { userId: 'staff-1', role: 'staff', tenantId: 'tenant-1' },
      });

      await recordCashPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            method: 'cash',
            status: 'completed',
            amount: '45.00',
          }),
        })
      );

      // Verify real state mutations across tables
      const payments = harness.getTable('payments');
      expect(payments.length).toBe(1);
      expect(payments[0].reference_id).toBe(orderId);
      expect(payments[0].method).toBe('cash');
      expect(payments[0].status).toBe('completed');

      const transactions = harness.getTable('transactions');
      expect(transactions[0].payment_status).toBe('paid');
    });

    it('rejects duplicate cash payment for the same reference with 409 conflict', async () => {
      const orderId = 'e5555555-5555-4555-8555-555555555555';

      harness.seed('transactions', [
        {
          id: orderId,
          total_amount: 30.0,
          currency: 'USD',
          payment_status: 'paid',
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);
      harness.seed('payments', [
        {
          id: 'pay-existing-cash',
          reference_type: 'instant_transaction',
          reference_id: orderId,
          method: 'cash',
          status: 'completed',
          amount: '30.00',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        body: {
          referenceType: 'instant_transaction',
          referenceId: orderId,
          amount: 30.0,
        },
        user: { userId: 'staff-1', role: 'staff', tenantId: 'tenant-1' },
      });

      await recordCashPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'A cash payment has already been recorded for this item',
        })
      );
    });
  });

  describe('getTransactions', () => {
    it('lists payments from stateful database scoped to caller tenant', async () => {
      harness.seed('payments', [
        { id: 'pay-1', amount: '50.00', tenant_id: 'tenant-1', status: 'completed' },
        { id: 'pay-2', amount: '120.00', tenant_id: 'tenant-1', status: 'completed' },
      ]);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'admin-1', role: 'admin', tenantId: 'tenant-1' },
      });

      await getTransactions(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: 'pay-1' }),
            expect.objectContaining({ id: 'pay-2' }),
          ]),
        })
      );
    });
  });
});
