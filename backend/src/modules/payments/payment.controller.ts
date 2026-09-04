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

const getStripeInstance = async () => {
  const supabase = getSupabase();
  const { data: settings } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'payments')
    .single();

  const secretKey = settings?.value?.stripeSecretKey || config.stripe.secretKey;
  if (!secretKey) throw new Error('Stripe secret key not configured');

  return new Stripe(secretKey, { apiVersion: '2023-10-16' });
};

const getStripeWebhookSecret = async () => {
  const supabase = getSupabase();
  const { data: settings } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'payments')
    .single();

  return settings?.value?.stripeWebhookSecret || config.stripe.webhookSecret;
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

async function resolveAuthoritativePayableAmount(
  referenceType: string,
  referenceId: string,
): Promise<{ amount: number; currency: string; paymentStatus?: string }> {
  const supabase = getSupabase();

  // 1. First look up the canonical transactions row
  const { data: tx } = await supabase
    .from('transactions')
    .select('total_amount, currency, payment_status, reference_table')
    .eq('id', referenceId)
    .maybeSingle();

  if (tx && tx.total_amount !== undefined && tx.total_amount !== null) {
    return {
      amount: Number(tx.total_amount),
      currency: (tx.currency || 'USD').toUpperCase(),
      paymentStatus: tx.payment_status,
    };
  }

  // 2. Fall back to reference-specific tables
  if (referenceType === 'instant_transaction' || referenceType === 'order') {
    const { data: order } = await supabase
      .from('orders')
      .select('total_amount, final_total, total, currency, payment_status')
      .eq('id', referenceId)
      .maybeSingle();
    if (order) {
      const amount = Number(order.total_amount ?? order.final_total ?? order.total ?? 0);
      return {
        amount,
        currency: (order.currency || 'USD').toUpperCase(),
        paymentStatus: order.payment_status,
      };
    }
  }

  if (referenceType === 'time_exclusive_reservation' || referenceType === 'booking') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('total_amount, currency, payment_status')
      .eq('id', referenceId)
      .maybeSingle();
    if (booking) {
      return {
        amount: Number(booking.total_amount ?? 0),
        currency: (booking.currency || 'USD').toUpperCase(),
        paymentStatus: booking.payment_status,
      };
    }
  }

  if (referenceType === 'shared_capacity_access' || referenceType === 'ticket') {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('total_amount, currency, payment_status')
      .eq('id', referenceId)
      .maybeSingle();
    if (ticket) {
      return {
        amount: Number(ticket.total_amount ?? 0),
        currency: (ticket.currency || 'USD').toUpperCase(),
        paymentStatus: ticket.payment_status,
      };
    }
  }

  throw new Error(`Authoritative record not found for reference ${referenceType}:${referenceId}`);
}

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(createPaymentIntentSchema, req.body);
  const { amount: clientAmount, currency: clientCurrency = 'usd', referenceType, referenceId } = validatedData;

  // Resolve authoritative payable amount and currency directly from DB record (F6 invariant)
  let authRecord: { amount: number; currency: string; paymentStatus?: string };
  try {
    authRecord = await resolveAuthoritativePayableAmount(referenceType, referenceId);
  } catch (err: any) {
    if (clientAmount !== undefined && clientAmount !== null) {
      logger.warn('[PaymentController] Authoritative record not found in DB; falling back to client amount', {
        referenceType,
        referenceId,
        clientAmount,
      });
      authRecord = {
        amount: Number(clientAmount),
        currency: (clientCurrency || 'USD').toUpperCase(),
      };
    } else {
      throw err;
    }
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

  const payableAmount = authRecord.amount;
  const currencyCode = (authRecord.currency || clientCurrency).toUpperCase();
  const decimals = (CURRENCY_DECIMALS as Record<string, number>)[currencyCode] ?? 2;
  const multiplier = decimals === 0 ? 1 : (decimals === 3 ? 1000 : 100);
  const stripeMinorUnits = Math.round(payableAmount * multiplier);

  const stripe = await getStripeInstance();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripeMinorUnits,
    currency: currencyCode.toLowerCase(),
    metadata: {
      referenceType,
      referenceId,
      userId: req.user?.userId || 'guest',
      authoritativeAmount: String(payableAmount),
      authoritativeCurrency: currencyCode,
    },
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

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  if (!req.rawBody) { res.status(400).json({ error: 'Missing raw body' }); return; }

  let event: Stripe.Event;
  try {
    const stripe = await getStripeInstance();
    const webhookSecret = await getStripeWebhookSecret();
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  const supabase = getSupabase();

  switch (event.type) {

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const referenceType = normalizeReferenceType(paymentIntent.metadata.referenceType);
      const referenceId = paymentIntent.metadata.referenceId;

      // FIX BUG-01: Idempotency check via payment_ledger — only look for success entries.
      // We NEVER update payment_ledger (immutability trigger blocks it).
      // Pattern: check → process → insert success. No partial rows.
      const { data: existingLedger } = await supabase
        .from('payment_ledger')
        .select('id, status')
        .eq('webhook_id', event.id)
        .maybeSingle();

      if (existingLedger?.status === 'success') {
        logger.info(`Idempotency: Webhook ${event.id} already fully processed. Skipping.`);
        return res.json({ received: true });
      }

      // Use IdempotencyGuard + TransactionManager for atomic, compensable processing
      const idempotencyGuard = getIdempotencyGuard();
      const idempotencyKey = `stripe_webhook:${event.id}`;

      const processPaymentIntent = async () => {
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
              amount: (paymentIntent.amount / 100).toFixed(2),
              currency: paymentIntent.currency.toUpperCase(),
              method: 'card',
              status: 'completed',
              stripe_payment_intent_id: paymentIntent.id,
              stripe_charge_id: paymentIntent.latest_charge as string,
              processed_at: new Date().toISOString(),
            });

          if (paymentError) {
            logger.error('Failed to record payment:', paymentError);
          }
        }

        // Step 2: Update transaction/reference status
        await updateReferencePaymentStatus(referenceType, referenceId, 'paid');

        // Step 3: Award loyalty points
        await awardLoyaltyPointsForPayment(referenceType, referenceId, paymentIntent.amount / 100);

        // Step 4: FIX BUG-01 — INSERT a success ledger entry (never UPDATE)
        await supabase.from('payment_ledger').insert({
          reference_type: referenceType,
          reference_id: referenceId,
          event_type: 'authorized',
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
          gateway_reference_id: paymentIntent.id,
          webhook_id: event.id,
          status: 'success',
          metadata: { stripe_event_id: event.id },
        });

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
      const referenceType = normalizeReferenceType(paymentIntent.metadata.referenceType);
      const referenceId = paymentIntent.metadata.referenceId;

      await supabase.from('payments').insert({
        reference_type: referenceType,
        reference_id: referenceId,
        amount: (paymentIntent.amount / 100).toFixed(2),
        currency: paymentIntent.currency.toUpperCase(),
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
      const referenceType = normalizeReferenceType(paymentIntent.metadata.referenceType);
      const referenceId = paymentIntent.metadata.referenceId;

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
          .select('reference_type, reference_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (payment?.reference_type && payment?.reference_id) {
          await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, 'refunded');
        }

        // FIX BUG-01: INSERT only, never UPDATE
        await supabase.from('payment_ledger').insert({
          reference_type: payment?.reference_type || 'unknown',
          reference_id: payment?.reference_id || 'unknown',
          event_type: 'refund',
          amount: (charge.amount_refunded || 0) / 100,
          currency: charge.currency.toUpperCase(),
          gateway_reference_id: paymentIntentId,
          webhook_id: event.id,
          status: 'success',
          metadata: { stripe_event_id: event.id, refund_reason: charge.refunds?.data?.[0]?.reason },
        });

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
        .select('id, status, end_date, billing_cycle, user_id')
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
      // Status must stay lowercase — the engine state machine expects lowercase values.
      const nextStatus = transition.allowed ? transition.targetState : 'active';

      await supabase
        .from('pool_memberships')
        .update({
          status: nextStatus,
          end_date: renewedEndDate,
          renewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', membership.id);

      await supabase.from('audit_logs').insert({
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

async function updateReferencePaymentStatus(
  referenceType: string,
  referenceId: string,
  status: 'pending' | 'partial' | 'paid' | 'refunded' | 'payment_failed',
) {
  const supabase = getSupabase();

  const { data: tx } = await supabase
    .from('transactions')
    .select('reference_table')
    .eq('id', referenceId)
    .maybeSingle();

  if (tx?.reference_table) {
    await supabase
      .from(tx.reference_table)
      .update({ payment_status: status, updated_at: new Date().toISOString() })
      .eq('id', referenceId);
  }

  // Only update payment_status field on transactions, not the status field
  // (status is managed by the state machine)
  await supabase
    .from('transactions')
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq('id', referenceId);
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
async function resolveReferenceTenantProperty(referenceId: string): Promise<{ tenantId: string; propertyId: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transactions')
    .select('tenant_id, property_id')
    .eq('id', referenceId)
    .maybeSingle();
  if (error || !data?.tenant_id || !data?.property_id) {
    throw new Error(`Could not resolve tenant/property for reference ${referenceId}`);
  }
  return { tenantId: data.tenant_id, propertyId: data.property_id };
}

export const recordCashPayment = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(recordCashPaymentSchema, req.body);
  const { referenceType, referenceId, amount, notes } = validatedData;

  const supabase = getSupabase();

  // Previously never resolved/checked at all — any tenant's staff could
  // record a cash payment against another tenant's order, and the insert
  // was very likely failing outright on the NOT NULL tenant_id/property_id
  // columns regardless. See CONTEXT.md cross-tenant sweep.
  const { tenantId, propertyId } = await resolveReferenceTenantProperty(referenceId);
  if (!assertOwnedByCallerTenant(req, tenantId)) {
    return res.status(404).json({ success: false, error: 'Reference not found' });
  }

  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('method', 'cash')
    .eq('status', 'completed')
    .maybeSingle();

  if (existingPayment) {
    return res.status(409).json({
      success: false,
      error: 'A cash payment has already been recorded for this item',
      existingPaymentId: existingPayment.id,
    });
  }

  const { data: paymentSettings } = await supabase.from('site_settings').select('value').eq('key', 'payments').single();
  const defaultCurrency = paymentSettings?.value?.currency?.toUpperCase() || 'USD';

  const scoped = getScopedClient({ tenantId, actorId: req.user?.userId });
  const { data: payment, error } = await scoped.from('payments')
    .insert({
      reference_type: referenceType,
      reference_id: referenceId,
      amount: amount.toFixed(2),
      currency: defaultCurrency,
      method: 'cash',
      status: 'completed',
      processed_by: req.user!.userId,
      processed_at: new Date().toISOString(),
      notes,
      property_id: propertyId,
    })
    .select()
    .single();

  if (error) throw error;

  await updateReferencePaymentStatus(referenceType, referenceId, 'paid');

  res.status(201).json({ success: true, data: payment });
});

export const recordManualPayment = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(recordManualPaymentSchema, req.body);
  const { referenceType, referenceId, amount, method, notes } = validatedData;

  const supabase = getSupabase();

  // Same fix as recordCashPayment above.
  const { tenantId, propertyId } = await resolveReferenceTenantProperty(referenceId);
  if (!assertOwnedByCallerTenant(req, tenantId)) {
    return res.status(404).json({ success: false, error: 'Reference not found' });
  }

  const { data: paymentSettings } = await supabase.from('site_settings').select('value').eq('key', 'payments').single();
  const manualCurrency = paymentSettings?.value?.currency?.toUpperCase() || 'USD';

  // GAP-05 FIX: Whish and OMT cannot be auto-completed — they require
  // external confirmation. Staff must verify the transfer receipt and
  // explicitly confirm via PATCH /payments/:id/verify before funds are
  // considered received. Cash is the only non-card method with instant completion.
  const isManualTransfer = method === 'whish' || method === 'omt' || method === 'other_transfer';
  const paymentStatus = isManualTransfer ? 'pending_verification' : 'completed';
  const paymentNotes = isManualTransfer
    ? `[Awaiting ${method.toUpperCase()} transfer verification]${notes ? ' ' + notes : ''}`
    : notes;

  const scoped = getScopedClient({ tenantId, actorId: req.user?.userId });
  const { data: payment, error } = await scoped.from('payments')
    .insert({
      reference_type: referenceType,
      reference_id: referenceId,
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

  // Only advance reference to paid once cash is confirmed;
  // transfers stay at partial until staff verifies
  if (!isManualTransfer) {
    await updateReferencePaymentStatus(referenceType, referenceId, 'paid');
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

  await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, 'paid');

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

  // FIX: ownership check now also checks reference_id against userId (since customer_id doesn't exist)
  const isOwner = payment.reference_id === userId;

  // canViewAnyReceipt previously had no tenant check at all — any tenant's
  // admin/manager could view any OTHER tenant's receipt. A genuinely
  // unscoped super_admin (no tenantId on their own token) keeps the
  // existing cross-tenant bypass, matching the pattern used everywhere else
  // in this codebase; anyone else must match the payment's own tenant.
  const callerTenantId = getCallerTenantId(req);
  const tenantMismatch = canViewAnyReceipt && callerTenantId !== null && payment.tenant_id !== callerTenantId;

  if ((!canViewAnyReceipt && !isOwner) || tenantMismatch) {
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
): Promise<{ isPartial: boolean }> {
  const supabase = getSupabase();
  const client = tenantContext ? getScopedClient(tenantContext) : supabase;

  const { data: payment, error: fetchError } = await client.from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (fetchError || !payment) throw new Error('Payment record not found');
  if (payment.status === 'refunded') throw new Error('Payment is already refunded');

  const paymentAmount = parseFloat(payment.amount);
  const isPartialRefund = amount !== undefined && amount < paymentAmount;

  const refundDetails: Record<string, unknown> = {
    status: isPartialRefund ? 'partial' : 'refunded',
    notes: reason
      ? `${payment.notes || ''} [Refund Reason: ${reason}]${isPartialRefund ? ` [Partial: ${amount}]` : ''}`
      : payment.notes,
    processed_at: new Date().toISOString(),
    processed_by: processedByUserId,
  };

  if (payment.method === 'card' && payment.stripe_payment_intent_id) {
    const isTestPI = payment.stripe_payment_intent_id.startsWith('pi_test_') ||
      !payment.stripe_payment_intent_id.startsWith('pi_');

    if (!isTestPI) {
      const stripe = await getStripeInstance();
      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: 'requested_by_customer',
      });
      refundDetails.notes = `${refundDetails.notes || ''} [Stripe Refund ID: ${stripeRefund.id}]`;
    }
  }

  const { error: updateError } = await client
    .from('payments')
    .update(refundDetails)
    .eq('id', paymentId);

  if (updateError) throw updateError;

  const refStatus = isPartialRefund ? 'partial' as const : 'refunded' as const;
  await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, refStatus);

  // Give back whatever coupon/gift card the order consumed at creation (see
  // discount-reversal.ts). Previously a refund only touched Stripe + the
  // payments table + the order's payment_status — coupon usage counts and
  // gift card balances were never restored, refunded or not.
  //
  // Scoped to full refunds of order-type payments only: a partial refund
  // doesn't have an unambiguous rule for how much of a coupon/gift-card
  // discount to give back, and reversing the whole thing on a partial
  // refund would usually be wrong (e.g. a $5 refund on a $50 order with a
  // 20%-off coupon shouldn't restore the full discount). Left as a flagged
  // gap for partial refunds rather than guessed at.
  if (!isPartialRefund && payment.reference_type === 'order') {
    try {
      const { data: order } = await supabase
        .from('transactions')
        .select('id, customer_id, metadata')
        .eq('id', payment.reference_id)
        .maybeSingle();

      const orderMetadata = (order?.metadata ?? {}) as Record<string, unknown>;
      const alreadyReversed = Boolean(orderMetadata.discountsReversedAt);
      const discounts = Array.isArray((orderMetadata as { discounts?: unknown }).discounts)
        ? (orderMetadata as { discounts: any[] }).discounts
        : [];

      if (order && !alreadyReversed && discounts.length > 0) {
        await reverseDiscounts(supabase, discounts, {
          userId: order.customer_id ?? undefined,
          orderId: order.id,
        });
        await supabase
          .from('transactions')
          .update({ metadata: { ...orderMetadata, discountsReversedAt: new Date().toISOString() } })
          .eq('id', order.id);
      }
    } catch (reversalErr) {
      // Non-fatal: the refund itself already succeeded and must not be
      // rolled back over this. Logged at error level in reverseDiscounts()
      // itself/here since a failure here is a real, if secondary, money leak.
      logger.error('[Payments] Failed to reverse order discount usage after refund', {
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
    const { isPartial } = await processRefundById(id, amount, reason, req.user!.userId, tenantContextFor(req));
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
    .select('id, total_amount, amount, status, metadata, tenant_id, property_id, engine_type')
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
    .select('id, status, engine_type, metadata, tenant_id, property_id')
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

  const amount = Number(order.total_amount || order.amount || 0);

  // 3. Write charge entry to payment_ledger
  const { data: ledgerEntry, error: ledgerErr } = await supabase
    .from('payment_ledger')
    .insert({
      reference_type: 'room_folio',
      reference_id: bookingId,
      event_type: 'charge',
      amount: amount.toFixed(2),
      currency: 'USD',
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
  await supabase
    .from('payments')
    .insert({
      reference_type: 'order',
      reference_id: orderId,
      amount: amount.toFixed(2),
      currency: 'USD',
      method: 'room_charge',
      status: 'completed',
      processed_by: req.user!.userId,
      processed_at: new Date().toISOString(),
      notes: `Charged to Room Folio (Booking ${bookingId})`,
      tenant_id: order.tenant_id,
      property_id: order.property_id,
    });

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
    .select('id, tenant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  if (!assertOwnedByCallerTenant(req, booking.tenant_id)) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const { data: entries, error } = await supabase
    .from('payment_ledger')
    .select('*')
    .eq('reference_type', 'room_folio')
    .eq('reference_id', bookingId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const charges = (entries || []).filter((e) => e.event_type === 'charge');
  const settlements = (entries || []).filter((e) => e.event_type === 'settlement');

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
    .select('id, tenant_id, property_id')
    .eq('id', bookingId)
    .single();

  if (bookingErr || !booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  if (!assertOwnedByCallerTenant(req, booking.tenant_id)) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  // 1. Write settlement entry to payment_ledger
  const { data: ledgerEntry, error: ledgerErr } = await supabase
    .from('payment_ledger')
    .insert({
      reference_type: 'room_folio',
      reference_id: bookingId,
      event_type: 'settlement',
      amount: amount.toFixed(2),
      currency: 'USD',
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
      currency: 'USD',
      method,
      status: 'completed',
      processed_by: req.user!.userId,
      processed_at: new Date().toISOString(),
      notes: notes || `Room folio settlement via ${method}`,
      tenant_id: booking.tenant_id,
      property_id: booking.property_id,
    });

  // Calculate updated balance
  const { data: entries } = await supabase
    .from('payment_ledger')
    .select('event_type, amount')
    .eq('reference_type', 'room_folio')
    .eq('reference_id', bookingId)
    .eq('status', 'completed');

  const totalCharges = (entries || [])
    .filter((e) => e.event_type === 'charge')
    .reduce((acc, e) => acc + Number(e.amount), 0);
  const totalSettlements = (entries || [])
    .filter((e) => e.event_type === 'settlement')
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

