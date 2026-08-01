import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import Stripe from 'stripe';
import { getSupabase } from "../../database/connection.js";
import { config } from "../../config/index";
import { logger } from "../../utils/logger.js";
import { createPaymentIntentSchema, recordCashPaymentSchema, recordManualPaymentSchema, validateBody } from "../../validation/schemas.js";
import { awardLoyaltyPointsForPayment } from './loyalty-integration.js';
import { getEngineService } from '../../engines/engine-service.js';
import { normalizeReferenceType } from './reference-type-adapter.js';
import { getTransactionManager } from '../../engines/transaction-manager.js';
import { getIdempotencyGuard } from '../../engines/idempotency-guard.js';

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

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(createPaymentIntentSchema, req.body);
  const { amount, currency = 'usd', referenceType, referenceId } = validatedData;

  const supabase = getSupabase();
  const { data: settings } = await supabase.from('site_settings').select('value').eq('key', 'payments').single();
  const defaultCurrency = settings?.value?.currency?.toLowerCase() || currency;

  const stripe = await getStripeInstance();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: defaultCurrency,
    metadata: {
      referenceType,
      referenceId,
      userId: req.user?.userId || 'guest',
    },
  });

  res.json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
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

export const recordCashPayment = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(recordCashPaymentSchema, req.body);
  const { referenceType, referenceId, amount, notes } = validatedData;

  const supabase = getSupabase();

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

  const { data: payment, error } = await supabase
    .from('payments')
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

  const { data: payment, error } = await supabase
    .from('payments')
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
  const supabase = getSupabase();

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !payment) return res.status(404).json({ success: false, error: 'Payment not found' });
  if (payment.status !== 'pending_verification') {
    return res.status(400).json({ success: false, error: `Payment is not pending verification (status: ${payment.status})` });
  }

  const { error: updateError } = await supabase
    .from('payments')
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
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = req.query;

  const { data: transactions, error } = await supabase
    .from('payments')
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
  const supabase = getSupabase();
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ success: false, error: 'Transaction not found' });
    throw error;
  }

  res.json({ success: true, data: payment });
});

export async function processRefundById(
  paymentId: string,
  amount: number | undefined,
  reason: string | undefined,
  processedByUserId: string,
): Promise<{ isPartial: boolean }> {
  const supabase = getSupabase();

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

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

  const { error: updateError } = await supabase
    .from('payments')
    .update(refundDetails)
    .eq('id', paymentId);

  if (updateError) throw updateError;

  const refStatus = isPartialRefund ? 'partial' as const : 'refunded' as const;
  await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, refStatus);

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
    const { isPartial } = await processRefundById(id, amount, reason, req.user!.userId);
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
