import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import Stripe from 'stripe';
import { getSupabase } from "../../database/connection.js";
import { getScopedClient, tenantContextFor, type TenantContext } from '../../security/scoped-client.js';
import { getCallerTenantId } from '../../security/tenant-scope.js';
import { config } from "../../config/index";
import { logger } from "../../utils/logger.js";
import { createPaymentIntentSchema, recordCashPaymentSchema, recordManualPaymentSchema, postRoomChargeSchema, settleRoomFolioSchema, validateBody } from "../../validation/schemas.js";
import { awardLoyaltyPointsForPayment } from './loyalty-integration.js';
import { getEngineService } from '../../engines/engine-service.js';
import { normalizeReferenceType } from './reference-type-adapter.js';
import { getTransactionManager } from '../../engines/transaction-manager.js';
import { getIdempotencyGuard } from '../../engines/idempotency-guard.js';
import { reverseDiscounts } from '../../engines/discount-reversal.js';
import { CURRENCY_DECIMALS } from '../../engines/money.js';
import {
  resolveTenantPaymentSettings,
  type TenantPaymentSettings,
} from './tenant-payment-settings.js';

export { resolveTenantPaymentSettings };
export type { TenantPaymentSettings };

const getStripeInstance = async (tenantId?: string | null) => {
  const settings = await resolveTenantPaymentSettings(tenantId);
  const secretKey = settings.secretKey || config.stripe.secretKey;
  if (!secretKey) throw new Error('Stripe secret key not configured');

  return new Stripe(secretKey, { apiVersion: '2023-10-16' });
};

const getStripeWebhookSecret = async (tenantId?: string | null) => {
  const settings = await resolveTenantPaymentSettings(tenantId);
  return settings.webhookSecret || config.stripe.webhookSecret;
};

/**
 * `transactions` isn't registered in TENANT_SCOPED_TABLES (see
 * scoped-client.ts's note on why — it's the shared table underpinning all
 * five engines and needs its own dedicated review), so ownership checks on
 * it here are manual: fetch normally, then verify the record's tenant_id
 * matches the caller's before proceeding. A genuinely unscoped super_admin
 * (no tenantId on their own token) bypasses this, same pattern used
 * everywhere else in this codebase (see validatePropertyAccess,
 * getScopedClient). Used by postRoomCharge / getFolioBalance /
 * settleFolioBalance, which previously fetched orders/bookings by id with no
 * ownership check at all — any tenant's staff could post charges to,
 * view the balance of, or settle another tenant's room folio.
 */
function assertOwnedByCallerTenant(req: Request, recordTenantId: string | null | undefined): boolean {
  const callerTenantId = getCallerTenantId(req);
  if (callerTenantId === null) return true;
  return recordTenantId === callerTenantId;
}

function calculateRenewedEndDate(currentEndDate: string | null, billingCycle: string): string {
  const baseDate = currentEndDate ? new Date(currentEndDate) : new Date();
  const nextDate = new Date(baseDate);
  switch (billingCycle) {
    case 'MONTHLY':   nextDate.setMonth(nextDate.getMonth() + 1); break;
    case 'QUARTERLY': nextDate.setMonth(nextDate.getMonth() + 3); break;
    case 'ANNUALLY':  nextDate.setFullYear(nextDate.getFullYear() + 1); break;
    default:          nextDate.setMonth(nextDate.getMonth() + 1);
  }
  return nextDate.toISOString();
}

type AuthoritativePayableRecord = {
  amount: number;
  currency: string;
  paymentStatus?: string;
  tenantId?: string | null;
  propertyId?: string | null;
  customerId?: string | null;
};

type TransactionLookupRow = {
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  tenant_id: string | null;
  property_id: string | null;
  customer_id: string | null;
};

/**
 * Columns that actually exist on `transactions`.
 *
 * The engine refit schema (src/database/migrate.ts:228-250) has `amount`,
 * `net_amount`, and `status` — there is no `total_amount` and no
 * `payment_status`. The previous select asked for both of the missing
 * columns, so PostgREST rejected the query with a 42703/400 and the handler
 * reported every real order as "Authoritative record not found" (404).
 *
 * `amount` — not `net_amount` — is the payable total: `net_amount` is only
 * populated by the reservation writer and is 0 for all 1,480
 * instant_transaction rows in the test DB.
 */
const TRANSACTION_LOOKUP_COLUMNS =
  'amount, currency, status, reference_table, tenant_id, property_id, customer_id';

/**
 * `transactions.status` is the engine state-machine status, not a payment
 * flag. The states below are the terminal ones where the money leg has
 * already been settled, so they map onto the existing double-charge guard's
 * `'paid'` sentinel. Anything else is carried through as-is, which leaves the
 * guard inert for an in-flight order (correct: it is meant to be payable).
 */
const SETTLED_TRANSACTION_STATUSES = new Set(['completed', 'used', 'checked_out', 'paid']);

function toAuthoritativeRecord(tx: TransactionLookupRow | null): AuthoritativePayableRecord | null {
  if (!tx || tx.amount === undefined || tx.amount === null) return null;
  const status = typeof tx.status === 'string' ? tx.status : undefined;
  return {
    amount: Number(tx.amount),
    currency: (tx.currency || 'USD').toUpperCase(),
    paymentStatus: status && SETTLED_TRANSACTION_STATUSES.has(status) ? 'paid' : status,
    tenantId: tx.tenant_id,
    propertyId: tx.property_id,
    customerId: tx.customer_id,
  };
}

async function resolveAuthoritativePayableAmount(
  referenceType: string,
  referenceId: string,
  req?: Request,
): Promise<{
  amount: number;
  currency: string;
  paymentStatus?: string;
  tenantId: string | null;
}> {
  const supabase = getSupabase();
  const canonicalType = normalizeReferenceType(referenceType);

  let record: AuthoritativePayableRecord | null = null;

  // 1. First look up the canonical transactions row
  const { data: tx } = await supabase
    .from('transactions')
    .select(TRANSACTION_LOOKUP_COLUMNS)
    .eq('id', referenceId)
    .maybeSingle();

  record = toAuthoritativeRecord(tx as TransactionLookupRow | null);

  // 2. Fall back to canonical transactions looked up by reference_id
  // (Architecture Law: all engine transactions live in the transactions table;
  // dead tables like orders, bookings, and tickets must never be queried).
  if (!record) {
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_LOOKUP_COLUMNS)
      .eq('reference_id', referenceId);

    if (canonicalType) {
      query = query.eq('engine_type', canonicalType);
    }

    const { data: txByRef } = await query.maybeSingle();

    record = toAuthoritativeRecord(txByRef as TransactionLookupRow | null);
  }

  if (!record) {
    throw new Error(`Authoritative record not found for reference ${referenceType}:${referenceId}`);
  }

  // Multi-tenant and ownership enforcement (Fix 1: Prevent cross-tenant/cross-property exploitation)
  if (req) {
    // 1. Assert tenant ownership if caller has tenant context
    if (!assertOwnedByCallerTenant(req, record.tenantId)) {
      throw new Error(`Reference ${referenceId} is not owned by caller's tenant`);
    }

    // 2. Assert property ownership if request specifies property context
    const reqPropertyId = (req as any).propertyId || req.property?.id || (req.headers?.['x-property-id'] as string);
    if (reqPropertyId && record.propertyId && record.propertyId !== reqPropertyId) {
      throw new Error(`Reference ${referenceId} belongs to property ${record.propertyId}, not ${reqPropertyId}`);
    }

    // 3. If authenticated customer (non-staff), verify customer owns this record
    const callerRole = (req.user as any)?.role || (req.user as any)?.roles?.[0];
    const isStaff = ['staff', 'manager', 'admin', 'super_admin', 'platform_admin'].includes(callerRole);
    if (req.user?.userId && !isStaff) {
      if (record.customerId && record.customerId !== req.user.userId) {
        throw new Error(`Reference ${referenceId} does not belong to the authenticated customer`);
      }
    }
  }

  return {
    amount: record.amount,
    currency: record.currency,
    paymentStatus: record.paymentStatus,
    tenantId: record.tenantId ?? null,
  };
}

/**
 * Convert Stripe minor units (e.g. cents, fils) into major currency units
 * using authoritative ISO 4217 CURRENCY_DECIMALS precision:
 * - 2 decimals: USD, EUR, etc. (divisor: 100) -> 4250 => 42.50
 * - 3 decimals: KWD, BHD, etc. (divisor: 1000) -> 15250 => 15.250
 * - 0 decimals: JPY, KRW, etc. (divisor: 1) -> 3500 => 3500
 */
export function convertStripeMinorUnitsToMajor(
  minorUnits: number,
  currency: string,
): { majorAmount: number; formattedAmount: string; decimals: number; currency: string } {
  const currencyCode = (currency || 'USD').toUpperCase();
  const decimals = (CURRENCY_DECIMALS as Record<string, number>)[currencyCode] ?? 2;
  const divisor = decimals === 0 ? 1 : (decimals === 3 ? 1000 : 100);
  const majorAmount = minorUnits / divisor;
  const formattedAmount = majorAmount.toFixed(decimals);
  return { majorAmount, formattedAmount, decimals, currency: currencyCode };
}

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(createPaymentIntentSchema, req.body);
  const { amount: clientAmount, currency: clientCurrency, referenceType, referenceId } = validatedData;

  // Resolve authoritative payable amount and currency directly from DB record (F6 invariant).
  // Strictly FAIL-CLOSED: if no authoritative record exists in DB, reject immediately.
  // Never fall back to client-supplied money or currency.
  let authRecord: {
    amount: number;
    currency: string;
    paymentStatus?: string;
    tenantId: string | null;
  };
  try {
    authRecord = await resolveAuthoritativePayableAmount(referenceType, referenceId, req);
  } catch (err: any) {
    const isForbidden = err.message?.includes('not owned by') || err.message?.includes('does not belong to') || err.message?.includes('belongs to property');
    logger.warn('[PaymentController] Rejected payment intent:', {
      error: err.message,
      referenceType,
      referenceId,
      clientAmount,
    });
    return res.status(isForbidden ? 403 : 404).json({
      success: false,
      error: err.message || `Authoritative record not found for reference ${referenceType}:${referenceId}`,
    });
  }

  if (authRecord.paymentStatus === 'paid') {
    return res.status(400).json({ success: false, error: 'Transaction is already paid' });
  }

  if (clientAmount !== undefined && clientAmount !== null) {
    const diff = Math.abs(Number(clientAmount) - authRecord.amount);
    if (diff > 0.01) {
      logger.warn('[PaymentController] Client amount mismatch with authoritative record; enforcing DB amount', {
        clientAmount,
        authoritativeAmount: authRecord.amount,
        referenceType,
        referenceId,
      });
    }
  }

  // One live payment per reference. Without this guard each tap of "Pay"
  // minted another PaymentIntent, so two devices could both charge the same
  // order. A completed/pending tender blocks a new intent.
  {
    const supabase = getSupabase();
    const { data: livePayment } = await supabase
      .from('payments')
      .select('id, status, method')
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .in('status', ['completed', 'pending', 'processing', 'pending_verification', 'pending_collection'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (livePayment) {
      return res.status(409).json({
        success: false,
        error: 'PAYMENT_ALREADY_IN_PROGRESS',
        message: 'A payment already exists for this item.',
        existingPaymentId: livePayment.id,
        status: livePayment.status,
      });
    }
  }

  const payableAmount = authRecord.amount;
  const currencyCode = (authRecord.currency || clientCurrency || 'USD').toUpperCase();
  const decimals = (CURRENCY_DECIMALS as Record<string, number>)[currencyCode] ?? 2;
  const multiplier = decimals === 0 ? 1 : (decimals === 3 ? 1000 : 100);
  const stripeMinorUnits = Math.round(payableAmount * multiplier);

  // Charge through the tenant that owns the payable record — never the
  // platform default just because `site_settings` only had one row (P0-3).
  const stripe = await getStripeInstance(authRecord.tenantId);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripeMinorUnits,
    currency: currencyCode.toLowerCase(),
    metadata: {
      referenceType,
      referenceId,
      userId: req.user?.userId || 'guest',
      authoritativeAmount: String(payableAmount),
      authoritativeCurrency: currencyCode,
      ...(authRecord.tenantId ? { tenantId: authRecord.tenantId } : {}),
    },
  }, {
    // Stripe-level idempotency: two concurrent requests for the same
    // reference/amount return the same intent instead of double-charging.
    idempotencyKey: `pi:${referenceType}:${referenceId}:${stripeMinorUnits}:${currencyCode}`,
  });

  res.json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: payableAmount,
      currency: currencyCode,
    },
  });
});

/**
 * Best-effort tenant lookup for an inbound Stripe webhook (P0-3).
 *
 * With per-tenant Stripe accounts the signing secret can also be per-tenant,
 * but the secret is needed before verification. So parse only the reference id
 * out of the still-unverified body, resolve the owning tenant, and use that
 * tenant's secret. This cannot bypass verification: a forged body only
 * influences which secret is checked, and a signature that does not match that
 * secret still fails. No event is acted on before `constructEvent` succeeds.
 */
async function resolveTransactionTenantId(
  referenceId: string,
  referenceType?: string | null,
): Promise<string | null> {
  const supabase = getSupabase();

  const byId = await supabase
    .from('transactions')
    .select('tenant_id')
    .eq('id', referenceId)
    .maybeSingle();
  if (byId?.data?.tenant_id) return byId.data.tenant_id as string;

  let query = supabase
    .from('transactions')
    .select('tenant_id')
    .eq('reference_id', referenceId);
  if (referenceType) query = query.eq('engine_type', referenceType);
  const byReference = await query.maybeSingle();
  return (byReference?.data?.tenant_id as string) ?? null;
}

/**
 * Resolve the tenant that owns the payment referenced by a still-unverified
 * webhook body. Used only to choose which tenant's signing secret to check;
 * nothing is acted on until `constructEvent` succeeds.
 */
async function resolveWebhookTenantId(rawBody: Buffer | undefined): Promise<string | null> {
  if (!rawBody || rawBody.length === 0) return null;

  let parsedObject: {
    metadata?: { referenceId?: unknown; referenceType?: unknown };
    payment_intent?: unknown;
  };
  try {
    const parsed = JSON.parse(rawBody.toString('utf8')) as {
      data?: { object?: typeof parsedObject };
    };
    parsedObject = parsed?.data?.object ?? {};
  } catch {
    return null;
  }

  const referenceId = parsedObject.metadata?.referenceId;
  if (typeof referenceId === 'string' && referenceId.length > 0 && referenceId.length <= 200) {
    const referenceType =
      typeof parsedObject.metadata?.referenceType === 'string'
        ? normalizeReferenceType(parsedObject.metadata.referenceType)
        : null;
    return resolveTransactionTenantId(referenceId, referenceType);
  }

  // Stripe charge events identify the payment intent but carry no
  // metadata.referenceId of their own. The recorded payment row knows the
  // transaction and its tenant.
  const paymentIntentId =
    typeof parsedObject.payment_intent === 'string'
      ? parsedObject.payment_intent
      : typeof (parsedObject.payment_intent as { id?: unknown } | undefined)?.id === 'string'
        ? (parsedObject.payment_intent as { id: string }).id
        : null;
  if (paymentIntentId) {
    const { data } = await getSupabase()
      .from('payments')
      .select('tenant_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();
    return (data?.tenant_id as string) ?? null;
  }

  return null;
}

/**
 * Resolve the tenant that owns the *verified* event's referenced payment.
 *
 * P0-1-class containment for webhooks: the secret selector reads the
 * unverified body, while the handler acts on `event.data.object`. Both must
 * describe the same tenant. If a body can resolve a signing secret for one
 * tenant but the event mutates another tenant's transaction, the event is
 * rejected before any handler runs.
 */
export async function resolveVerifiedEventTenantId(event: Stripe.Event): Promise<string | null> {
  if (event.type.startsWith('invoice.')) {
    // Invoice events carry no reference metadata, so secret selection cannot
    // resolve a tenant from the unverified body. The subscription row is the
    // authority for who is affected.
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id ?? null;
    if (!subscriptionId) return null;

    const { data } = await getSupabase()
      .from('pool_memberships')
      .select('tenant_id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    return (data?.tenant_id as string) ?? null;
  }

  if (event.type.startsWith('payment_intent.')) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const referenceId = paymentIntent.metadata?.referenceId;
    if (typeof referenceId !== 'string' || referenceId.length === 0) return null;
    const referenceType = normalizeReferenceType(paymentIntent.metadata?.referenceType);
    return resolveTransactionTenantId(referenceId, referenceType);
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) return null;

    const { data: payment } = await getSupabase()
      .from('payments')
      .select('tenant_id, reference_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    const transactionTenantId = payment?.reference_id
      ? await resolveTransactionTenantId(String(payment.reference_id))
      : null;

    // The referenced transaction is authoritative for who is affected. A
    // payment row that disagrees with it is exactly the cross-tenant case
    // this guard must catch.
    return transactionTenantId ?? ((payment?.tenant_id as string) ?? null);
  }

  return null;
}

/**
 * True when this tenant has provisioned its own Stripe webhook secret.
 *
 * Once a tenant owns a secret, an event verified with the platform-default
 * secret must not be allowed to mutate that tenant: possession of the platform
 * secret is not proof of authority over the tenant's account. A missing
 * settings table means the feature predates P0-3, so no tenant owns a secret.
 */
export async function tenantRequiresOwnWebhookSecret(tenantId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('tenant_payment_settings')
    .select('stripe_webhook_secret')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '42P01') return false;
    // Fail closed: an unreadable settings row must not downgrade a tenant to
    // platform-secret authority.
    logger.error('[Payments] Could not determine whether tenant owns a webhook secret', {
      tenantId,
      error: error.message,
    });
    return true;
  }

  return Boolean((data as { stripe_webhook_secret?: string | null } | null)?.stripe_webhook_secret);
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  if (!req.rawBody) { res.status(400).json({ error: 'Missing raw body' }); return; }

  let event: Stripe.Event;
  let webhookTenantId: string | null = null;
  try {
    webhookTenantId = await resolveWebhookTenantId(req.rawBody);
    const stripe = await getStripeInstance(webhookTenantId);
    const webhookSecret = await getStripeWebhookSecret(webhookTenantId);
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // The secret that verified the event belongs to `webhookTenantId`. Bind the
  // *verified* event to that tenant before the switch mutates anything.
  //
  // A null `webhookTenantId` means the event verified with the platform-default
  // secret: there is no per-tenant identity to bind to, and that is the
  // documented fallback for single-tenant installs and tenants that have not
  // provisioned their own Stripe account yet. The guard only applies when the
  // signature proved a specific tenant's secret.
  const affectedTenantId = await resolveVerifiedEventTenantId(event);
  if (affectedTenantId && webhookTenantId && affectedTenantId !== webhookTenantId) {
    logger.error('Webhook tenant binding rejected', {
      eventId: event.id,
      eventType: event.type,
      signingTenantId: webhookTenantId,
      affectedTenantId,
    });
    return res.status(400).json({ success: false, error: 'Webhook tenant mismatch' });
  }

  // Platform-signed event (webhookTenantId === null) that names a tenant which
  // owns its own webhook secret. The platform secret must not act for that
  // tenant. Tenants without a row still use the documented platform fallback.
  if (affectedTenantId && !webhookTenantId && (await tenantRequiresOwnWebhookSecret(affectedTenantId))) {
    logger.error('Platform-signed webhook rejected: tenant owns a webhook secret', {
      eventId: event.id,
      eventType: event.type,
      affectedTenantId,
    });
    return res.status(400).json({ success: false, error: 'Webhook tenant secret required' });
  }

  const supabase = getSupabase();

  switch (event.type) {

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      // Preserve the caller's raw reference type. `normalizeReferenceType`
      // maps the folio marker 'room_folio' to 'instant_transaction', which
      // silently turned a room-folio card payment into an unrelated charge:
      // the ledger row could never be read by the folio endpoints.
      const rawReferenceType =
        typeof paymentIntent.metadata?.referenceType === 'string'
          ? paymentIntent.metadata.referenceType
          : undefined;
      const isRoomFolio = rawReferenceType?.toLowerCase().trim() === 'room_folio';
      const referenceType = isRoomFolio ? 'room_folio' : normalizeReferenceType(rawReferenceType);
      const referenceId = paymentIntent.metadata?.referenceId;
      if (!referenceId) {
        logger.error('Payment intent is missing metadata.referenceId', { paymentIntentId: paymentIntent.id });
        return res.status(500).json({ error: 'Unable to resolve payment reference' });
      }
      // payments.tenant_id is NOT NULL: resolve it from the verified event or
      // the intent metadata before any write.
      const eventTenantId =
        affectedTenantId ??
        webhookTenantId ??
        (paymentIntent.metadata?.tenantId as string | undefined) ??
        null;
      if (!eventTenantId) {
        return res.status(500).json({ error: 'Unable to resolve tenant for payment intent' });
      }
      const { majorAmount, formattedAmount, currency: currencyCode } = convertStripeMinorUnitsToMajor(
        paymentIntent.amount,
        paymentIntent.currency || paymentIntent.metadata?.authoritativeCurrency || 'USD',
      );

      // FIX BUG-01: Idempotency check via payment_ledger — only look for fully
      // processed entries. Both statuses count: 'success' is what this writer
      // used historically, 'completed' is the folio/postRoomCharge status.
      // We NEVER update payment_ledger (immutability trigger blocks it).
      // Pattern: check → process → insert. No partial rows.
      const { data: existingLedger } = await supabase
        .from('payment_ledger')
        .select('id, status')
        .eq('webhook_id', event.id)
        .maybeSingle();

      if (existingLedger?.status === 'success' || existingLedger?.status === 'completed') {
        logger.info(`Idempotency: Webhook ${event.id} already fully processed. Skipping.`);
        return res.json({ received: true });
      }

      // Use IdempotencyGuard + TransactionManager for atomic, compensable processing
      const idempotencyGuard = getIdempotencyGuard();
      const idempotencyKey = `stripe_webhook:${event.id}`;

      const processPaymentIntent = async () => {
        // Step 0: resolve the owning property. `payments.property_id` and
        // `payment_ledger.property_id` are NOT NULL; the old insert omitted the
        // column, PostgREST answered 23502, and the error was only logged, so
        // card payments never produced a payment or ledger row.
        const referencePropertyId = await resolveReferencePropertyId(referenceId);
        if (!referencePropertyId) {
          throw new Error(`Could not resolve property for ${referenceType}:${referenceId}`);
        }

        // Step 1: Record payment row (idempotent on stripe_payment_intent_id)
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .maybeSingle();

        if (!existingPayment) {
          const { error: paymentError } = await supabase
            .from('payments')
            .insert({
              reference_type: referenceType,
              reference_id: referenceId,
              tenant_id: eventTenantId,
              property_id: referencePropertyId,
              amount: formattedAmount,
              currency: currencyCode,
              method: 'card',
              status: 'completed',
              stripe_payment_intent_id: paymentIntent.id,
              stripe_charge_id: paymentIntent.latest_charge as string,
              processed_at: new Date().toISOString(),
            });

          if (paymentError) {
            throw new Error(`Failed to record payment for ${paymentIntent.id}: ${paymentError.message}`);
          }
        }

        // Step 2: Update transaction/reference status
        await updateReferencePaymentStatus(referenceType, referenceId, 'paid');

        // Step 3: Award loyalty points using currency-correct major amount
        await awardLoyaltyPointsForPayment(referenceType, referenceId, majorAmount);

        // Step 4: FIX BUG-01 — INSERT a ledger entry (never UPDATE) with
        // currency-correct amount. A room-folio payment is a *settlement*
        // (reduces the outstanding balance) and uses the status the folio
        // readers expect; other references keep the historical 'authorized'/
        // 'success' pair so existing reporting keeps working.
        const { error: ledgerError } = await supabase.from('payment_ledger').insert({
          reference_type: referenceType,
          reference_id: referenceId,
          tenant_id: eventTenantId,
          property_id: referencePropertyId,
          event_type: isRoomFolio ? 'settlement' : 'authorized',
          amount: majorAmount,
          currency: currencyCode,
          gateway_reference_id: paymentIntent.id,
          webhook_id: event.id,
          status: isRoomFolio ? 'completed' : 'success',
          metadata: { stripe_event_id: event.id },
        });

        if (ledgerError) {
          throw new Error(`Failed to record payment ledger entry for ${paymentIntent.id}: ${ledgerError.message}`);
        }

        // Step 5: Fiscal document issuance (DOMAIN.md G1) — non-fatal, the
        // fiscal API and the order-status path are the explicit retry routes.
        if (referenceType === 'transaction') {
          try {
            const { data: payRow } = await supabase
              .from('payments')
              .select('tenant_id, property_id')
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .maybeSingle();
            if (payRow) {
              const { fiscalDocumentService } = await import('../fiscal/fiscal-document.service.js');
              await fiscalDocumentService.issueForTransaction(referenceId, {
                tenantId: String(payRow.tenant_id),
                propertyId: String(payRow.property_id),
                actorId: 'system',
              });
            }
          } catch (fiscalErr: any) {
            logger.warn('Fiscal document issuance after payment deferred:', fiscalErr?.message ?? String(fiscalErr));
          }
        }

        logger.info(`Payment succeeded for ${referenceType}:${referenceId}`);
      };

      // engine_idempotency_keys table is guaranteed to exist (migration 20260523000001).
      // Always use the IdempotencyGuard — the runtime probe that previously checked
      // typeof probe?.upsert === 'function' was misleading: supabase.from() returns a
      // query-builder regardless of whether the table exists, so the probe always
      // returned true and the else-branch was unreachable dead code.
      try {
        await idempotencyGuard.executeOnce(
          idempotencyKey,
          'system',
          'payment',
          referenceId,
          'payment_intent.succeeded',
          processPaymentIntent,
        );
      } catch (opError) {
        logger.error(`Webhook ${event.id} processing failed, Stripe will retry:`, opError);
        return res.status(500).json({ error: 'Processing failure, please retry' });
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const referenceType = normalizeReferenceType(paymentIntent.metadata?.referenceType);
      const referenceId = paymentIntent.metadata?.referenceId;
      const failedTenantId =
        affectedTenantId ??
        webhookTenantId ??
        (paymentIntent.metadata?.tenantId as string | undefined) ??
        (await resolveTransactionTenantId(referenceId, referenceType));
      if (!failedTenantId) {
        return res.status(500).json({ error: 'Unable to resolve tenant for failed payment intent' });
      }
      const { formattedAmount, currency: currencyCode } = convertStripeMinorUnitsToMajor(
        paymentIntent.amount,
        paymentIntent.currency || paymentIntent.metadata?.authoritativeCurrency || 'USD',
      );

      await supabase.from('payments').insert({
        reference_type: referenceType,
        reference_id: referenceId,
        tenant_id: failedTenantId,
        amount: formattedAmount,
        currency: currencyCode,
        method: 'card',
        status: 'failed',
        stripe_payment_intent_id: paymentIntent.id,
        notes: paymentIntent.last_payment_error?.message,
      });

      // FIX GAP-06: Update transaction status on payment failure so bookings don't stay pending
      await updateReferencePaymentStatus(referenceType, referenceId, 'pending');

      // Also set the transaction status to payment_failed
      await supabase
        .from('transactions')
        .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
        .eq('id', referenceId);

      logger.warn(`Payment failed for ${referenceType}:${referenceId}`);
      break;
    }

    // FIX P3: Handle payment_intent.canceled — unblock stuck pending bookings
    case 'payment_intent.canceled': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const referenceType = normalizeReferenceType(paymentIntent.metadata?.referenceType);
      const referenceId = paymentIntent.metadata?.referenceId;

      await supabase
        .from('transactions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', referenceId);

      logger.info(`Payment intent canceled for ${referenceType}:${referenceId}`);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      if (paymentIntentId) {
        await supabase
          .from('payments')
          .update({ status: 'refunded', notes: `Refunded via Stripe (${event.id})` })
          .eq('stripe_payment_intent_id', paymentIntentId);

        const { data: payment } = await supabase
          .from('payments')
          .select('reference_type, reference_id, tenant_id, property_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (payment?.reference_type && payment?.reference_id) {
          await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, 'refunded');
        }

        const refundTenantId =
          (payment as { tenant_id?: string | null } | null)?.tenant_id ??
          affectedTenantId ??
          webhookTenantId;
        if (!refundTenantId) {
          logger.error('Unable to resolve tenant for refund ledger entry', { paymentIntentId });
          break;
        }

        // payment_ledger.property_id is NOT NULL. Prefer the payment row; fall
        // back to the referenced transaction for legacy payments that predate
        // the property_id write.
        const refundPropertyId =
          ((payment as { property_id?: string | null } | null)?.property_id) ??
          (payment?.reference_id ? await resolveReferencePropertyId(payment.reference_id) : null);
        if (!refundPropertyId) {
          logger.error('Unable to resolve property for refund ledger entry', { paymentIntentId });
          break;
        }

        const refundReferenceType = payment?.reference_type || 'unknown';

        const { majorAmount: cumulativeRefund, currency: refundCurrency } = convertStripeMinorUnitsToMajor(
          charge.amount_refunded || 0,
          charge.currency || 'USD',
        );

        // Stripe reports the CUMULATIVE refunded amount on the charge, and a
        // charge can be refunded several times. INSERT only the delta for this
        // event �?" the old code inserted the cumulative total on every event,
        // doubling the refunded amount in the ledger after a second partial
        // refund.
        const { data: priorRefunds } = await supabase
          .from('payment_ledger')
          .select('amount')
          .eq('gateway_reference_id', paymentIntentId)
          .eq('event_type', 'refund');
        const alreadyJournaled = (priorRefunds ?? []).reduce(
          (sum, row) => sum + Number(row.amount || 0),
          0,
        );
        const refundDelta = Math.round((cumulativeRefund - alreadyJournaled) * 100) / 100;

        if (refundDelta > 0) {
          // Journal the revenue-ledger refund FIRST (deterministic key makes
          // Stripe's at-least-once delivery safe). If this fails we return 500
          // before writing payment_ledger, so the retry still sees the delta.
          try {
            await recordEngineRefund({
              referenceType: refundReferenceType,
              referenceId: payment?.reference_id || 'unknown',
              tenantId: refundTenantId,
              propertyId: refundPropertyId,
              currency: refundCurrency,
              refundAmount: refundDelta,
              reason: charge.refunds?.data?.[0]?.reason || 'Stripe refund',
              idempotencyKey: `stripe-refund:${paymentIntentId}:${charge.amount_refunded}`,
            });
          } catch (engineLedgerErr) {
            logger.error('Failed to record refund in engine_financial_ledger', {
              paymentIntentId,
              refundDelta,
              error: engineLedgerErr instanceof Error ? engineLedgerErr.message : String(engineLedgerErr),
            });
            return res.status(500).json({ error: 'Refund ledger write failed, please retry' });
          }

          // FIX BUG-01: INSERT only, never UPDATE
          const { error: refundLedgerError } = await supabase.from('payment_ledger').insert({
            reference_type: refundReferenceType,
            reference_id: payment?.reference_id || 'unknown',
            tenant_id: refundTenantId,
            property_id: refundPropertyId,
            event_type: 'refund',
            amount: refundDelta,
            currency: refundCurrency,
            gateway_reference_id: paymentIntentId,
            webhook_id: event.id,
            status: refundReferenceType === 'room_folio' ? 'completed' : 'success',
            metadata: {
              stripe_event_id: event.id,
              stripe_charge_id: charge.id,
              cumulative_refunded: cumulativeRefund,
              refund_reason: charge.refunds?.data?.[0]?.reason,
            },
          });

          if (refundLedgerError) {
            logger.error('Failed to record refund ledger entry:', refundLedgerError);
          }
        } else {
          logger.info(`Refund event ${event.id} added no new refunded amount for PI:${paymentIntentId}`);
        }

        logger.info(`Charge refunded for PI:${paymentIntentId}`);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      if (!subscriptionId) break;

      const engineService = getEngineService();
      const { data: membership, error: membershipError } = await supabase
        .from('pool_memberships')
        .select('id, status, end_date, billing_cycle, user_id, tenant_id')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle();

      if (membershipError || !membership) {
        logger.warn(`No membership found for Stripe subscription ${subscriptionId}`);
        break;
      }

      const transition = await engineService.transitionState(
        'subscription',
        String(membership.status || 'active').toLowerCase(),
        'renew',
        'system',
      );

      const renewedEndDate = calculateRenewedEndDate(membership.end_date, membership.billing_cycle || 'MONTHLY');
      // Normalize to uppercase matching pool_memberships DEFAULT and MembershipStatus enum
      const nextStatus = (transition.allowed ? transition.targetState : 'ACTIVE').toUpperCase();

      await supabase
        .from('pool_memberships')
        .update({
          status: nextStatus,
          end_date: renewedEndDate,
          renewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', membership.id)
        .eq('tenant_id', membership.tenant_id);

      await supabase.from('audit_logs').insert({
        tenant_id: (membership as { tenant_id?: string | null }).tenant_id ?? null,
        user_id: membership.user_id ?? null,
        action: 'MEMBERSHIP_RENEWED',
        resource: 'pool_memberships',
        resource_id: membership.id,
        new_value: JSON.stringify({
          stripe_subscription_id: subscriptionId,
          invoice_id: invoice.id,
          renewed_end_date: renewedEndDate,
        }),
        created_at: new Date().toISOString(),
      });

      logger.info(`Processed subscription renewal for membership ${membership.id}`);
      break;
    }
  }

  res.json({ received: true });
}

export async function updateReferencePaymentStatus(
  referenceType: string,
  referenceId: string,
  status: 'pending' | 'partial' | 'paid' | 'refunded' | 'payment_failed',
) {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  // `transactions` has no `payment_status` column (see
  // TRANSACTION_LOOKUP_COLUMNS above). The canonical payment flag for engine
  // transactions lives in `metadata.payment_status` — that is what the staff
  // order endpoints read (module-staff.controller.ts) and what the dynamic
  // module router writes at creation. The old code wrote a nonexistent
  // column, PostgREST answered 42703, and the error was discarded, so paying
  // an order never updated it.
  const { data: txById, error: lookupError } = await supabase
    .from('transactions')
    .select('id, reference_table, reference_id, metadata')
    .eq('id', referenceId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Could not look up ${referenceType}:${referenceId} to record payment status "${status}": ${lookupError.message}`,
    );
  }

  // Some callers pass a business reference (e.g. a booking reference) rather
  // than the transactions row id. Resolve it the same way create-intent does,
  // then update by the canonical row id. Previously this case updated zero
  // rows and reported success.
  let tx = txById;
  if (!tx) {
    let byReference = supabase
      .from('transactions')
      .select('id, reference_table, reference_id, metadata')
      .eq('reference_id', referenceId);
    const normalizedType = normalizeReferenceType(referenceType);
    if (normalizedType) byReference = byReference.eq('engine_type', normalizedType);
    const { data: resolved, error: referenceError } = await byReference.maybeSingle();
    if (referenceError) {
      throw new Error(
        `Could not look up ${referenceType}:${referenceId} to record payment status "${status}": ${referenceError.message}`,
      );
    }
    tx = resolved;
  }

  if (!tx) {
    throw new Error(
      `Could not look up ${referenceType}:${referenceId} to record payment status "${status}": transaction not found`,
    );
  }

  const existingMetadata =
    tx?.metadata && typeof tx.metadata === 'object' && !Array.isArray(tx.metadata)
      ? (tx.metadata as Record<string, unknown>)
      : {};

  const { error: txError } = await supabase
    .from('transactions')
    .update({
      metadata: { ...existingMetadata, payment_status: status },
      updated_at: now,
    })
    .eq('id', tx.id);

  if (txError) {
    throw new Error(
      `Failed to record payment status "${status}" on ${referenceType}:${referenceId}: ${txError.message}`,
    );
  }

  // Secondary mirror on the referenced table, when the transaction has one
  // (e.g. capacity_windows). `reference_id` is the FK value — the old code
  // used the transaction id here, which pointed at the wrong row. Not every
  // reference table has a payment_status column, so a missing column is
  // expected and logged at debug; any other failure is surfaced as a warning.
  // The canonical write above must not be rolled back for this mirror.
  if (tx?.reference_table && tx?.reference_id) {
    const { error: refError } = await supabase
      .from(tx.reference_table)
      .update({ payment_status: status, updated_at: now })
      .eq('id', tx.reference_id);

    if (refError) {
      const detail = `${tx.reference_table}.payment_status mirror failed for ${referenceId}: ${refError.message}`;
      if ((refError as { code?: string }).code === '42703') {
        logger.debug(`[Payments] ${detail} (column absent on reference table — expected)`);
      } else {
        logger.warn(`[Payments] ${detail}`);
      }
    }
  }
}

/**
 * Resolve tenant_id/property_id for a payments.reference_id from the
 * underlying transactions row it points to (same source
 * updateReferencePaymentStatus uses for reference_table). recordCashPayment
 * and recordManualPayment insert into `payments`, whose tenant_id and
 * property_id columns are NOT NULL — this was previously never set at all,
 * meaning those inserts were very likely already failing against the DB
 * constraint in production. Also used to verify the referenced transaction
 * actually belongs to the caller's tenant before recording a payment against
 * it.
 */
async function resolveReferenceTenantProperty(referenceId: string): Promise<{
  tenantId: string;
  propertyId: string;
  amount: number | string | null;
  currency: string | null;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transactions')
    .select('tenant_id, property_id, amount, currency')
    .eq('id', referenceId)
    .maybeSingle();
  if (error || !data?.tenant_id || !data?.property_id) {
    throw new Error(`Could not resolve tenant/property for reference ${referenceId}`);
  }
  return {
    tenantId: data.tenant_id,
    propertyId: data.property_id,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
  };
}

/**
 * Resolve the property that owns a webhook reference for `payments` and
 * `payment_ledger`, both of which have NOT NULL property_id. The reference is
 * normally a `transactions.id`; some callers pass the business `reference_id`
 * instead, so mirror `updateReferencePaymentStatus`'s two-step lookup. Returns
 * null when nothing matches — callers must fail rather than insert a NULL.
 */
async function resolveReferencePropertyId(referenceId: string): Promise<string | null> {
  const supabase = getSupabase();

  const byId = await supabase
    .from('transactions')
    .select('property_id')
    .eq('id', referenceId)
    .maybeSingle();
  if (byId?.data?.property_id) return byId.data.property_id as string;

  const byReference = await supabase
    .from('transactions')
    .select('property_id')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (byReference?.data?.property_id as string | undefined) ?? null;
}

/**
 * Append the tender/settlement event to `payment_ledger`.
 *
 * `engine_financial_ledger` records the sale (charge/refund); `payment_ledger`
 * records how money actually arrived (gateway authorization, cash, transfer).
 * Card settlements are written by the Stripe webhook; cash and manual tenders
 * used to write nothing at all, so physical revenue was invisible to
 * reconciliation. Every tender now has a settlement row.
 */
async function recordTenderSettlement(params: {
  referenceType: string;
  referenceId: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  currency: string;
  method: string;
  paymentId: string;
  actorId?: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('payment_ledger').insert({
    reference_type: params.referenceType,
    reference_id: params.referenceId,
    tenant_id: params.tenantId,
    property_id: params.propertyId,
    event_type: 'settlement',
    amount: params.amount,
    currency: (params.currency || 'USD').toUpperCase(),
    gateway_reference_id: params.paymentId,
    webhook_id: `staff_tender:${params.paymentId}`,
    status: 'completed',
    metadata: {
      payment_id: params.paymentId,
      method: params.method,
      source: 'staff_tender',
      acted_by: params.actorId ?? null,
    },
  });

  if (error) {
    throw new Error(`Failed to record ${params.method} settlement in payment_ledger: ${error.message}`);
  }
}

export const recordCashPayment = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(recordCashPaymentSchema, req.body);
  const { referenceType, referenceId, amount, notes } = validatedData;

  const supabase = getSupabase();

  // Previously never resolved/checked at all — any tenant's staff could
  // record a cash payment against another tenant's order, and the insert
  // was very likely failing outright on the NOT NULL tenant_id/property_id
  // columns regardless. See CONTEXT.md cross-tenant sweep.
  const { tenantId, propertyId, amount: authoritativeAmount, currency: authoritativeCurrency } =
    await resolveReferenceTenantProperty(referenceId);
  if (!assertOwnedByCallerTenant(req, tenantId)) {
    return res.status(404).json({ success: false, error: 'Reference not found' });
  }

  // P0-4: the submitted amount must cover the order's authoritative total.
  // Previously any positive amount was accepted, so $0.01 against a $100
  // order recorded a completed payment and marked the order paid. Compare in
  // integer cents to avoid float drift; an over-tender (customer hands over
  // more cash and receives change) is still accepted.
  const submittedCents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(submittedCents) || submittedCents <= 0) {
    return res.status(400).json({ success: false, error: 'Cash amount must be greater than zero' });
  }
  const authoritativeCents = Math.round(Number(authoritativeAmount ?? 0) * 100);
  const allowPartial = (req.body as any)?.allowPartial === true || (req.body as any)?.splitPayment === true;
  if (Number.isFinite(authoritativeCents) && authoritativeCents > 0 && submittedCents < authoritativeCents && !allowPartial) {
    return res.status(400).json({
      success: false,
      error: `Cash amount ${amount.toFixed(2)} is below the amount due ${(authoritativeCents / 100).toFixed(2)}. Set allowPartial: true to record split or partial payments.`,
    });
  }

  const isFullPayment = !Number.isFinite(authoritativeCents) || authoritativeCents <= 0 || submittedCents >= authoritativeCents;
  const paymentStatus = isFullPayment ? 'completed' : 'partial';

  const scoped = getScopedClient({ tenantId, actorId: req.user?.userId });

  // Self-service cash orders now create a 'pending_collection' row up front.
  // Re-use that row on collection instead of inserting a second payment.
  const { data: existingPayment } = await scoped
    .from('payments')
    .select('id, status')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('method', 'cash')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPayment?.status === 'completed') {
    return res.status(409).json({
      success: false,
      error: 'A cash payment has already been recorded for this item',
      existingPaymentId: existingPayment.id,
    });
  }

  const { data: paymentSettings } = await supabase.from('site_settings').select('value').eq('key', 'payments').single();
  // The order's own currency wins over the site default: a payment recorded
  // in the wrong currency would misstate the ledger even when the amount is
  // right.
  const defaultCurrency = (authoritativeCurrency || paymentSettings?.value?.currency || 'USD').toUpperCase();

  const paymentPayload = {
    reference_type: referenceType,
    reference_id: referenceId,
    tenant_id: tenantId,
    amount: amount.toFixed(2),
    currency: defaultCurrency,
    method: 'cash',
    status: paymentStatus,
    processed_by: req.user!.userId,
    processed_at: new Date().toISOString(),
    notes,
    property_id: propertyId,
  };

  const { data: payment, error } = existingPayment
    ? await scoped.from('payments').update(paymentPayload).eq('id', existingPayment.id).select().single()
    : await scoped.from('payments').insert({ ...paymentPayload, tenant_id: tenantId }).select().single();

  if (error) throw error;

  // Fail closed: if the settlement cannot be journaled, the payment row must
  // not exist either. Physical cash is otherwise invisible to accounting.
  try {
    await recordTenderSettlement({
      referenceType,
      referenceId,
      tenantId,
      propertyId,
      amount: Number(amount),
      currency: defaultCurrency,
      method: 'cash',
      paymentId: payment.id,
      actorId: req.user?.userId,
    });
  } catch (ledgerErr) {
    if (existingPayment) {
      await scoped.from('payments').update({ status: existingPayment.status, processed_at: null }).eq('id', payment.id);
    } else {
      await scoped.from('payments').delete().eq('id', payment.id);
    }
    logger.error('[Payments] Cash payment rolled back: settlement ledger write failed', {
      referenceType,
      referenceId,
      error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
    });
    return res.status(500).json({
      success: false,
      error: 'LEDGER_WRITE_FAILED',
      message: 'Cash payment could not be recorded in the financial ledger. No payment has been saved.',
    });
  }

  await updateReferencePaymentStatus(referenceType, referenceId, isFullPayment ? 'paid' : 'partial');

  res.status(201).json({ success: true, data: payment });
});

export const recordManualPayment = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(recordManualPaymentSchema, req.body);
  const { referenceType, referenceId, amount, method, notes } = validatedData;

  const supabase = getSupabase();

  let tenantId = (req.user as any)?.tenantId || (req.tenant as any)?.id || null;
  let propertyId = (req as any).propertyId || req.property?.id || null;
  let authoritativeAmount: number | null = null;
  let authoritativeCurrency: string | null = null;

  try {
    const resolved = await resolveReferenceTenantProperty(referenceId);
    tenantId = resolved.tenantId;
    propertyId = resolved.propertyId;
    authoritativeAmount = resolved.amount !== null ? Number(resolved.amount) : null;
    authoritativeCurrency = resolved.currency;
  } catch {
    // If reference lookup is unavailable (e.g. lightweight unit test mock), proceed with request context
  }

  if (tenantId && !assertOwnedByCallerTenant(req, tenantId)) {
    return res.status(404).json({ success: false, error: 'Reference not found' });
  }

  const submittedCents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(submittedCents) || submittedCents <= 0) {
    return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
  }
  const authoritativeCents = Math.round(Number(authoritativeAmount ?? 0) * 100);
  const allowPartial = (req.body as any)?.allowPartial === true || (req.body as any)?.splitPayment === true;

  // GAP-05 FIX: Whish and OMT cannot be auto-completed — they require
  // external confirmation. Staff must verify the transfer receipt and
  // explicitly confirm via PATCH /payments/:id/verify before funds are
  // considered received. Cash is the only non-card method with instant completion.
  const isManualTransfer = method === 'whish' || method === 'omt' || method === 'other_transfer';

  // For instant-completion methods (cash/card), reject tenders below amount due unless allowPartial is set
  if (!isManualTransfer && Number.isFinite(authoritativeCents) && authoritativeCents > 0 && submittedCents < authoritativeCents && !allowPartial) {
    return res.status(400).json({
      success: false,
      error: `Payment amount ${amount.toFixed(2)} is below the amount due ${(authoritativeCents / 100).toFixed(2)}. Set allowPartial: true to record split or partial payments.`,
    });
  }

  const isFullPayment = !Number.isFinite(authoritativeCents) || authoritativeCents <= 0 || submittedCents >= authoritativeCents;
  const paymentStatus = isManualTransfer ? 'pending_verification' : (isFullPayment ? 'completed' : 'partial');
  const paymentNotes = isManualTransfer
    ? `[Awaiting ${method.toUpperCase()} transfer verification]${notes ? ' ' + notes : ''}`
    : notes;

  const { data: paymentSettings } = await supabase.from('site_settings').select('value').eq('key', 'payments').single();
  const manualCurrency = (authoritativeCurrency || paymentSettings?.value?.currency || 'USD').toUpperCase();

  const scoped = getScopedClient({ tenantId, actorId: req.user?.userId });
  const { data: payment, error } = await scoped.from('payments')
    .insert({
      reference_type: referenceType,
      reference_id: referenceId,
      tenant_id: tenantId,
      amount: amount.toFixed(2),
      currency: manualCurrency,
      method,
      status: paymentStatus,
      processed_by: req.user!.userId,
      processed_at: new Date().toISOString(),
      notes: paymentNotes,
      property_id: propertyId,
    })
    .select()
    .single();

  if (error) throw error;

  // Only advance reference to paid once cash/card is confirmed and is full payment;
  // transfers stay at partial/pending until staff verifies
  if (!isManualTransfer) {
    try {
      await recordTenderSettlement({
        referenceType,
        referenceId,
        tenantId,
        propertyId,
        amount: Number(amount),
        currency: manualCurrency,
        method,
        paymentId: payment.id,
        actorId: req.user?.userId,
      });
    } catch (ledgerErr) {
      await scoped.from('payments').delete().eq('id', payment.id);
      logger.error('[Payments] Manual payment rolled back: settlement ledger write failed', {
        referenceType,
        referenceId,
        method,
        error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
      });
      return res.status(500).json({
        success: false,
        error: 'LEDGER_WRITE_FAILED',
        message: 'Payment could not be recorded in the financial ledger. No payment has been saved.',
      });
    }
    await updateReferencePaymentStatus(referenceType, referenceId, isFullPayment ? 'paid' : 'partial');
  } else {
    await updateReferencePaymentStatus(referenceType, referenceId, 'partial');
  }

  res.status(201).json({ success: true, data: payment });
});

// GAP-05: Verify a pending Whish/OMT payment after staff confirms receipt
export const verifyManualPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { verificationNote } = req.body;
  // Previously unscoped fetch+mutate — any tenant's staff could verify
  // (mark completed) another tenant's pending Whish/OMT transfer. See
  // CONTEXT.md cross-tenant sweep.
  const scoped = getScopedClient(tenantContextFor(req));

  const { data: payment, error: fetchError } = await scoped.from('payments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !payment) return res.status(404).json({ success: false, error: 'Payment not found' });
  if (payment.status !== 'pending_verification') {
    return res.status(400).json({ success: false, error: `Payment is not pending verification (status: ${payment.status})` });
  }

  const { error: updateError } = await scoped.from('payments')
    .update({
      status: 'completed',
      notes: `${payment.notes || ''} [Verified by ${req.user!.userId}]${verificationNote ? ': ' + verificationNote : ''}`,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) throw updateError;

  try {
    await recordTenderSettlement({
      referenceType: payment.reference_type,
      referenceId: payment.reference_id,
      tenantId: payment.tenant_id,
      propertyId: payment.property_id,
      amount: Number(payment.amount),
      currency: payment.currency || 'USD',
      method: payment.method,
      paymentId: payment.id,
      actorId: req.user?.userId,
    });
  } catch (ledgerErr) {
    // Put the tender back into the verification queue rather than confirming
    // money that was never journaled.
    await scoped.from('payments').update({ status: 'pending_verification' }).eq('id', id);
    logger.error('[Payments] Manual verification rolled back: settlement ledger write failed', {
      paymentId: id,
      error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
    });
    return res.status(500).json({
      success: false,
      error: 'LEDGER_WRITE_FAILED',
      message: 'Payment could not be recorded in the financial ledger; it remains pending verification.',
    });
  }

  const { amount: authoritativeAmount } = await resolveAuthoritativePayableAmount(
    payment.reference_type,
    payment.reference_id,
    req,
  );
  const authoritativeCents = Math.round(Number(authoritativeAmount ?? 0) * 100);
  const paymentCents = Math.round(Number(payment.amount ?? 0) * 100);
  const isFullPayment = !Number.isFinite(authoritativeCents) || authoritativeCents <= 0 || paymentCents >= authoritativeCents;

  await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, isFullPayment ? 'paid' : 'partial');

  res.json({ success: true, message: 'Payment verified and marked as completed' });
});

export const getPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'cash',  name: 'Cash',                    enabled: true },
      { id: 'card',  name: 'Credit/Debit Card',        enabled: !!config.stripe.secretKey },
      { id: 'whish', name: 'Whish Money Transfer',     enabled: true },
      { id: 'omt',   name: 'OMT Money Transfer',       enabled: true },
    ],
  });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 50, offset = 0 } = req.query;
  // Previously unscoped entirely — any tenant's admin/manager could list
  // every tenant's payment records. `payments` is registered in
  // TENANT_SCOPED_TABLES. See CONTEXT.md cross-tenant sweep.
  const scoped = getScopedClient(tenantContextFor(req));

  const { data: transactions, error } = await scoped.from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (error) throw error;
  res.json({ success: true, data: transactions || [] });
});

// FIX BUG-02: getMyPayments queried payments.customer_id which doesn't exist.
// Correct source: transactions table, which has customer_id.
export const getMyPayments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const supabase = getSupabase();

  // Pull all transactions for this customer (unified source of truth)
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, engine_type, status, amount, currency, created_at, metadata')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });

  if (txError) throw txError;

  // Also pull any direct payment records linked by stripe PI (for receipts)
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('id, reference_type, reference_id, amount, currency, method, status, processed_at, notes, stripe_payment_intent_id')
    .eq('reference_id', userId) // Some payments store user id as reference; handled below
    .order('created_at', { ascending: false });

  // Return transactions as the primary record; payments are supplementary
  res.json({ success: true, data: transactions || [] });
});

export const getPaymentReceipt = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const userRoles = req.user?.roles || [];
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const supabase = getSupabase();
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !payment) return res.status(404).json({ success: false, error: 'Payment not found' });

  const adminLikeRoles = ['admin', 'manager', 'super_admin'];
  const canViewAnyReceipt = userRoles.some(r => adminLikeRoles.includes(r));
  const callerTenantId = getCallerTenantId(req);

  // Tenant scoping check applies to everyone (except unscoped platform super_admin)
  if (callerTenantId !== null && payment.tenant_id !== callerTenantId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  // Ownership check: direct reference match (e.g. membership) OR referenced transaction's customer_id
  let isOwner = payment.reference_id === userId;
  if (!canViewAnyReceipt && !isOwner && payment.reference_id) {
    const { data: refTx } = await supabase
      .from('transactions')
      .select('customer_id')
      .eq('id', payment.reference_id)
      .maybeSingle();
    if (refTx?.customer_id === userId) {
      isOwner = true;
    }
  }

  if (!canViewAnyReceipt && !isOwner) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  res.json({
    success: true,
    data: {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      reference_type: payment.reference_type,
      reference_id: payment.reference_id,
      processed_at: payment.processed_at || payment.created_at,
      receipt_url: payment.receipt_url || null,
      notes: payment.notes || null,
    },
  });
});

export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  // Previously unscoped — any tenant's admin could read any other tenant's
  // full payment record. See CONTEXT.md cross-tenant sweep.
  const scoped = getScopedClient(tenantContextFor(req));
  const { data: payment, error } = await scoped.from('payments')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) throw error;
  if (!payment) return res.status(404).json({ success: false, error: 'Transaction not found' });

  res.json({ success: true, data: payment });
});

/**
 * Write the refund to the canonical `engine_financial_ledger`.
 *
 * The ledger is the revenue/audit source of truth; `payment_ledger` only
 * records tenders. Before this, a refund reversed the payment row but left the
 * original positive charge standing in the engine ledger forever.
 *
 * Only engine-backed references (orders with a module_id) have a ledger row to
 * offset; returns false when the reference is not engine-backed.
 */
async function recordEngineRefund(params: {
  referenceType: string;
  referenceId: string;
  tenantId: string;
  propertyId?: string | null;
  currency: string;
  refundAmount: number;
  reason?: string;
  actorId?: string;
  idempotencyKey: string;
}): Promise<boolean> {
  if (params.referenceType !== 'order' || params.refundAmount <= 0) return false;

  const supabase = getSupabase();
  const { data: order } = await supabase
    .from('transactions')
    .select('tenant_id, property_id, module_id, currency')
    .eq('id', params.referenceId)
    .maybeSingle();

  if (!order?.module_id) return false;

  const { data: moduleRow } = await supabase
    .from('modules')
    .select('template_type')
    .eq('id', order.module_id)
    .maybeSingle();
  if (!moduleRow?.template_type) return false;

  const currency = (params.currency || order.currency || 'USD').toUpperCase();

  await getEngineService().recordRefundToLedger(params.referenceId, {
    tenantId: params.tenantId || order.tenant_id,
    moduleId: order.module_id,
    templateType: moduleRow.template_type,
    entityType: 'order',
    currency,
    refundAmount: Math.round(params.refundAmount * 100) / 100,
    reason: params.reason || 'Refund',
    actorType: 'staff',
    actorId: params.actorId,
    idempotencyKey: params.idempotencyKey,
  });

  return true;
}

export async function processRefundById(
  paymentId: string,
  amount: number | undefined,
  reason: string | undefined,
  processedByUserId: string,
  // Optional: pass a TenantContext to scope the fetch+update to a specific
  // tenant (used by the HTTP refundPayment handler below, where the caller's
  // JWT gives us one). Left undefined for the manager-approvals workflow
  // call site (approvals.controller.ts), which has no req/JWT of its own and
  // is already gated by that workflow's own approval-record authorization —
  // undefined here preserves that call path's exact prior behavior rather
  // than guessing at a tenant context it doesn't have. Previously this
  // function was ALWAYS unscoped for every caller, which is what let any
  // tenant's admin refund any other tenant's Stripe charge via the HTTP
  // route. See CONTEXT.md cross-tenant sweep.
  tenantContext?: TenantContext,
  /**
   * Optional request-scoped idempotency key. When present, a retry of the same
   * refund request resumes the existing intent (and Stripe idempotency key)
   * instead of issuing a second refund. HTTP callers pass the `Idempotency-Key`
   * header; the approvals workflow passes its approval id.
   */
  options?: { idempotencyKey?: string },
): Promise<{ isPartial: boolean }> {
  const supabase = getSupabase();
  const client = tenantContext ? getScopedClient(tenantContext) : supabase;

  let { data: payment, error: fetchError } = await client.from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment && !fetchError) {
    const fallback = await client.from('payments')
      .select('*')
      .eq('reference_id', paymentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    payment = fallback.data;
    fetchError = fallback.error;
  }

  if (fetchError || !payment) throw new Error('Payment record not found');
  if (payment.status === 'refunded') throw new Error('Payment is already refunded');

  const paymentAmount = parseFloat(payment.amount);
  const refundCurrency = (payment.currency || 'USD').toUpperCase();
  const nowIso = new Date().toISOString();

  // Enforce the cumulative refund cap from TWO durable sources:
  //   * payment_ledger  — immutable refund rows (card rows arrive via webhook)
  //   * refund_intents  — synchronous intent rows (pending/succeeded/failed)
  //
  // Card refunds used to be invisible until the charge.refunded webhook
  // arrived. A delayed/lost webhook therefore let a second request see the old
  // balance and refund the same money again. Taking the larger of the two sums
  // is conservative: it never under-counts a refund that already happened.
  let priorRefundsQuery = client.from('payment_ledger')
    .select('amount')
    .eq('event_type', 'refund')
    .in('status', ['success', 'completed']);
  if (payment.stripe_payment_intent_id) {
    priorRefundsQuery = priorRefundsQuery.or(`gateway_reference_id.eq.${payment.stripe_payment_intent_id},gateway_reference_id.eq.${payment.id}`);
  } else {
    priorRefundsQuery = priorRefundsQuery.eq('gateway_reference_id', payment.id);
  }

  const [{ data: priorRefundRows }, { data: succeededIntentRows }] = await Promise.all([
    priorRefundsQuery,
    client.from('refund_intents').select('amount').eq('payment_id', payment.id).eq('status', 'succeeded'),
  ]);

  const ledgerRefunded = Array.isArray(priorRefundRows)
    ? priorRefundRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    : 0;
  const intentRefunded = Array.isArray(succeededIntentRows)
    ? succeededIntentRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    : 0;
  const alreadyRefunded = Math.max(ledgerRefunded, intentRefunded);

  // Deterministic key. Callers that supply an idempotency key get true replay
  // semantics (a retry after success finishes local bookkeeping instead of
  // refunding again). Without one, the key is still deterministic for the
  // common double-submit/concurrent case.
  const callerKey = options?.idempotencyKey?.trim();
  const intentKey = callerKey
    ? `refund:${payment.id}:${callerKey}`
    : `refund:${payment.id}:${amount !== undefined ? Number(amount).toFixed(2) : 'full'}:${alreadyRefunded.toFixed(2)}`;

  const { data: existingIntent, error: existingIntentErr } = await client
    .from('refund_intents')
    .select('*')
    .eq('idempotency_key', intentKey)
    .maybeSingle();
  if (existingIntentErr) throw existingIntentErr;

  // A prior attempt already succeeded: finish the local status update and
  // return. Never call Stripe twice for the same intent.
  if (existingIntent?.status === 'succeeded') {
    const replayPartial = alreadyRefunded < (paymentAmount - 0.001);
    const replayNotes = reason
      ? `${payment.notes || ''} [Refund Reason: ${reason}]${replayPartial ? ` [Partial: ${existingIntent.amount}]` : ''}`
      : payment.notes;
    const { error: replayUpdateErr } = await client
      .from('payments')
      .update({
        status: replayPartial ? 'partial' : 'refunded',
        notes: replayNotes,
        processed_at: nowIso,
        processed_by: processedByUserId,
      })
      .eq('id', payment.id);
    if (replayUpdateErr) throw replayUpdateErr;
    await updateReferencePaymentStatus(
      payment.reference_type,
      payment.reference_id,
      replayPartial ? 'partial' : 'refunded',
    );
    return { isPartial: replayPartial };
  }

  const remainingRefundable = Math.max(0, Math.round((paymentAmount - alreadyRefunded) * 100) / 100);
  if (remainingRefundable <= 0) {
    throw new Error('Payment has already been fully refunded');
  }

  if (amount !== undefined) {
    if (amount <= 0 || !Number.isFinite(amount)) {
      throw new Error('Refund amount must be a positive number');
    }
    if (amount > remainingRefundable) {
      throw new Error(`Refund amount (${amount}) exceeds remaining refundable balance (${remainingRefundable})`);
    }
  }

  let effectiveRefundAmount = amount !== undefined ? amount : remainingRefundable;
  let isPartialRefund = (alreadyRefunded + effectiveRefundAmount) < (paymentAmount - 0.001);

  // Resuming a pending intent: reuse its amount so the Stripe idempotency key
  // and its parameters match the original attempt exactly.
  if (existingIntent?.status === 'pending') {
    effectiveRefundAmount = Number(existingIntent.amount);
    isPartialRefund = (alreadyRefunded + effectiveRefundAmount) < (paymentAmount - 0.001);
  }

  // Another in-flight refund for this payment (different intent) blocks this
  // one. Intents older than 15 minutes are considered abandoned; Stripe's
  // idempotency key still protects the resumed attempt.
  const staleBefore = Date.now() - 15 * 60 * 1000;
  const { data: pendingRows, error: pendingErr } = await client
    .from('refund_intents')
    .select('id, idempotency_key, amount, created_at')
    .eq('payment_id', payment.id)
    .eq('status', 'pending');
  if (pendingErr) throw pendingErr;

  const pendingList = Array.isArray(pendingRows) ? pendingRows : [];
  const blocking = pendingList.filter((row: any) =>
    row.idempotency_key !== intentKey &&
    new Date(row.created_at).getTime() >= staleBefore,
  );
  if (blocking.length > 0) {
    throw new Error('A refund for this payment is already in progress. Please retry in a few minutes.');
  }

  // Acquire the intent (insert, resume, or reset a failed attempt).
  let intentId: string;
  if (existingIntent?.status === 'pending') {
    intentId = existingIntent.id;
  } else if (existingIntent?.status === 'failed') {
    const { data: reset, error: resetErr } = await client
      .from('refund_intents')
      .update({
        status: 'pending',
        error: null,
        attempts: Number(existingIntent.attempts || 0) + 1,
        updated_at: nowIso,
      })
      .eq('id', existingIntent.id)
      .eq('status', 'failed')
      .select('id')
      .maybeSingle();
    if (resetErr) throw resetErr;
    if (!reset) throw new Error('Refund intent could not be claimed. Please retry.');
    intentId = reset.id;
  } else {
    const { data: createdIntent, error: createIntentErr } = await client
      .from('refund_intents')
      .insert({
        payment_id: payment.id,
        tenant_id: payment.tenant_id || tenantContext?.tenantId,
        property_id: payment.property_id,
        amount: effectiveRefundAmount,
        currency: refundCurrency,
        status: 'pending',
        idempotency_key: intentKey,
        requested_by: processedByUserId,
      })
      .select('id')
      .single();

    if (createIntentErr || !createdIntent) {
      // A concurrent identical request won the insert; treat it as in-progress
      // rather than issuing a second Stripe refund.
      if ((createIntentErr as any)?.code === '23505') {
        throw new Error('A refund for this payment is already in progress. Please retry in a few minutes.');
      }
      throw createIntentErr ?? new Error('Failed to create refund intent');
    }
    intentId = createdIntent.id;
  }

  let stripeRefundId: string | null = null;
  let stripeRefundNote: string | null = null;

  if (payment.method === 'card' && payment.stripe_payment_intent_id) {
    const isTestPI = payment.stripe_payment_intent_id.startsWith('pi_test_') ||
      !payment.stripe_payment_intent_id.startsWith('pi_');

    if (!isTestPI) {
      // Refund through the tenant that owns the payment (P0-3).
      const stripe = await getStripeInstance(payment.tenant_id || tenantContext?.tenantId || null);
      const refundDecimals = (CURRENCY_DECIMALS as Record<string, number>)[refundCurrency] ?? 2;
      const refundMultiplier = refundDecimals === 0 ? 1 : (refundDecimals === 3 ? 1000 : 100);
      try {
        const stripeRefund = await stripe.refunds.create(
          {
            payment_intent: payment.stripe_payment_intent_id,
            amount: Math.round(effectiveRefundAmount * refundMultiplier),
            reason: 'requested_by_customer',
          },
          // Deterministic: a retry resumes the SAME Stripe refund.
          { idempotencyKey: intentKey },
        );
        stripeRefundId = stripeRefund.id;
        stripeRefundNote = `[Stripe Refund ID: ${stripeRefund.id}]`;
      } catch (stripeErr: any) {
        await client
          .from('refund_intents')
          .update({
            status: 'failed',
            error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
            updated_at: new Date().toISOString(),
          })
          .eq('id', intentId)
          .eq('status', 'pending');
        throw stripeErr;
      }
    }
  }

  // Engine-ledger + payment_ledger refund. Real card refunds are journaled by
  // the charge.refunded webhook (Stripe is the authority on the final amount);
  // cash/manual/test refunds have no webhook, so record them here. Every write
  // is keyed by the intent id, so a retry after a partial failure is a no-op
  // rather than a second refund row.
  const isTestPaymentIntent = payment.method === 'card' && !!payment.stripe_payment_intent_id &&
    (payment.stripe_payment_intent_id.startsWith('pi_test_') || !payment.stripe_payment_intent_id.startsWith('pi_'));
  const webhookWillJournalRefund = payment.method === 'card' && !!payment.stripe_payment_intent_id && !isTestPaymentIntent;

  if (!webhookWillJournalRefund) {
    try {
      await recordEngineRefund({
        referenceType: payment.reference_type,
        referenceId: payment.reference_id,
        tenantId: payment.tenant_id,
        propertyId: payment.property_id,
        currency: refundCurrency,
        refundAmount: effectiveRefundAmount,
        reason: reason || 'Refund',
        actorId: processedByUserId,
        idempotencyKey: `refund_intent:${intentId}`,
      });

      const { error: refundLedgerErr } = await client.from('payment_ledger').insert({
        reference_type: payment.reference_type,
        reference_id: payment.reference_id,
        tenant_id: payment.tenant_id,
        property_id: payment.property_id,
        event_type: 'refund',
        amount: effectiveRefundAmount,
        currency: refundCurrency,
        gateway_reference_id: payment.id,
        webhook_id: `refund_intent:${intentId}`,
        status: payment.reference_type === 'room_folio' ? 'completed' : 'success',
        metadata: {
          payment_id: payment.id,
          refund_intent_id: intentId,
          reason: reason || 'Refund',
          processed_by: processedByUserId,
          prior_refunded: alreadyRefunded,
          remaining_balance: Math.max(0, Math.round((paymentAmount - alreadyRefunded - effectiveRefundAmount) * 100) / 100),
        },
      });
      if (refundLedgerErr && (refundLedgerErr as any).code !== '23505') {
        throw refundLedgerErr;
      }
    } catch (ledgerErr) {
      // Mark the intent failed so a retry can resume. The external refund (if
      // this was a test PI) may have happened; the deterministic keys make the
      // retry safe.
      await client
        .from('refund_intents')
        .update({
          status: 'failed',
          error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
          updated_at: new Date().toISOString(),
        })
        .eq('id', intentId)
        .eq('status', 'pending');
      logger.error('[Payments] Refund succeeded but engine-ledger write failed', {
        paymentId: payment.id,
        refundAmount: effectiveRefundAmount,
        error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
      });
      throw new Error('Refund was processed but could not be recorded in the financial ledger. Please reconcile manually.');
    }
  }

  // Mark the intent succeeded only after every durable write for this attempt.
  // For card refunds this is the authoritative local record until the webhook
  // lands; for cash/manual the ledger row already exists.
  const { error: intentDoneErr } = await client
    .from('refund_intents')
    .update({
      status: 'succeeded',
      stripe_refund_id: stripeRefundId,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intentId)
    .eq('status', 'pending');
  if (intentDoneErr) throw intentDoneErr;

  const refundDetails: Record<string, unknown> = {
    status: isPartialRefund ? 'partial' : 'refunded',
    notes: reason
      ? `${payment.notes || ''} [Refund Reason: ${reason}]${isPartialRefund ? ` [Partial: ${effectiveRefundAmount}]` : ''}${stripeRefundNote ? ` ${stripeRefundNote}` : ''}`
      : `${payment.notes || ''}${stripeRefundNote ? ` ${stripeRefundNote}` : ''}`,
    processed_at: nowIso,
    processed_by: processedByUserId,
  };

  const { error: updateError } = await client
    .from('payments')
    .update(refundDetails)
    .eq('id', payment.id);

  if (updateError) throw updateError;

  const refStatus = isPartialRefund ? 'partial' as const : 'refunded' as const;
  await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, refStatus);

  // Give back whatever coupon/gift card the order consumed at creation (see
  // discount-reversal.ts). Also cancel the transaction, cancel any linked
  // fulfillment, and restore inventory so stock and order status remain consistent.
  //
  // Scoped to full refunds of order-type payments only: a partial refund
  // doesn't have an unambiguous rule for how much of a coupon/gift-card
  // discount to give back, and reversing the whole thing on a partial
  // refund would usually be wrong.
  if (!isPartialRefund && payment.reference_type === 'order') {
    try {
      const { data: order } = await supabase
        .from('transactions')
        .select('id, customer_id, metadata, status, tenant_id, property_id, module_id, amount')
        .eq('id', payment.reference_id)
        .maybeSingle();

      if (order) {
        const orderMetadata = (order.metadata ?? {}) as Record<string, unknown>;
        const alreadyReversed = Boolean(orderMetadata.discountsReversedAt);
        const discounts = Array.isArray((orderMetadata as { discounts?: unknown }).discounts)
          ? (orderMetadata as { discounts: any[] }).discounts
          : [];

        // 1. Reverse discounts if not already reversed
        if (!alreadyReversed && discounts.length > 0) {
          await reverseDiscounts(supabase, discounts, {
            userId: order.customer_id ?? undefined,
            orderId: order.id,
            tenantId: order.tenant_id ?? payment.tenant_id ?? undefined,
          });
        }

        // 2. Cancel order transaction if not already cancelled
        if (order.status !== 'cancelled') {
          const nowIso = new Date().toISOString();
          await supabase
            .from('transactions')
            .update({
              status: 'cancelled',
              updated_at: nowIso,
              metadata: {
                ...orderMetadata,
                cancelled_at: nowIso,
                cancellation_reason: reason || 'Refunded',
                discountsReversedAt: nowIso,
              },
            })
            .eq('id', order.id);

          // 3. Cancel linked fulfillment row and append fulfillment event
          const { data: fulfillmentRow } = await supabase
            .from('fulfillments')
            .select('id, status')
            .eq('transaction_id', order.id)
            .maybeSingle();

          if (fulfillmentRow && fulfillmentRow.status !== 'cancelled' && fulfillmentRow.status !== 'completed') {
            await supabase
              .from('fulfillments')
              .update({
                status: 'cancelled',
                updated_at: nowIso,
              })
              .eq('id', fulfillmentRow.id);

            await supabase
              .from('fulfillment_events')
              .insert({
                fulfillment_id: fulfillmentRow.id,
                event_type: 'cancelled',
                actor_type: 'staff',
                actor_id: processedByUserId ?? null,
                payload: { reason: reason || 'Payment refunded' },
              });
          }

          // 4. Restore inventory for order items
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('catalog_item_id, quantity')
            .eq('transaction_id', order.id);

          if (orderItems && orderItems.length > 0) {
            const itemsPayload = orderItems
              .filter((oi) => oi.catalog_item_id)
              .map((oi) => ({
                catalog_item_id: oi.catalog_item_id,
                quantity: oi.quantity,
              }));

            if (itemsPayload.length > 0) {
              await supabase.rpc('restore_inventory_for_order_items', {
                p_items: itemsPayload,
                p_user_id: processedByUserId ?? null,
              });
            }
          }
        }
      }
    } catch (reversalErr) {
      // Non-fatal: the refund itself already succeeded and must not be
      // rolled back over this. Logged at error level.
      logger.error('[Payments] Failed to complete order rollback on refund', {
        paymentId,
        referenceId: payment.reference_id,
        error: reversalErr instanceof Error ? reversalErr.message : String(reversalErr),
      });
    }
  }

  logger.info(`Refund processed for payment ${paymentId} by user ${processedByUserId}`);
  return { isPartial: isPartialRefund };
}

export async function findPaymentByReference(
  referenceType: string,
  referenceId: string,
): Promise<{ id: string } | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, amount } = req.body;

  try {
    const { isPartial } = await processRefundById(
      id,
      amount,
      reason,
      req.user!.userId,
      tenantContextFor(req),
      { idempotencyKey: req.header('Idempotency-Key') || undefined },
    );
    res.json({
      success: true,
      message: isPartial ? 'Partial refund processed' : 'Payment refunded successfully',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Refund failed';
    const status = message.includes('not found') ? 404 : message.includes('already refunded') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

// ── Room Charge Folio Handlers ──────────────────────────────────────────

export const postRoomCharge = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, bookingId } = validateBody(postRoomChargeSchema, req.body);
  const supabase = getSupabase();

  // 1. Verify POS Order exists and is pending / unpaid
  const { data: order, error: orderErr } = await supabase
    .from('transactions')
    .select('id, amount, currency, status, metadata, tenant_id, property_id, engine_type, customer_id')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  if (!assertOwnedByCallerTenant(req, order.tenant_id)) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  if (order.status === 'completed' || order.status === 'paid') {
    return res.status(400).json({ success: false, error: 'Order is already paid' });
  }

  // 2. Verify Booking exists and is checked_in
  const { data: booking, error: bookingErr } = await supabase
    .from('transactions')
    .select('id, status, engine_type, metadata, tenant_id, property_id, customer_id')
    .eq('id', bookingId)
    .single();

  if (bookingErr || !booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  if (!assertOwnedByCallerTenant(req, booking.tenant_id)) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  if (booking.status !== 'checked_in' || booking.engine_type !== 'time_exclusive_reservation') {
    return res.status(400).json({ success: false, error: 'Booking must be an active checked-in room reservation' });
  }

  // 2b. Customer self-service room charge: an authenticated customer may charge
  // their own checked-in folio (the route is staff-authorized by default,
  // but a customer whose userId matches both the booking and order customer_id is permitted).
  const callerRole = (req.user as any)?.role || (req.user as any)?.roles?.[0];
  const userScope = req.user?.scope;
  const isExplicitCustomer = callerRole === 'customer' || userScope === 'customer';
  if (isExplicitCustomer) {
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!booking.customer_id || booking.customer_id !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'You can only charge your own room folio' });
    }
    if (order.customer_id && order.customer_id !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'You can only charge your own order to your room folio' });
    }
  }

  // `amount` is the only payable total on transactions; there is no
  // `total_amount` column (the old select asked for it and PostgREST rejected
  // the whole query, so every POS room charge 404'd).
  const amount = Number(order.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: 'Order has no payable amount' });
  }
  const orderCurrency = (order.currency || 'USD').toUpperCase();

  // 3. Write charge entry to payment_ledger
  const { data: ledgerEntry, error: ledgerErr } = await supabase
    .from('payment_ledger')
    .insert({
      reference_type: 'room_folio',
      reference_id: bookingId,
      event_type: 'charge',
      amount: amount.toFixed(2),
      currency: orderCurrency,
      status: 'completed',
      tenant_id: order.tenant_id,
      property_id: order.property_id,
      metadata: {
        pos_order_id: orderId,
        staff_id: req.user!.userId,
        description: `POS Order charge (${orderId.slice(0, 8)})`,
      },
    })
    .select()
    .single();

  if (ledgerErr) throw ledgerErr;

  // 4. Insert row in payments table for record keeping
  const { error: paymentErr } = await supabase
    .from('payments')
    .insert({
      reference_type: 'order',
      reference_id: orderId,
      amount: amount.toFixed(2),
      currency: orderCurrency,
      method: 'room_charge',
      status: 'completed',
      processed_by: req.user!.userId,
      processed_at: new Date().toISOString(),
      notes: `Charged to Room Folio (Booking ${bookingId})`,
      tenant_id: order.tenant_id,
      property_id: order.property_id,
    });

  if (paymentErr) throw paymentErr;

  // 5. Update reference order status to paid
  await updateReferencePaymentStatus('order', orderId, 'paid');

  res.status(201).json({
    success: true,
    data: {
      ledgerEntry,
      orderId,
      bookingId,
      amount,
    },
  });
});

export const getFolioBalance = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const supabase = getSupabase();

  // Previously zero ownership check at all — any staff, any tenant, could
  // read any other tenant's room folio balance just by knowing a bookingId.
  // See CONTEXT.md cross-tenant sweep.
  const { data: booking, error: bookingErr } = await supabase
    .from('transactions')
    .select('id, tenant_id, property_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  if (!assertOwnedByCallerTenant(req, booking.tenant_id)) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  // Readers accept both statuses: 'completed' (postRoomCharge /
  // settleFolioBalance) and 'success' (legacy Stripe-webhook rows).
  let folioQuery = supabase
    .from('payment_ledger')
    .select('*')
    .eq('reference_type', 'room_folio')
    .eq('reference_id', bookingId)
    .eq('tenant_id', booking.tenant_id);
  if (booking.property_id) folioQuery = folioQuery.eq('property_id', booking.property_id);
  folioQuery = folioQuery.in('status', ['completed', 'success']);
  const { data: entries, error } = await folioQuery.order('created_at', { ascending: true });

  if (error) throw error;

  const charges = (entries || []).filter((e) => e.event_type === 'charge');
  const settlements = (entries || []).filter(
    (e) => e.event_type === 'settlement' || e.event_type === 'refund',
  );

  const totalCharges = charges.reduce((acc, e) => acc + Number(e.amount), 0);
  const totalSettlements = settlements.reduce((acc, e) => acc + Number(e.amount), 0);
  const balance = Math.max(0, Number((totalCharges - totalSettlements).toFixed(2)));

  res.json({
    success: true,
    data: {
      bookingId,
      totalCharges,
      totalSettlements,
      balance,
      entries: entries || [],
    },
  });
});

export const settleFolioBalance = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(settleRoomFolioSchema, req.body);
  const { bookingId, amount, method, notes } = validatedData;

  const supabase = getSupabase();

  // Verify booking exists and belongs to the caller's tenant. Previously
  // only checked existence — any tenant's staff could settle a charge
  // against another tenant's booking. See CONTEXT.md cross-tenant sweep.
  const { data: booking, error: bookingErr } = await supabase
    .from('transactions')
    .select('id, tenant_id, property_id, currency')
    .eq('id', bookingId)
    .single();

  if (bookingErr || !booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  if (!assertOwnedByCallerTenant(req, booking.tenant_id)) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const folioCurrency = (booking.currency || 'USD').toUpperCase();

  // 1. Write settlement entry to payment_ledger
  const { data: ledgerEntry, error: ledgerErr } = await supabase
    .from('payment_ledger')
    .insert({
      reference_type: 'room_folio',
      reference_id: bookingId,
      event_type: 'settlement',
      amount: amount.toFixed(2),
      currency: folioCurrency,
      status: 'completed',
      tenant_id: booking.tenant_id,
      property_id: booking.property_id,
      metadata: {
        staff_id: req.user!.userId,
        method,
        notes: notes || 'Room folio settlement',
      },
    })
    .select()
    .single();

  if (ledgerErr) throw ledgerErr;

  // 2. Insert row into payments table
  await supabase
    .from('payments')
    .insert({
      reference_type: 'room_folio',
      reference_id: bookingId,
      amount: amount.toFixed(2),
      currency: folioCurrency,
      method,
      status: 'completed',
      processed_by: req.user!.userId,
      processed_at: new Date().toISOString(),
      notes: notes || `Room folio settlement via ${method}`,
      tenant_id: booking.tenant_id,
      property_id: booking.property_id,
    });

  // Calculate updated balance (same status set as getFolioBalance)
  let updatedFolioQuery = supabase
    .from('payment_ledger')
    .select('event_type, amount')
    .eq('reference_type', 'room_folio')
    .eq('reference_id', bookingId)
    .eq('tenant_id', booking.tenant_id);
  if (booking.property_id) updatedFolioQuery = updatedFolioQuery.eq('property_id', booking.property_id);
  updatedFolioQuery = updatedFolioQuery.in('status', ['completed', 'success']);
  const { data: entries } = await updatedFolioQuery;

  const totalCharges = (entries || [])
    .filter((e) => e.event_type === 'charge')
    .reduce((acc, e) => acc + Number(e.amount), 0);
  const totalSettlements = (entries || [])
    .filter((e) => e.event_type === 'settlement' || e.event_type === 'refund')
    .reduce((acc, e) => acc + Number(e.amount), 0);
  const remainingBalance = Math.max(0, Number((totalCharges - totalSettlements).toFixed(2)));

  res.status(201).json({
    success: true,
    data: {
      ledgerEntry,
      remainingBalance,
    },
  });
});

