import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStatefulDbHarness } from '../../helpers/stateful-db-harness';
import type { Request, Response } from 'express';

const harness = createStatefulDbHarness();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => harness.supabase,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

let mockConstructEvent: any = vi.fn();
const mockStripe = {
  webhooks: {
    constructEvent: (...args: any[]) => mockConstructEvent(...args),
  },
};

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return mockStripe;
    }),
  };
});

vi.mock('../../../src/config/index.js', () => ({
  config: {
    stripe: {
      secretKey: 'sk_test_configured_key',
      webhookSecret: 'whsec_test_secret_123',
    },
  },
}));

vi.mock('../../../src/engines/idempotency-guard.js', () => ({
  getIdempotencyGuard: () => ({
    executeOnce: async (_key: string, _actor: string, _type: string, _id: string, _event: string, fn: () => Promise<any>) => {
      return await fn();
    },
  }),
}));

vi.mock('../../../src/modules/fiscal/fiscal-document.service.js', () => ({
  fiscalDocumentService: {
    issueForTransaction: vi.fn().mockResolvedValue({ id: 'fisc-1' }),
  },
}));

import { handleStripeWebhook } from '../../../src/modules/payments/payment.controller.js';

function createMockReqRes(options: {
  rawBody?: Buffer;
  signature?: string;
}) {
  const req: any = {
    headers: {
      'stripe-signature': options.signature || 'sig_valid_test_signature',
    },
    rawBody: options.rawBody,
  };

  const res: any = {
    statusCode: 200,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn(function (data: any) {
      this.body = data;
      return this;
    }),
    send: vi.fn(function (data: any) {
      this.body = data;
      return this;
    }),
  };

  return { req, res };
}

describe('Stripe Webhook Idempotency & Signature Guard (Phase F8 / Production Readiness)', () => {
  const TENANT_ID = 'a1111111-1111-4111-8111-111111111111';
  const TRANSACTION_ID = 'b1111111-1111-4111-8111-111111111111';
  const EVENT_ID = 'evt_test_webhook_00000001';

  beforeEach(() => {
    harness.clear();
    vi.clearAllMocks();

    harness.seed('transactions', [
      {
        id: TRANSACTION_ID,
        tenant_id: TENANT_ID,
        total_amount: 45.0,
        payment_status: 'pending',
        currency: 'USD',
      },
    ]);
  });

  it('rejects webhooks with missing rawBody with HTTP 400', async () => {
    const { req, res } = createMockReqRes({ rawBody: undefined });

    await handleStripeWebhook(req as Request, res as Response);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Missing raw body' });
  });

  it('rejects webhooks with invalid HMAC signature with HTTP 400', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature hash');
    });

    const { req, res } = createMockReqRes({
      rawBody: Buffer.from(JSON.stringify({ id: 'evt_bad' })),
      signature: 'sig_corrupted',
    });

    await handleStripeWebhook(req as Request, res as Response);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Webhook Error: Invalid signature hash');
  });

  it('successfully processes payment_intent.succeeded: records payment, updates status, and inserts payment_ledger', async () => {
    const stripeEvent = {
      id: EVENT_ID,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123456',
          amount: 4500, // 45.00 USD
          currency: 'usd',
          latest_charge: 'ch_charge_123456',
          metadata: {
            referenceType: 'transaction',
            referenceId: TRANSACTION_ID,
          },
        },
      },
    };

    mockConstructEvent.mockReturnValue(stripeEvent);

    const { req, res } = createMockReqRes({
      rawBody: Buffer.from(JSON.stringify(stripeEvent)),
      signature: 'sig_valid_test_signature',
    });

    await handleStripeWebhook(req as Request, res as Response);

    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });

    // State verification 1: Payments record inserted with completed status
    const payments = harness.getTable('payments');
    expect(payments).toHaveLength(1);
    expect(payments[0].stripe_payment_intent_id).toBe('pi_test_123456');
    expect(payments[0].status).toBe('completed');
    expect(payments[0].amount).toBe('45.00');

    // State verification 2: Transaction payment_status moved to 'paid'
    const transactions = harness.getTable('transactions');
    expect(transactions[0].payment_status).toBe('paid');

    // State verification 3: Payment ledger records immutable success entry with webhook_id
    const ledger = harness.getTable('payment_ledger');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].webhook_id).toBe(EVENT_ID);
    expect(ledger[0].status).toBe('success');
    expect(ledger[0].gateway_reference_id).toBe('pi_test_123456');
  });

  it('guarantees idempotency on duplicate webhook replays: ignores already processed event without double crediting', async () => {
    // Seed existing ledger row indicating this webhook was already processed
    harness.seed('payment_ledger', [
      {
        id: 'ledg-existing-1',
        webhook_id: EVENT_ID,
        status: 'success',
        reference_type: 'transaction',
        reference_id: TRANSACTION_ID,
        gateway_reference_id: 'pi_test_123456',
      },
    ]);
    harness.seed('payments', [
      {
        id: 'pay-existing-1',
        stripe_payment_intent_id: 'pi_test_123456',
        status: 'completed',
        amount: 45,
      },
    ]);

    const stripeEvent = {
      id: EVENT_ID,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123456',
          amount: 4500,
          currency: 'usd',
          metadata: {
            referenceType: 'transaction',
            referenceId: TRANSACTION_ID,
          },
        },
      },
    };

    mockConstructEvent.mockReturnValue(stripeEvent);

    const { req, res } = createMockReqRes({
      rawBody: Buffer.from(JSON.stringify(stripeEvent)),
      signature: 'sig_valid_test_signature',
    });

    await handleStripeWebhook(req as Request, res as Response);

    // Responds cleanly to Stripe
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });

    // Assert: No duplicate payment rows were inserted
    const payments = harness.getTable('payments');
    expect(payments).toHaveLength(1);

    // Assert: No duplicate ledger entries were inserted
    const ledger = harness.getTable('payment_ledger');
    expect(ledger).toHaveLength(1);
  });
});
