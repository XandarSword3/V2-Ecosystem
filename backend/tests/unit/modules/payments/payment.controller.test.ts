/**
 * Payment Controller Unit Tests
 *
 * Tests: Stripe webhook handling, refund flow, idempotency checks,
 *        payment intent creation, cash/manual payments, transaction queries.
 */

import type { Request, Response, NextFunction } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../../src/config/index.js', () => ({
  config: {
    stripe: { secretKey: 'sk_test_fake', webhookSecret: 'whsec_test_fake' },
  },
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../src/modules/payments/loyalty-integration.js', () => ({
  awardLoyaltyPointsForPayment: vi.fn().mockResolvedValue(undefined),
}));

// Stripe mock — must be hoisted before the module under test
const mockStripeRefundsCreate = vi.fn();
const mockStripePaymentIntentsCreate = vi.fn();
const mockStripeWebhooksConstructEvent = vi.fn();

vi.mock('stripe', () => {
  function MockStripe() {
    return {
      paymentIntents: { create: mockStripePaymentIntentsCreate },
      refunds: { create: mockStripeRefundsCreate },
      webhooks: { constructEvent: mockStripeWebhooksConstructEvent },
    };
  }
  return {
    default: MockStripe,
  };
});

vi.mock('../../../../src/validation/schemas.js', () => ({
  createPaymentIntentSchema: {},
  recordCashPaymentSchema: {},
  recordManualPaymentSchema: {},
  validateBody: vi.fn().mockImplementation((_schema: unknown, body: unknown) => body),
}));

vi.mock('../../../../src/middleware/async-handler.js', () => ({
  asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => fn,
}));

import { getSupabase } from '../../../../src/database/connection.js';
import {
  handleStripeWebhook,
  refundPayment,
  recordCashPayment,
  recordManualPayment,
  getPaymentMethods,
  createPaymentIntent,
  getTransactions,
  getTransaction,
} from '../../../../src/modules/payments/payment.controller.js';

// ── Chainable Supabase mock ──────────────────────────────────────────

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'neq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt',
    'limit', 'not', 'in', 'contains', 'ilike', 'range',
  ];
  chainMethods.forEach(m => { mockObj[m] = vi.fn().mockReturnValue(mockObj); });

  mockObj.then = function (resolve: (v: { data: unknown; error: unknown }) => void) {
    resolve({ data: mockDataFn(), error: null });
    return Promise.resolve({ data: mockDataFn(), error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const d = mockDataFn();
    const first = Array.isArray(d) && d.length > 0 ? d[0] : null;
    return Promise.resolve({ data: first, error: first ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const d = mockDataFn();
    const first = Array.isArray(d) && d.length > 0 ? d[0] : null;
    return Promise.resolve({ data: first, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((rows: unknown) => {
    const obj = Array.isArray(rows) ? rows[0] : rows;
    return {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'pay-new', ...(obj as object) }, error: null }),
      }),
      then: (r: (v: { data: unknown; error: unknown }) => void) => r({ data: obj, error: null }),
    };
  });
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'is', 'not', 'or', 'in', 'select'].forEach(m => {
    updateChain[m] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.then = (r: (v: { data: unknown; error: unknown }) => void) => r({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);

  return mockObj;
}

// ── Test data ────────────────────────────────────────────────────────

const PAYMENT = {
  id: 'pay-1',
  reference_type: 'restaurant_order',
  reference_id: 'order-1',
  amount: '45.00',
  currency: 'USD',
  method: 'card',
  status: 'completed',
  stripe_payment_intent_id: 'pi_test_abc123',
  notes: null,
};

// ── Helpers ──────────────────────────────────────────────────────────

function mockReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    rawBody: Buffer.from('{}'),
    user: { userId: 'admin-1', id: 'admin-1', roles: ['super_admin'] },
    ip: '127.0.0.1',
    get: vi.fn(),
    ...overrides,
  };
}

function mockRes() {
  const res: Record<string, unknown> = { json: vi.fn(), send: vi.fn(), statusCode: 200 };
  res.status = vi.fn().mockImplementation((c: number) => { res.statusCode = c; return res; });
  return res as { json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; statusCode: number };
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ── Suite ────────────────────────────────────────────────────────────

describe('PaymentController', () => {
  let tableData: Record<string, unknown[]>;

  function setupSupabase() {
    const supabase = {
      from: vi.fn().mockImplementation((t: string) => createQueryMock(() => tableData[t] || [])),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (getSupabase as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
    return supabase;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tableData = {
      site_settings: [{ key: 'payments', value: { stripeSecretKey: 'sk_test_fake', stripeWebhookSecret: 'whsec_test', currency: 'usd' } }],
      payments: [PAYMENT],
      payment_ledger: [],
      restaurant_orders: [],
    };
  });

  // ── createPaymentIntent ─────────────────────────────────────────

  describe('createPaymentIntent', () => {
    it('should create a Stripe payment intent and return clientSecret', async () => {
      setupSupabase();
      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test_1',
        client_secret: 'cs_test_secret',
      });

      const req = mockReq({
        body: { amount: 50, currency: 'usd', referenceType: 'restaurant_order', referenceId: 'order-1' },
      });
      const res = mockRes();
      await (createPaymentIntent as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ clientSecret: 'cs_test_secret' }),
      }));
    });

    it('should convert amount to cents', async () => {
      setupSupabase();
      mockStripePaymentIntentsCreate.mockResolvedValue({ id: 'pi_test_2', client_secret: 'cs_2' });

      const req = mockReq({
        body: { amount: 99.99, currency: 'usd', referenceType: 'restaurant_order', referenceId: 'order-1' },
      });
      const res = mockRes();
      await (createPaymentIntent as Function)(req, res, mockNext());

      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 9999 }),
      );
    });
  });

  // ── handleStripeWebhook ─────────────────────────────────────────

  describe('handleStripeWebhook', () => {
    it('should return 400 when raw body missing', async () => {
      setupSupabase();
      const req = mockReq({ rawBody: undefined, headers: { 'stripe-signature': 'sig' } });
      const res = mockRes();
      await handleStripeWebhook(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle payment_intent.succeeded event', async () => {
      const sb = setupSupabase();
      const stripeEvent = {
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_live_123',
            amount: 5000,
            currency: 'usd',
            latest_charge: 'ch_123',
            metadata: { referenceType: 'restaurant_order', referenceId: 'order-1' },
          },
        },
      };
      mockStripeWebhooksConstructEvent.mockReturnValue(stripeEvent);

      const req = mockReq({
        rawBody: Buffer.from('raw'),
        headers: { 'stripe-signature': 'sig_test' },
      });
      const res = mockRes();
      await handleStripeWebhook(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      // Should insert to payment_ledger, payments, update status
      expect(sb.from).toHaveBeenCalledWith('payment_ledger');
      expect(sb.from).toHaveBeenCalledWith('payments');
    });

    it('should skip duplicate webhook via idempotency check', async () => {
      tableData.payment_ledger = [{ id: 'ledger-1', webhook_id: 'evt_dup', status: 'success' }];
      setupSupabase();

      const stripeEvent = {
        id: 'evt_dup',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_abc', amount: 1000, currency: 'usd',
            metadata: { referenceType: 'restaurant_order', referenceId: 'order-1' },
          },
        },
      };
      mockStripeWebhooksConstructEvent.mockReturnValue(stripeEvent);

      const req = mockReq({ rawBody: Buffer.from('raw'), headers: { 'stripe-signature': 'sig' } });
      const res = mockRes();
      await handleStripeWebhook(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('should handle payment_intent.payment_failed event', async () => {
      setupSupabase();
      const stripeEvent = {
        id: 'evt_fail',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_fail', amount: 2000, currency: 'usd',
            metadata: { referenceType: 'restaurant_order', referenceId: 'order-2' },
            last_payment_error: { message: 'Card declined' },
          },
        },
      };
      mockStripeWebhooksConstructEvent.mockReturnValue(stripeEvent);

      const req = mockReq({ rawBody: Buffer.from('raw'), headers: { 'stripe-signature': 'sig' } });
      const res = mockRes();
      await handleStripeWebhook(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('should return 400 on signature verification failure', async () => {
      setupSupabase();
      mockStripeWebhooksConstructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });

      const req = mockReq({ rawBody: Buffer.from('raw'), headers: { 'stripe-signature': 'bad_sig' } });
      const res = mockRes();
      await handleStripeWebhook(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── refundPayment ───────────────────────────────────────────────

  describe('refundPayment', () => {
    it('should refund a completed payment and update status', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'pay-1' }, body: { reason: 'Customer request' } });
      const res = mockRes();
      await (refundPayment as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.stringMatching(/refund/i),
      }));
    });

    it('should return 404 when payment not found', async () => {
      tableData.payments = [];
      setupSupabase();
      const req = mockReq({ params: { id: 'no-such-pay' }, body: {} });
      const res = mockRes();
      await (refundPayment as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should reject double refund', async () => {
      tableData.payments = [{ ...PAYMENT, status: 'refunded' }];
      setupSupabase();
      const req = mockReq({ params: { id: 'pay-1' }, body: {} });
      const res = mockRes();
      await (refundPayment as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(400);
      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body.error).toMatch(/already refunded/i);
    });

    it('should skip Stripe call for test payment intents', async () => {
      tableData.payments = [{ ...PAYMENT, stripe_payment_intent_id: 'pi_test_xyz' }];
      setupSupabase();
      const req = mockReq({ params: { id: 'pay-1' }, body: { reason: 'Test refund' } });
      const res = mockRes();
      await (refundPayment as Function)(req, res, mockNext());

      expect(mockStripeRefundsCreate).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── recordCashPayment ───────────────────────────────────────────

  describe('recordCashPayment', () => {
    it('should record a cash payment', async () => {
      // Clear existing payments so idempotency check doesn't trigger
      tableData.payments = [];
      setupSupabase();
      const req = mockReq({
        body: { referenceType: 'restaurant_order', referenceId: 'order-1', amount: 30, notes: 'Exact change' },
      });
      const res = mockRes();
      await (recordCashPayment as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should reject duplicate cash payment', async () => {
      // Existing completed cash payment in the mock data
      tableData.payments = [{ ...PAYMENT, method: 'cash', status: 'completed' }];
      setupSupabase();
      const req = mockReq({
        body: { referenceType: 'restaurant_order', referenceId: 'order-1', amount: 30 },
      });
      const res = mockRes();
      await (recordCashPayment as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(409);
      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/already been recorded/i);
    });
  });

  // ── recordManualPayment ─────────────────────────────────────────

  describe('recordManualPayment', () => {
    it('should record a manual payment with method', async () => {
      setupSupabase();
      const req = mockReq({
        body: { referenceType: 'restaurant_order', referenceId: 'order-1', amount: 25, method: 'whish' },
      });
      const res = mockRes();
      await (recordManualPayment as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ── getPaymentMethods ───────────────────────────────────────────

  describe('getPaymentMethods', () => {
    it('should return supported payment methods', async () => {
      const req = mockReq();
      const res = mockRes();
      await (getPaymentMethods as Function)(req, res, mockNext());

      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'cash' }),
          expect.objectContaining({ id: 'card' }),
        ]),
      );
    });
  });

  // ── getTransactions ─────────────────────────────────────────────

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      setupSupabase();
      const req = mockReq({ query: { limit: '10', offset: '0' } });
      const res = mockRes();
      await (getTransactions as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
      }));
    });
  });

  // ── getTransaction ──────────────────────────────────────────────

  describe('getTransaction', () => {
    it('should return a single transaction by id', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'pay-1' } });
      const res = mockRes();
      await (getTransaction as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for missing transaction', async () => {
      tableData.payments = [];
      setupSupabase();
      const req = mockReq({ params: { id: 'missing' } });
      const res = mockRes();
      await (getTransaction as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
