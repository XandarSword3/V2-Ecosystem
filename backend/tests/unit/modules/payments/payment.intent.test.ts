/**
 * Authoritative Payment Intent Resolution Unit Tests (Phase F6 Invariant)
 *
 * Verifies that createPaymentIntent:
 * 1. Derives amount and currency directly from DB records (transactions, bookings, tickets)
 * 2. Overrides / rejects client-tampered amounts
 * 3. Applies ISO 4217 minor unit decimals correctly (KWD/BHD * 1000, JPY * 1, USD * 100)
 * 4. Guards against double payments (already paid records)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────

const { mockStripePaymentIntentsCreate } = vi.hoisted(() => ({
  mockStripePaymentIntentsCreate: vi.fn(),
}));

vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(function () {
    return {
      paymentIntents: { create: mockStripePaymentIntentsCreate },
    };
  });
  (MockStripe as any).paymentIntents = { create: mockStripePaymentIntentsCreate };
  return { default: MockStripe };
});

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

vi.mock('../../../../src/middleware/async-handler.js', () => ({
  asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => fn,
}));

vi.mock('../../../../src/validation/schemas.js', () => ({
  createPaymentIntentSchema: {},
  validateBody: vi.fn().mockImplementation((_schema: unknown, body: unknown) => body),
}));

import { getSupabase } from '../../../../src/database/connection.js';
import { createPaymentIntent } from '../../../../src/modules/payments/payment.controller.js';

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'neq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt',
    'limit', 'not', 'in', 'contains', 'ilike', 'range',
  ];
  chainMethods.forEach((m) => {
    mockObj[m] = vi.fn().mockReturnValue(mockObj);
  });

  mockObj.then = function (resolve: (v: { data: unknown; error: unknown }) => void) {
    resolve({ data: mockDataFn(), error: null });
    return Promise.resolve({ data: mockDataFn(), error: null });
  };
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const d = mockDataFn();
    const first = Array.isArray(d) && d.length > 0 ? d[0] : null;
    return Promise.resolve({ data: first, error: null });
  });
  mockObj.single = vi.fn().mockImplementation(() => {
    const d = mockDataFn();
    const first = Array.isArray(d) && d.length > 0 ? d[0] : null;
    return Promise.resolve({ data: first, error: null });
  });

  return mockObj;
}

function mockReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    rawBody: Buffer.from('{}'),
    user: { userId: 'usr-guest-1', roles: ['customer'] },
    ip: '127.0.0.1',
    get: vi.fn(),
    ...overrides,
  };
}

function mockRes() {
  const res: Record<string, unknown> = { json: vi.fn(), send: vi.fn(), statusCode: 200 };
  res.status = vi.fn().mockImplementation((c: number) => {
    res.statusCode = c;
    return res;
  });
  return res as { json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; statusCode: number };
}

describe('Authoritative Payment Intent Resolution (F6 Invariants)', () => {
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
      site_settings: [
        { key: 'payments', value: { stripeSecretKey: 'sk_test_fake', stripeWebhookSecret: 'whsec_test' } },
      ],
      transactions: [],
      orders: [],
      bookings: [],
      tickets: [],
    };
  });

  it('resolves authoritative amount and currency from transactions record when client omits amount', async () => {
    tableData.transactions = [
      {
        id: 'tx-ord-100',
        total_amount: 42.5,
        currency: 'USD',
        payment_status: 'pending',
      },
    ];
    setupSupabase();

    mockStripePaymentIntentsCreate.mockResolvedValueOnce({
      id: 'pi_authoritative_1',
      client_secret: 'sec_authoritative_1',
    });

    const req = mockReq({
      body: {
        referenceType: 'instant_transaction',
        referenceId: 'tx-ord-100',
        // amount omitted by client (F6 canonical client behavior)
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    // Verified: Stripe amount is derived from DB total_amount (42.50 * 100 = 4250 cents)
    expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4250,
        currency: 'usd',
        metadata: expect.objectContaining({
          referenceType: 'instant_transaction',
          referenceId: 'tx-ord-100',
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          clientSecret: 'sec_authoritative_1',
        }),
      })
    );
  });

  it('overrides client-tampered amount with authoritative DB amount', async () => {
    tableData.transactions = [
      {
        id: 'tx-ord-200',
        total_amount: 89.99,
        currency: 'USD',
        payment_status: 'pending',
      },
    ];
    setupSupabase();

    mockStripePaymentIntentsCreate.mockResolvedValueOnce({
      id: 'pi_authoritative_2',
      client_secret: 'sec_authoritative_2',
    });

    // Malicious or mismatched client passes amount: 1.00 instead of DB 89.99
    const req = mockReq({
      body: {
        amount: 1.0,
        currency: 'usd',
        referenceType: 'instant_transaction',
        referenceId: 'tx-ord-200',
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    // Invariant check: Server forces 89.99 * 100 = 8999 cents, NOT 100 cents!
    expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 8999,
        currency: 'usd',
      })
    );
  });

  it('properly converts 3-decimal currencies (KWD) to minor units (*1000)', async () => {
    tableData.transactions = [
      {
        id: 'tx-ord-kwd',
        total_amount: 15.25,
        currency: 'KWD',
        payment_status: 'pending',
      },
    ];
    setupSupabase();

    mockStripePaymentIntentsCreate.mockResolvedValueOnce({
      id: 'pi_kwd_1',
      client_secret: 'sec_kwd_1',
    });

    const req = mockReq({
      body: {
        referenceType: 'instant_transaction',
        referenceId: 'tx-ord-kwd',
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    // 15.250 KWD -> 15250 minor units (fils)
    expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15250,
        currency: 'kwd',
      })
    );
  });

  it('properly converts 0-decimal currencies (JPY) to minor units (*1)', async () => {
    tableData.transactions = [
      {
        id: 'tx-ord-jpy',
        total_amount: 3500,
        currency: 'JPY',
        payment_status: 'pending',
      },
    ];
    setupSupabase();

    mockStripePaymentIntentsCreate.mockResolvedValueOnce({
      id: 'pi_jpy_1',
      client_secret: 'sec_jpy_1',
    });

    const req = mockReq({
      body: {
        referenceType: 'instant_transaction',
        referenceId: 'tx-ord-jpy',
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    // 3500 JPY -> 3500 minor units
    expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3500,
        currency: 'jpy',
      })
    );
  });

  it('rejects payment intent creation when order is already paid', async () => {
    tableData.transactions = [
      {
        id: 'tx-already-paid',
        total_amount: 50.0,
        currency: 'USD',
        payment_status: 'paid',
      },
    ];
    setupSupabase();

    const req = mockReq({
      body: {
        referenceType: 'instant_transaction',
        referenceId: 'tx-already-paid',
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Transaction is already paid',
      })
    );
    expect(mockStripePaymentIntentsCreate).not.toHaveBeenCalled();
  });

  it('resolves authoritative amount for time_exclusive_reservation from bookings table', async () => {
    tableData.bookings = [
      {
        id: 'bkg-luxury-suite',
        total_amount: 450.0,
        currency: 'USD',
        payment_status: 'pending',
      },
    ];
    setupSupabase();

    mockStripePaymentIntentsCreate.mockResolvedValueOnce({
      id: 'pi_bkg_1',
      client_secret: 'sec_bkg_1',
    });

    const req = mockReq({
      body: {
        referenceType: 'time_exclusive_reservation',
        referenceId: 'bkg-luxury-suite',
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 45000,
        currency: 'usd',
      })
    );
  });

  it('fails closed with 404 when authoritative DB record is missing, even if client supplies amount', async () => {
    // Database has NO records for this referenceId
    tableData.transactions = [];
    tableData.orders = [];
    tableData.bookings = [];
    tableData.tickets = [];
    setupSupabase();

    const req = mockReq({
      body: {
        amount: 99.99, // Client attempts to supply money without DB record
        currency: 'usd',
        referenceType: 'instant_transaction',
        referenceId: 'non-existent-order-id',
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    // Invariant check: Must fail closed with 404; NO fallback to clientAmount
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/Authoritative record not found/i),
      })
    );
    expect(mockStripePaymentIntentsCreate).not.toHaveBeenCalled();
  });

  it('fails closed with 404 when authoritative DB record is missing and client omits amount', async () => {
    tableData.transactions = [];
    tableData.orders = [];
    setupSupabase();

    const req = mockReq({
      body: {
        referenceType: 'instant_transaction',
        referenceId: 'missing-id-no-amount',
      },
    });
    const res = mockRes();

    await (createPaymentIntent as Function)(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/Authoritative record not found/i),
      })
    );
    expect(mockStripePaymentIntentsCreate).not.toHaveBeenCalled();
  });
});
