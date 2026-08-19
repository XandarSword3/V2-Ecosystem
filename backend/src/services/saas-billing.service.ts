/**
 * SaasBillingService
 *
 * Wraps Stripe's Subscriptions API for platform-level billing (Engine E).
 * Kept intentionally separate from StripePlatformService (PaymentIntents) —
 * do not merge them; the two handle different Stripe object types.
 *
 * Responsibilities:
 *   - Create Stripe Customer + Subscription on checkout completion
 *   - Handle dunning webhooks (invoice.payment_failed, invoice.paid)
 *   - Handle cancellation webhook (customer.subscription.deleted)
 *   - Upgrade / downgrade subscription tier
 *   - Expose billing portal URL for operator self-service
 *
 * Environment variables expected:
 *   STRIPE_SECRET_KEY              — Stripe secret key (test or live)
 *   STRIPE_SAAS_WEBHOOK_SECRET     — webhook signing secret for /api/webhooks/stripe/saas
 *   STRIPE_PRICE_STARTER           — Stripe Price ID for Starter tier
 *   STRIPE_PRICE_GROWTH            — Stripe Price ID for Growth tier
 *   STRIPE_PRICE_ENTERPRISE        — Stripe Price ID for Enterprise tier
 *   FRONTEND_URL                   — base URL for redirect/return links
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger.js';
import { getSupabase } from '../database/connection.js';
import type { SubscriptionTier, BillingStatus } from '../middleware/tenantAccess.middleware.js';
import { buildTenantUrl } from '../utils/tenant-url.js';

// ============================================
// Stripe client (lazy singleton)
// ============================================

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');

    _stripe = new Stripe(key, {
      apiVersion: '2023-10-16',
      typescript: true,
      appInfo: { name: 'V2 Platform SaaS', version: '2.0.0' },
    });
  }
  return _stripe;
}

// ============================================
// Tier → Price ID mapping (DB-backed)
// ============================================

/**
 * Look up the Stripe monthly price ID for a given plan code from the
 * `plans` table. This is the canonical source of truth — price IDs
 * are set via the admin Plans CRUD UI, not env vars.
 *
 * Falls back to the legacy env var only if the DB row has no price ID
 * set yet (e.g. during initial setup before Stripe products are created).
 */
async function getPriceId(tier: SubscriptionTier): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('plans')
    .select('stripe_monthly_price_id, stripe_annual_price_id')
    .eq('code', tier)
    .eq('is_active', true)
    .single();

  if (!error && data?.stripe_monthly_price_id) {
    return data.stripe_monthly_price_id;
  }

  if (error) {
    logger.warn(`[SAAS BILLING] plans table lookup failed for tier '${tier}', falling back to env var`, { error: error.message });
  }

  // Fallback: legacy env var path (only used if DB row has no price ID yet)
  const envMap: Record<SubscriptionTier, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  const priceId = envMap[tier];
  if (!priceId) {
    throw new Error(
      `No Stripe Price ID found for tier '${tier}'. ` +
      `Set stripe_monthly_price_id on the '${tier}' row in the plans table via the admin UI.`,
    );
  }
  return priceId;
}

// ============================================
// Types
// ============================================

export interface CreateCheckoutSessionParams {
  tenantId: string;
  tier: SubscriptionTier;
  operatorEmail: string;
  operatorName: string;
  subdomain: string;
  /** Override trial period in days (defaults to SAAS_TRIAL_DAYS env or 14) */
  trialDays?: number;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface PortalSessionResult {
  url: string;
}

export interface SubscriptionTierUpdateResult {
  subscriptionId: string;
  previousTier: SubscriptionTier;
  newTier: SubscriptionTier;
  effectiveAt: Date;
}

// ============================================
// SaasBillingService
// ============================================

export class SaasBillingService {
  private readonly trialDays: number;
  private readonly frontendUrl: string;

  constructor() {
    // Do NOT call getStripe() here — it throws if STRIPE_SECRET_KEY is absent,
    // which would break getSaasBillingService() even for callers that never
    // touch Stripe (e.g. reading plans from the DB). Stripe is lazy-initialized
    // inside each method that actually needs it.
    this.trialDays = parseInt(process.env.SAAS_TRIAL_DAYS || '14', 10);
    this.frontendUrl = process.env.FRONTEND_URL || 'https://v2platform.com';
  }

  // ------------------------------------------
  // Checkout Session (new subscriber flow)
  // ------------------------------------------

  /**
   * Create a Stripe Checkout Session for a new operator signing up.
   * The session includes a trial period and embeds tenantId + subdomain in
   * metadata so the webhook can idempotently provision the tenant.
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { tenantId, tier, operatorEmail, operatorName, subdomain, trialDays } = params;
    const effectiveTrialDays = trialDays ?? this.trialDays;

    logger.info('[SAAS BILLING] Creating checkout session', { tenantId, tier, subdomain });

    // Reuse an existing Stripe customer for this email when one already exists.
    // A retried checkout (e.g. the first attempt's webhook provisioning failed
    // after the session completed) must not mint a brand-new Customer for the
    // same email — Stripe treats a Customer as a billing identity, so the
    // existing one is the correct target for the retry.
    const customer = await this.getOrCreateCustomer(operatorEmail, operatorName, {
      tenantId,
      subdomain,
      tier,
    });

    const session = await getStripe().checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: await getPriceId(tier),
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: effectiveTrialDays,
        metadata: {
          tenantId,
          subdomain,
          tier,
        },
      },
      metadata: {
        tenantId,
        subdomain,
        tier,
      },
      success_url: buildTenantUrl(subdomain, `/setup/success?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: buildTenantUrl(subdomain, '/pricing?cancelled=1'),
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    if (!session.url) {
      throw new Error('Stripe returned a checkout session without a URL');
    }

    logger.info('[SAAS BILLING] Checkout session created', {
      tenantId,
      sessionId: session.id,
      customerId: customer.id,
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Find an existing Stripe customer by email, or create one. This is the
   * dedupe that stops a retried checkout from creating a fresh Customer every
   * time; the controller's users-table check only catches emails that already
   * belong to a fully-provisioned tenant owner.
   */
  private async getOrCreateCustomer(
    email: string,
    name: string,
    metadata: Record<string, string>,
  ): Promise<Stripe.Customer> {
    const existing = await getStripe().customers.list({ email, limit: 1 });

    if (existing.data.length > 0) {
      const customer = existing.data[0];
      logger.info('[SAAS BILLING] Reusing existing Stripe customer', {
        customerId: customer.id,
        email,
      });
      return customer;
    }

    return getStripe().customers.create({ email, name, metadata });
  }

  // ------------------------------------------
  // Billing Portal (operator self-service)
  // ------------------------------------------

  /**
   * Create a Stripe Billing Portal session so the operator can update their
   * payment method, view invoices, or cancel their subscription.
   */
  async createPortalSession(stripeCustomerId: string, returnPath = '/admin/settings/billing'): Promise<PortalSessionResult> {
    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${this.frontendUrl}${returnPath}`,
    });

    return { url: session.url };
  }

  // ------------------------------------------
  // Tier change (upgrade / downgrade)
  // ------------------------------------------

  /**
   * Upgrade or downgrade a subscription to a different tier.
   * Uses proration: upgrade bills immediately, downgrade credits next cycle.
   */
  async changeTier(
    stripeSubscriptionId: string,
    previousTier: SubscriptionTier,
    newTier: SubscriptionTier,
  ): Promise<SubscriptionTierUpdateResult> {
    if (previousTier === newTier) {
      throw new Error(`Tenant is already on the '${newTier}' tier`);
    }

    const subscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
    const currentItem = subscription.items.data[0];

    if (!currentItem) {
      throw new Error(`Subscription ${stripeSubscriptionId} has no line items`);
    }

    const newPriceId = await getPriceId(newTier);

    const updated = await getStripe().subscriptions.update(stripeSubscriptionId, {
      items: [
        {
          id: currentItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: { tier: newTier },
    });

    logger.info('[SAAS BILLING] Tier changed', {
      subscriptionId: stripeSubscriptionId,
      previousTier,
      newTier,
    });

    return {
      subscriptionId: stripeSubscriptionId,
      previousTier,
      newTier,
      effectiveAt: new Date(updated.current_period_start * 1000),
    };
  }

  /**
   * Retrieve a subscription, returning null (instead of throwing) so webhook
   * handlers can skip gracefully when the subscription is already gone.
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      return await getStripe().subscriptions.retrieve(subscriptionId);
    } catch (err) {
      logger.error('[SAAS BILLING] Failed to retrieve subscription', { subscriptionId, err });
      return null;
    }
  }

  // ------------------------------------------
  // Cancel subscription
  // ------------------------------------------

  /**
   * Cancel a subscription at the end of the current billing period.
   * For immediate cancellation, pass { atPeriodEnd: false }.
   */
  async cancelSubscription(
    stripeSubscriptionId: string,
    options: { atPeriodEnd?: boolean } = {},
  ): Promise<void> {
    const { atPeriodEnd = true } = options;

    if (atPeriodEnd) {
      await getStripe().subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await getStripe().subscriptions.cancel(stripeSubscriptionId);
    }

    logger.info('[SAAS BILLING] Subscription cancellation scheduled', {
      stripeSubscriptionId,
      atPeriodEnd,
    });
  }

  // ------------------------------------------
  // Webhook signature verification
  // ------------------------------------------

  /**
   * Verify and parse an inbound Stripe webhook from the SaaS endpoint.
   * Returns the verified Event object, throws on signature mismatch.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_SAAS_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_SAAS_WEBHOOK_SECRET is not configured');
    }
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
  }

  // ------------------------------------------
  // Derive billing status from Stripe subscription
  // ------------------------------------------

  /**
   * Map a Stripe subscription status to the internal BillingStatus enum.
   * Called by the webhook handler to sync state.
   */
  static mapStripeToBillingStatus(stripeStatus: Stripe.Subscription.Status): BillingStatus {
    const map: Record<string, BillingStatus> = {
      trialing: 'trialing',
      active: 'active',
      past_due: 'past_due',
      unpaid: 'past_due',      // treat unpaid same as past_due (both need dunning)
      canceled: 'cancelled',
      incomplete: 'trialing',  // payment not yet confirmed — stay in trial-like state
      incomplete_expired: 'cancelled',
      paused: 'suspended',     // Stripe pause = our suspended
    };

    return map[stripeStatus] ?? 'suspended';
  }
}

// ============================================
// Singleton
// ============================================

let _saasBillingService: SaasBillingService | null = null;

export function getSaasBillingService(): SaasBillingService {
  if (!_saasBillingService) {
    _saasBillingService = new SaasBillingService();
  }
  return _saasBillingService;
}
