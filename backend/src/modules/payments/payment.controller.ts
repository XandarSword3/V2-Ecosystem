import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import Stripe from 'stripe';
import { getSupabase } from "../../database/connection.js";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { createPaymentIntentSchema, recordCashPaymentSchema, recordManualPaymentSchema, validateBody } from "../../validation/schemas.js";
import { awardLoyaltyPointsForPayment } from './loyalty-integration.js';

const getStripeInstance = async () => {
  const supabase = getSupabase();
  const { data: settings } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'payments')
    .single();

  const secretKey = settings?.value?.stripeSecretKey || config.stripe.secretKey;

  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }

  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
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

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  // Validate input
  const validatedData = validateBody(createPaymentIntentSchema, req.body);
  const { amount, currency = 'usd', referenceType, referenceId } = validatedData;

  const supabase = getSupabase();
  const { data: settings } = await supabase.from('site_settings').select('value').eq('key', 'payments').single();
  const defaultCurrency = settings?.value?.currency?.toLowerCase() || currency;

  const stripe = await getStripeInstance();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
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
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret
    );
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  const supabase = getSupabase();

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { referenceType, referenceId } = paymentIntent.metadata;

      // Idempotency check: prevent duplicate processing via Ledger
      const { data: existingLedgerEntry } = await supabase
        .from('payment_ledger')
        .select('id, status')
        .eq('webhook_id', event.id)
        .maybeSingle();

      // If ledger entry exists AND is fully successful, skip entirely
      if (existingLedgerEntry && existingLedgerEntry.status === 'success') {
        logger.info(`Idempotency: Webhook ${event.id} already fully processed. Skipping.`);
        return res.json({ received: true });
      }

      // If ledger entry exists but is 'partial', we need to retry the remaining operations
      const isRetry = existingLedgerEntry?.status === 'partial';

      // Record to Ledger First (Audit Trail) — only on first attempt
      if (!existingLedgerEntry) {
        await supabase.from('payment_ledger').insert({
          reference_type: referenceType,
          reference_id: referenceId,
          event_type: 'authorized',
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
          gateway_reference_id: paymentIntent.id,
          webhook_id: event.id,
          status: 'partial', // Start as partial; upgrade to success after all ops complete
          metadata: { stripe_event_id: event.id }
        });
      }

      try {
        // Check existing payment record (Legacy/Status check)
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .maybeSingle();

        if (!existingPayment) {
          // Record payment
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
            // Don't throw — the payment insert might fail due to unique constraint on retry
          }
        }

        // Update order/booking payment status
        await updateReferencePaymentStatus(referenceType, referenceId, 'paid');

        // Award loyalty points for successful payment
        const amountDollars = paymentIntent.amount / 100;
        await awardLoyaltyPointsForPayment(referenceType, referenceId, amountDollars);

        // All operations succeeded — mark ledger as fully successful
        await supabase
          .from('payment_ledger')
          .update({ status: 'success' })
          .eq('webhook_id', event.id);

        logger.info(`Payment succeeded for ${referenceType}:${referenceId}${isRetry ? ' (retry)' : ''}`);
      } catch (opError) {
        // Operations failed after ledger insert — ledger stays 'partial'
        // Return 500 so Stripe retries this webhook
        logger.error(`Webhook ${event.id} partially failed, will retry:`, opError);
        return res.status(500).json({ error: 'Partial processing failure, please retry' });
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { referenceType, referenceId } = paymentIntent.metadata;

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          reference_type: referenceType,
          reference_id: referenceId,
          amount: (paymentIntent.amount / 100).toFixed(2),
          currency: paymentIntent.currency.toUpperCase(),
          method: 'card',
          status: 'failed',
          stripe_payment_intent_id: paymentIntent.id,
          notes: paymentIntent.last_payment_error?.message,
        });

      if (paymentError) {
        logger.error('Failed to record failed payment:', paymentError);
      }

      logger.warn(`Payment failed for ${referenceType}:${referenceId}`);
      break;
    }

    // FIX: Iteration 13 - Handle refunds issued from Stripe Dashboard
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      if (paymentIntentId) {
        // Update payment record to refunded
        await supabase
          .from('payments')
          .update({ status: 'refunded', notes: `Refunded via Stripe (${event.id})` })
          .eq('stripe_payment_intent_id', paymentIntentId);

        // Update reference status (booking/order)
        const { data: payment } = await supabase
          .from('payments')
          .select('reference_type, reference_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (payment?.reference_type && payment?.reference_id) {
          await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, 'refunded');
        }

        // Record to ledger
        await supabase.from('payment_ledger').insert({
          reference_type: payment?.reference_type || 'unknown',
          reference_id: payment?.reference_id || 'unknown',
          event_type: 'refund',
          amount: (charge.amount_refunded || 0) / 100,
          currency: charge.currency.toUpperCase(),
          gateway_reference_id: paymentIntentId,
          webhook_id: event.id,
          status: 'success',
          metadata: { stripe_event_id: event.id, refund_reason: charge.refunds?.data?.[0]?.reason }
        });

        logger.info(`Charge refunded for PI:${paymentIntentId}`);
      }
      break;
    }
  }

  res.json({ received: true });
}

async function updateReferencePaymentStatus(
  referenceType: string,
  referenceId: string,
  status: 'pending' | 'partial' | 'paid' | 'refunded'
) {
  const supabase = getSupabase();

  switch (referenceType) {
    case 'restaurant_order':
      await supabase
        .from('restaurant_orders')
        .update({ payment_status: status, updated_at: new Date().toISOString() })
        .eq('id', referenceId);
      break;
    case 'snack_order':
      await supabase
        .from('snack_orders')
        .update({ payment_status: status, updated_at: new Date().toISOString() })
        .eq('id', referenceId);
      break;
    case 'chalet_booking':
      await supabase
        .from('chalet_bookings')
        .update({ payment_status: status, updated_at: new Date().toISOString() })
        .eq('id', referenceId);
      break;
    case 'pool_ticket':
      await supabase
        .from('pool_tickets')
        .update({ payment_status: status, updated_at: new Date().toISOString() })
        .eq('id', referenceId);
      break;
  }
}

export const recordCashPayment = asyncHandler(async (req: Request, res: Response) => {
  // Validate input
  const validatedData = validateBody(recordCashPaymentSchema, req.body);
  const { referenceType, referenceId, amount, notes } = validatedData;

  const supabase = getSupabase();

  // Idempotency check: prevent duplicate cash payment for same reference
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('method', 'cash')
    .eq('status', 'completed')
    .maybeSingle();

  if (existingPayment) {
    logger.warn(`Duplicate cash payment attempt for ${referenceType}:${referenceId}`);
    return res.status(409).json({
      success: false,
      error: 'A cash payment has already been recorded for this item',
      existingPaymentId: existingPayment.id,
    });
  }

  // FIX: Iteration 13 - Fetch configured currency instead of hardcoding 'USD'
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

  // Update reference payment status
  await updateReferencePaymentStatus(referenceType, referenceId, 'paid');

  res.status(201).json({ success: true, data: payment });
});

export const recordManualPayment = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = validateBody(recordManualPaymentSchema, req.body);
  const { referenceType, referenceId, amount, method, notes } = validatedData;

  const supabase = getSupabase();

  // FIX: Iteration 13 - Fetch configured currency instead of hardcoding 'USD'
  const { data: paymentSettings } = await supabase.from('site_settings').select('value').eq('key', 'payments').single();
  const manualCurrency = paymentSettings?.value?.currency?.toUpperCase() || 'USD';

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      reference_type: referenceType,
      reference_id: referenceId,
      amount: amount.toFixed(2),
      currency: manualCurrency,
      method: method,
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

export const getPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  // For now, return supported methods
  res.json({
    success: true,
    data: [
      { id: 'cash', name: 'Cash', enabled: true },
      { id: 'card', name: 'Credit/Debit Card', enabled: !!config.stripe.secretKey },
      { id: 'whish', name: 'Whish Money Transfer', enabled: true },
      { id: 'omt', name: 'OMT Money Transfer', enabled: true },
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

export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    throw error;
  }

  res.json({ success: true, data: payment });
});

/**
 * Shared refund service — called by both the HTTP handler and the approval controller.
 * Looks up the payment by ID, calls Stripe if needed, updates the DB.
 * Throws on error so callers can handle HTTP responses appropriately.
 */
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

  // Execute Stripe refund for card payments
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
    } else {
      refundDetails.notes = `${refundDetails.notes || ''} [Test Payment - No Stripe Refund Required]`;
      logger.info(`Skipping Stripe refund for test PI: ${payment.stripe_payment_intent_id}`);
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

/**
 * Find payment record by reference (for approval-triggered refunds where we
 * have a reference_type + reference_id but not a payment ID).
 */
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
