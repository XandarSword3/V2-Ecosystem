import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatefulDbHarness } from '../../helpers/stateful-db-harness';

const harness = createStatefulDbHarness();

vi.mock('../../../src/database/connection', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/security/scoped-client.js', () => ({
  getScopedClient: () => harness.client,
  tenantContextFor: (req: any) => ({ tenantId: req?.user?.tenantId, actorId: req?.user?.userId }),
}));

vi.mock('../../../src/services/stripe.service.js', () => ({
  getStripeInstance: vi.fn().mockResolvedValue({
    refunds: {
      create: vi.fn().mockResolvedValue({ id: 're_test_123' }),
    },
  }),
}));

vi.mock('../../../src/modules/payments/discount-reversal.js', () => ({
  reverseDiscounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { processRefundById } from '../../../src/modules/payments/payment.controller';

describe('Payment Refund Relational State Integrity (Zero-Mock Emulation)', () => {
  beforeEach(() => {
    harness.clear();
  });

  it('atomically cancels transactions, cancels fulfillments, writes fulfillment_events, and triggers inventory restoration RPC', async () => {
    const orderId = 'order-uuid-101';
    const paymentId = 'pay-uuid-202';
    const fulfillmentId = 'ful-uuid-303';
    const catalogItemId = 'cat-uuid-404';

    // 1. Seed initial relational state in in-memory database
    harness.seed('payments', [
      {
        id: paymentId,
        reference_type: 'order',
        reference_id: orderId,
        amount: '150.00',
        currency: 'USD',
        status: 'completed',
        method: 'cash',
        notes: 'Initial cash checkout',
      },
    ]);

    harness.seed('transactions', [
      {
        id: orderId,
        status: 'confirmed',
        payment_status: 'paid',
        amount: 150.0,
        metadata: { itemsCount: 2 },
      },
    ]);

    harness.seed('fulfillments', [
      {
        id: fulfillmentId,
        transaction_id: orderId,
        status: 'in_progress',
        fulfillment_type: 'dine_in',
      },
    ]);

    harness.seed('order_items', [
      {
        id: 'item-1',
        transaction_id: orderId,
        catalog_item_id: catalogItemId,
        quantity: 2,
      },
    ]);

    harness.seed('fulfillment_events', []);

    // 2. Execute processRefundById
    const result = await processRefundById(
      paymentId,
      undefined, // full refund
      'Customer requested cancellation',
      'user-admin-999',
    );

    expect(result.isPartial).toBe(false);

    // 3. Verify real state mutations across tables

    // Table: payments
    const payments = harness.getTable('payments');
    expect(payments[0].status).toBe('refunded');
    expect(payments[0].notes).toContain('Customer requested cancellation');

    // Table: transactions (status must be cancelled, not left in confirmed/completed!)
    const transactions = harness.getTable('transactions');
    expect(transactions[0].status).toBe('cancelled');
    expect(transactions[0].payment_status).toBe('refunded');
    expect(transactions[0].metadata.cancellation_reason).toBe('Customer requested cancellation');

    // Table: fulfillments (active fulfillment must be cancelled so kitchen/dispatch does not fulfill)
    const fulfillments = harness.getTable('fulfillments');
    expect(fulfillments[0].status).toBe('cancelled');

    // Table: fulfillment_events (must record an immutable cancellation audit event)
    const events = harness.getTable('fulfillment_events');
    expect(events.length).toBe(1);
    expect(events[0].fulfillment_id).toBe(fulfillmentId);
    expect(events[0].event_type).toBe('cancelled');
    expect(events[0].payload.reason).toBe('Customer requested cancellation');

    // RPC: restore_inventory_for_order_items (must invoke database RPC to replenish stock)
    const rpcCalls = harness.getRpcCalls('restore_inventory_for_order_items');
    expect(rpcCalls.length).toBe(1);
    expect(rpcCalls[0]).toEqual({
      p_items: [
        {
          catalog_item_id: catalogItemId,
          quantity: 2,
        },
      ],
      p_user_id: 'user-admin-999',
    });
  });

  it('does not cancel transaction or fulfillment on a partial refund', async () => {
    const orderId = 'order-uuid-505';
    const paymentId = 'pay-uuid-606';
    const fulfillmentId = 'ful-uuid-707';

    harness.seed('payments', [
      {
        id: paymentId,
        reference_type: 'order',
        reference_id: orderId,
        amount: '200.00',
        currency: 'USD',
        status: 'completed',
        method: 'cash',
      },
    ]);

    harness.seed('transactions', [
      {
        id: orderId,
        status: 'confirmed',
        payment_status: 'paid',
        amount: 200.0,
      },
    ]);

    harness.seed('fulfillments', [
      {
        id: fulfillmentId,
        transaction_id: orderId,
        status: 'in_progress',
      },
    ]);

    // Partial refund: $50 out of $200
    const result = await processRefundById(
      paymentId,
      50.0,
      'Damaged side dish',
      'user-admin-999',
    );

    expect(result.isPartial).toBe(true);

    const payments = harness.getTable('payments');
    expect(payments[0].status).toBe('partial');

    // Transactions and fulfillments should stay active
    const transactions = harness.getTable('transactions');
    expect(transactions[0].status).toBe('confirmed');
    expect(transactions[0].payment_status).toBe('partial');

    const fulfillments = harness.getTable('fulfillments');
    expect(fulfillments[0].status).toBe('in_progress');

    // No cancellation event or order inventory restoration
    const events = harness.getTable('fulfillment_events');
    expect(events.length).toBe(0);
    expect(harness.getRpcCalls('restore_inventory_for_order_items').length).toBe(0);
  });
});
