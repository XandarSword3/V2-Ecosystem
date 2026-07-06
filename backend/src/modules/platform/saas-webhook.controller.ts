/**
 * SaaS Stripe Webhook Handler
 *
 * Receives verified Stripe events from the SaaS billing endpoint
 * (POST /api/webhooks/stripe/saas) and dispatches to ProvisioningService.
 *
 * Handled events:
 *   checkout.session.completed          — new subscriber, provision tenant
 *   customer.subscription.updated       — tier change or status sync
 *   customer.subscription.deleted       — cancellation, mark tenant cancelled
 *   invoice.paid                        — activate / clear dunning
 *   invoice.payment_failed              — enter past_due state
 */

import { Request, Response } from 'express';
import { getSaasBillingService, SaasBillingService } from '../../services/saas-billing.service.js';
import { getProvisioningService } from './provisioning.service.js';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import type { SubscriptionTier } from '../../middleware/tenantAccess.middleware.js';
import Stripe from 'stripe';

// ============================================
// Webhook controller
// ============================================

export async function handleSaasStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;

  try {
    // req.body must be the raw Buffer — ensure express.raw() is used on this route
    const billing = getSaasBillingService();
    event = billing.constructWebhookEvent(req.body as Buffer, sig);
  } catch (err) {
    logger.warn('[SAAS WEBHOOK] Signature verification failed', { err });
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  // Acknowledge immediately — Stripe expects 2xx within 30 s
  res.status(200).json({ received: true });

  // Process asynchronously so we never block the response
  processWebhookEvent(event).catch((err) =>
    logger.error('[SAAS WEBHOOK] Unhandled processing error', { 
      eventId: event.id, 
      eventType: event.type, 
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err 
    }),
  );
}

async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  const provisioning = getProvisioningService();

  logger.info('[SAAS WEBHOOK] Processing event', { eventId: event.id, type: event.type });

  switch (event.type) {

    // ------------------------------------------
    // New subscriber completed checkout
    // ------------------------------------------
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== 'subscription') break; // ignore one-off checkouts

      const meta = session.metadata ?? {};
      const tenantId = meta.tenantId;
      const subdomain = meta.subdomain;
      const tier = (meta.tier ?? 'starter') as SubscriptionTier;

      if (!tenantId || !subdomain) {
        logger.error('[SAAS WEBHOOK] checkout.session.completed missing metadata', { sessionId: session.id });
        break;
      }

      // No platform-root check needed here. provision_tenant_on_activate's only
      // real danger is a tenant other than platform-root owning an Engine E
      // module and wiring its own checkout into this path — and that's already
      // fully blocked at the source by createModule()'s platform_entitlement
      // guard in modules.controller.ts (no other tenant can ever own such a
      // module). This endpoint (/api/platform/checkout) is the public, anonymous
      // landing-page signup — there is no "calling tenant" to check at all; the
      // tenantId in metadata is a freshly-generated UUID for the prospective
      // tenant that doesn't exist yet, not an identity to authorise against.
      // A previous version of this guard compared that UUID to the platform-root
      // tenant and therefore rejected every real signup, silently, always.

      const subscription = await resolveSubscription(session.subscription as string);
      if (!subscription) break;

      const provisionResult = await provisioning.provision({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        tier,
        billingStatus: SaasBillingService.mapStripeToBillingStatus(subscription.status),
        operatorEmail: session.customer_details?.email ?? '',
        operatorName: session.customer_details?.name ?? '',
        subdomain,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      });

      await recordBillingHistory({
        tenantId: provisionResult.tenantId,
        eventType: 'subscription_created',
        amount: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        status: 'created',
        stripeEventId: event.id,
      });
      break;
    }

    // ------------------------------------------
    // Subscription status changed (tier upgrade/downgrade, status sync)
    // ------------------------------------------
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const newStatus = SaasBillingService.mapStripeToBillingStatus(sub.status);
      const tier = (sub.metadata?.tier ?? undefined) as SubscriptionTier | undefined;

      await provisioning.updateBillingStatus(sub.id, newStatus, tier);
      break;
    }

    // ------------------------------------------
    // Subscription cancelled
    // ------------------------------------------
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await provisioning.updateBillingStatus(sub.id, 'cancelled');

      const cancelledTenantId = await resolveTenantIdBySubscription(sub.id);
      if (cancelledTenantId) {
        await recordBillingHistory({
          tenantId: cancelledTenantId,
          eventType: 'subscription_cancelled',
          amount: 0,
          currency: 'usd',
          status: 'cancelled',
          stripeEventId: event.id,
        });
      }
      break;
    }

    // ------------------------------------------
    // Invoice paid — activate or clear dunning
    // ------------------------------------------
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | null;
      if (!subscriptionId) break;

      const subscription = await resolveSubscription(subscriptionId);
      if (!subscription) break;

      const newStatus = SaasBillingService.mapStripeToBillingStatus(subscription.status);
      await provisioning.updateBillingStatus(subscriptionId, newStatus);

      const paidTenantId = await resolveTenantIdBySubscription(subscriptionId);
      if (paidTenantId) {
        await recordBillingHistory({
          tenantId: paidTenantId,
          eventType: 'invoice_paid',
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'paid',
          stripeEventId: event.id,
          stripeInvoiceId: invoice.id,
        });
      }
      break;
    }

    // ------------------------------------------
    // Invoice payment failed — enter past_due
    // ------------------------------------------
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | null;
      if (!subscriptionId) break;

      await provisioning.updateBillingStatus(subscriptionId, 'past_due');

      const failedTenantId = await resolveTenantIdBySubscription(subscriptionId);
      if (failedTenantId) {
        await recordBillingHistory({
          tenantId: failedTenantId,
          eventType: 'invoice_payment_failed',
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: 'failed',
          stripeEventId: event.id,
          stripeInvoiceId: invoice.id,
        });
      }
      break;
    }

    default:
      logger.debug('[SAAS WEBHOOK] Unhandled event type (safe to ignore)', { type: event.type });
  }
}

// ------------------------------------------
// Helpers
// ------------------------------------------

/**
 * Look up which tenant a Stripe subscription belongs to.
 * Used to attribute billing_history rows — invoice/subscription webhook
 * payloads only carry the Stripe subscription ID, not our tenant UUID.
 */
async function resolveTenantIdBySubscription(subscriptionId: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();

    if (error) {
      logger.error('[SAAS WEBHOOK] Failed to resolve tenant for billing_history', { subscriptionId, error: error.message });
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    logger.error('[SAAS WEBHOOK] Unexpected error resolving tenant for billing_history', { subscriptionId, err });
    return null;
  }
}

/**
 * Append a row to billing_history. Best-effort — a failed write here must
 * never break the underlying billing-status update it accompanies, so all
 * errors are logged and swallowed.
 */
async function recordBillingHistory(entry: {
  tenantId: string;
  eventType: string;
  amount: number;
  currency: string;
  status: string;
  stripeEventId?: string;
  stripeInvoiceId?: string | null;
}): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('billing_history').insert({
      tenant_id: entry.tenantId,
      event_type: entry.eventType,
      amount: entry.amount,
      currency: entry.currency,
      status: entry.status,
      stripe_event_id: entry.stripeEventId ?? null,
      stripe_invoice_id: entry.stripeInvoiceId ?? null,
    });

    if (error) {
      // Duplicate stripe_event_id on retry is expected and harmless —
      // the unique index is there specifically to make retries idempotent.
      if (error.code !== '23505') {
        logger.error('[SAAS WEBHOOK] Failed to write billing_history row', { entry, error: error.message });
      }
    }
  } catch (err) {
    logger.error('[SAAS WEBHOOK] Unexpected error writing billing_history row', { entry, err });
  }
}

async function resolveSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    const billing = getSaasBillingService();
    // Access the underlying stripe instance via the service's checkout method approach
    // We use a direct Stripe import here to retrieve the subscription
    const Stripe = (await import('stripe')).default;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');

    const stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    logger.error('[SAAS WEBHOOK] Failed to retrieve subscription', { subscriptionId, err });
    return null;
  }
}
