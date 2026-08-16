/**
 * e2e/helpers/stripe.ts
 *
 * Stripe webhook injection helpers.
 * Computes real Stripe HMAC-SHA256 signatures so the backend's
 * signature verification actually passes — no mocking.
 *
 * Usage:
 *   const res = await injectStripeWebhook(
 *     request,
 *     buildSubscriptionUpdatedEvent(stripeSubId, 'past_due'),
 *     process.env.STRIPE_WEBHOOK_SECRET!
 *   );
 *   expect(res.status()).toBe(200);
 */

import crypto from 'crypto';
import type { APIRequestContext } from '@playwright/test';

const WEBHOOK_URL = 'http://localhost:3005/api/webhooks/stripe/saas';

// ---------------------------------------------------------------------------
// Signature computation
// ---------------------------------------------------------------------------

export function computeStripeSignature(
  payload: string,
  timestamp: number,
  secret: string
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Webhook injection
// ---------------------------------------------------------------------------

export async function injectStripeWebhook(
  request: APIRequestContext,
  event: object,
  secret: string
) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = computeStripeSignature(payload, timestamp, secret);

  return request.post(WEBHOOK_URL, {
    data: payload,
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${sig}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Event builders
// ---------------------------------------------------------------------------

export function buildSubscriptionUpdatedEvent(
  subscriptionId: string,
  status: string,
  customerId = 'cus_test_placeholder'
): object {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: 'customer.subscription.updated',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ price: { id: 'price_test_placeholder', product: 'prod_test_placeholder' } }],
        },
      },
    },
  };
}

export function buildSubscriptionDeletedEvent(
  subscriptionId: string,
  customerId = 'cus_test_placeholder'
): object {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: 'customer.subscription.deleted',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000),
        items: { data: [] },
      },
    },
  };
}

export function buildCheckoutSessionCompletedEvent(
  sessionId: string,
  customerId: string,
  subscriptionId: string,
  metadata: Record<string, string> = {}
): object {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        customer: customerId,
        subscription: subscriptionId,
        payment_status: 'paid',
        status: 'complete',
        metadata,
      },
    },
  };
}
