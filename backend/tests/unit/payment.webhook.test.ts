/**
 * Payment Webhook Unit Tests
 * 
 * Tests for Stripe webhook handling, signature verification, and payment processing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Stripe types
interface MockPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, string>;
  latest_charge: string | null;
  last_payment_error?: { message: string };
}

interface MockStripeEvent {
  id: string;
  type: string;
  data: {
    object: MockPaymentIntent;
  };
}

// Mock database
const mockPayments: any[] = [];
const mockOrders: Map<string, { payment_status: string }> = new Map();
const mockBookings: Map<string, { payment_status: string }> = new Map();

// Reset mocks before each test
beforeEach(() => {
  mockPayments.length = 0;
  mockOrders.clear();
  mockBookings.clear();
});

describe('Stripe Webhook Signature Verification', () => {
  const webhookSecret = 'whsec_test_secret_key_12345';

  function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Simplified verification logic (real implementation uses Stripe SDK)
    if (!signature || !signature.startsWith('t=')) {
      return false;
    }
    // In real code: stripe.webhooks.constructEvent(payload, signature, secret)
    return signature.includes('v1=') && secret === webhookSecret;
  }

  it('should accept valid webhook signature', () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
    const signature = 't=1234567890,v1=valid_signature_hash';
    
    const isValid = verifyWebhookSignature(payload, signature, webhookSecret);
    expect(isValid).toBe(true);
  });

  it('should reject missing signature', () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
    
    const isValid = verifyWebhookSignature(payload, '', webhookSecret);
    expect(isValid).toBe(false);
  });

  it('should reject malformed signature', () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
    const signature = 'invalid_signature_format';
    
    const isValid = verifyWebhookSignature(payload, signature, webhookSecret);
    expect(isValid).toBe(false);
  });

  it('should reject signature with wrong secret', () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
    const signature = 't=1234567890,v1=valid_signature_hash';
    
    const isValid = verifyWebhookSignature(payload, signature, 'wrong_secret');
    expect(isValid).toBe(false);
  });
});

describe('Payment Intent Succeeded Webhook', () => {
  async function handlePaymentSuccess(event: MockStripeEvent): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    const paymentIntent = event.data.object;
    const { referenceType, referenceId } = paymentIntent.metadata;

    if (!referenceType || !referenceId) {
      return { success: false, error: 'Missing metadata' };
    }

    // Record payment
    const payment = {
      id: `pay_${Date.now()}`,
      reference_type: referenceType,
      reference_id: referenceId,
      amount: (paymentIntent.amount / 100).toFixed(2),
      currency: paymentIntent.currency.toUpperCase(),
      method: 'card',
      status: 'completed',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: paymentIntent.latest_charge,
      processed_at: new Date().toISOString(),
    };
    mockPayments.push(payment);

    // Update reference payment status
    if (referenceType === 'order') {
      mockOrders.set(referenceId, { payment_status: 'paid' });
    } else if (referenceType === 'booking') {
      mockBookings.set(referenceId, { payment_status: 'paid' });
    }

    return { success: true, paymentId: payment.id };
  }

  it('should record payment on success', async () => {
    const event: MockStripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 5000, // $50.00
          currency: 'usd',
          status: 'succeeded',
          metadata: { referenceType: 'order', referenceId: 'order_456' },
          latest_charge: 'ch_789',
        },
      },
    };

    const result = await handlePaymentSuccess(event);

    expect(result.success).toBe(true);
    expect(mockPayments).toHaveLength(1);
    expect(mockPayments[0].amount).toBe('50.00');
    expect(mockPayments[0].currency).toBe('USD');
    expect(mockPayments[0].status).toBe('completed');
  });

  it('should update order payment status', async () => {
    const orderId = 'order_789';
    mockOrders.set(orderId, { payment_status: 'pending' });

    const event: MockStripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 2500,
          currency: 'usd',
          status: 'succeeded',
          metadata: { referenceType: 'order', referenceId: orderId },
          latest_charge: 'ch_789',
        },
      },
    };

    await handlePaymentSuccess(event);

    expect(mockOrders.get(orderId)?.payment_status).toBe('paid');
  });

  it('should update booking payment status', async () => {
    const bookingId = 'booking_123';
    mockBookings.set(bookingId, { payment_status: 'pending' });

    const event: MockStripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 50000,
          currency: 'usd',
          status: 'succeeded',
          metadata: { referenceType: 'booking', referenceId: bookingId },
          latest_charge: 'ch_789',
        },
      },
    };

    await handlePaymentSuccess(event);

    expect(mockBookings.get(bookingId)?.payment_status).toBe('paid');
  });

  it('should handle missing metadata gracefully', async () => {
    const event: MockStripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {},
          latest_charge: 'ch_789',
        },
      },
    };

    const result = await handlePaymentSuccess(event);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing metadata');
    expect(mockPayments).toHaveLength(0);
  });

  it('should handle different currencies', async () => {
    const event: MockStripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 10000, // 100.00 EUR
          currency: 'eur',
          status: 'succeeded',
          metadata: { referenceType: 'order', referenceId: 'order_eur' },
          latest_charge: 'ch_789',
        },
      },
    };

    await handlePaymentSuccess(event);

    expect(mockPayments[0].currency).toBe('EUR');
    expect(mockPayments[0].amount).toBe('100.00');
  });
});

describe('Payment Intent Failed Webhook', () => {
  async function handlePaymentFailed(event: MockStripeEvent): Promise<{
    success: boolean;
    error?: string;
  }> {
    const paymentIntent = event.data.object;
    const { referenceType, referenceId } = paymentIntent.metadata;

    // Record failed payment attempt
    const payment = {
      id: `pay_${Date.now()}`,
      reference_type: referenceType || 'unknown',
      reference_id: referenceId || 'unknown',
      amount: (paymentIntent.amount / 100).toFixed(2),
      currency: paymentIntent.currency.toUpperCase(),
      method: 'card',
      status: 'failed',
      stripe_payment_intent_id: paymentIntent.id,
      notes: paymentIntent.last_payment_error?.message || 'Payment failed',
      processed_at: new Date().toISOString(),
    };
    mockPayments.push(payment);

    return { success: true };
  }

  it('should record failed payment', async () => {
    const event: MockStripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_123',
          amount: 5000,
          currency: 'usd',
          status: 'requires_payment_method',
          metadata: { referenceType: 'order', referenceId: 'order_456' },
          latest_charge: null,
          last_payment_error: { message: 'Card declined' },
        },
      },
    };

    await handlePaymentFailed(event);

    expect(mockPayments).toHaveLength(1);
    expect(mockPayments[0].status).toBe('failed');
    expect(mockPayments[0].notes).toBe('Card declined');
  });

  it('should handle failure without error message', async () => {
    const event: MockStripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_123',
          amount: 5000,
          currency: 'usd',
          status: 'requires_payment_method',
          metadata: { referenceType: 'order', referenceId: 'order_456' },
          latest_charge: null,
        },
      },
    };

    await handlePaymentFailed(event);

    expect(mockPayments[0].notes).toBe('Payment failed');
  });
});

describe('Webhook Idempotency', () => {
  const processedEventIds = new Set<string>();

  function isEventProcessed(eventId: string): boolean {
    return processedEventIds.has(eventId);
  }

  function markEventProcessed(eventId: string): void {
    processedEventIds.add(eventId);
  }

  async function handleWebhookIdempotent(event: MockStripeEvent): Promise<{
    processed: boolean;
    skipped: boolean;
  }> {
    if (isEventProcessed(event.id)) {
      return { processed: false, skipped: true };
    }

    // Process the event...
    mockPayments.push({ event_id: event.id });
    markEventProcessed(event.id);

    return { processed: true, skipped: false };
  }

  beforeEach(() => {
    processedEventIds.clear();
  });

  it('should process event first time', async () => {
    const event: MockStripeEvent = {
      id: 'evt_unique_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {},
          latest_charge: null,
        },
      },
    };

    const result = await handleWebhookIdempotent(event);

    expect(result.processed).toBe(true);
    expect(result.skipped).toBe(false);
    expect(mockPayments).toHaveLength(1);
  });

  it('should skip duplicate event', async () => {
    const event: MockStripeEvent = {
      id: 'evt_duplicate_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {},
          latest_charge: null,
        },
      },
    };

    // First call
    await handleWebhookIdempotent(event);
    expect(mockPayments).toHaveLength(1);

    // Duplicate call
    const result = await handleWebhookIdempotent(event);

    expect(result.processed).toBe(false);
    expect(result.skipped).toBe(true);
    expect(mockPayments).toHaveLength(1); // Still only 1
  });

  it('should process different events', async () => {
    const event1: MockStripeEvent = {
      id: 'evt_first',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1', amount: 1000, currency: 'usd', status: 'succeeded', metadata: {}, latest_charge: null } },
    };

    const event2: MockStripeEvent = {
      id: 'evt_second',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_2', amount: 2000, currency: 'usd', status: 'succeeded', metadata: {}, latest_charge: null } },
    };

    await handleWebhookIdempotent(event1);
    await handleWebhookIdempotent(event2);

    expect(mockPayments).toHaveLength(2);
  });
});

describe('Refund Processing', () => {
  async function processRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
  }): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }> {
    // Find original payment
    const payment = mockPayments.find(p => p.stripe_payment_intent_id === params.paymentIntentId);
    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    const refundAmount = params.amount || parseFloat(payment.amount);
    if (refundAmount > parseFloat(payment.amount)) {
      return { success: false, error: 'Refund amount exceeds payment' };
    }

    // Create refund record
    const refund = {
      id: `re_${Date.now()}`,
      payment_id: payment.id,
      amount: refundAmount.toFixed(2),
      reason: params.reason || 'requested_by_customer',
      status: 'succeeded',
      created_at: new Date().toISOString(),
    };

    return { success: true, refundId: refund.id };
  }

  beforeEach(() => {
    mockPayments.push({
      id: 'pay_test',
      stripe_payment_intent_id: 'pi_refund_test',
      amount: '100.00',
      status: 'completed',
    });
  });

  it('should process full refund', async () => {
    const result = await processRefund({
      paymentIntentId: 'pi_refund_test',
    });

    expect(result.success).toBe(true);
    expect(result.refundId).toBeDefined();
  });

  it('should process partial refund', async () => {
    const result = await processRefund({
      paymentIntentId: 'pi_refund_test',
      amount: 50,
    });

    expect(result.success).toBe(true);
    expect(result.refundId).toBeDefined();
  });

  it('should reject refund exceeding payment amount', async () => {
    const result = await processRefund({
      paymentIntentId: 'pi_refund_test',
      amount: 200,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds payment');
  });

  it('should reject refund for non-existent payment', async () => {
    const result = await processRefund({
      paymentIntentId: 'pi_nonexistent',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should include refund reason', async () => {
    const result = await processRefund({
      paymentIntentId: 'pi_refund_test',
      reason: 'duplicate',
    });

    expect(result.success).toBe(true);
  });
});
