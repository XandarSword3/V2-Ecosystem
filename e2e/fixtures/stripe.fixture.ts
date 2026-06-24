/**
 * e2e/fixtures/stripe.fixture.ts
 *
 * Re-exports stripe helpers with Playwright fixture ergonomics.
 * Used by billing lifecycle specs that inject webhooks directly
 * rather than going through the Stripe-hosted checkout UI.
 *
 * The underlying logic lives in helpers/stripe.ts.
 * This file exists so specs can import from a single fixtures/ path.
 */

export {
  injectStripeWebhook,
  buildSubscriptionUpdatedEvent,
  buildSubscriptionDeletedEvent,
  buildCheckoutSessionCompletedEvent,
  computeStripeSignature,
} from '../helpers/stripe';

/**
 * Convenience: inject a webhook and assert the backend accepted it (200).
 * Use when you want to fire-and-forget without inspecting the response.
 */
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { injectStripeWebhook } from '../helpers/stripe';

export async function injectAndExpectAccepted(
  request: APIRequestContext,
  event: object
): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      '[stripe] STRIPE_WEBHOOK_SECRET is not set in e2e/.env.test.\n' +
      'Required for webhook injection tests.'
    );
  }
  const res = await injectStripeWebhook(request, event, secret);
  expect(
    res.status(),
    `Stripe webhook injection got HTTP ${res.status()} — backend rejected it`
  ).toBe(200);
}
