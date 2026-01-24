import { Request, Response, NextFunction } from 'express';
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

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    const stripe = await getStripeInstance();
    const webhookSecret = await getStripeWebhookSecret();
    event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
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
        .select('id')
        .eq('webhook_id', event.id)
        .maybeSingle();

      if (existingLedgerEntry) {
        logger.info(`Idempotency: Webhook ${event.id} already processed. Skipping.`);
        return res.json({ received: true });
      }

      // Record to Ledger First (Audit Trail)
      await supabase.from('payment_ledger').insert({
        reference_type: referenceType,
        reference_id: referenceId,
        event_type: 'authorized', // or 'captured' depending on intent status
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        gateway_reference_id: paymentIntent.id,
        webhook_id: event.id,
        status: 'success',
        metadata: { stripe_event_id: event.id }
      });

      // Check existing payment record (Legacy/Status check)
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle();

      if (existingPayment) {
        logger.info(`Payment ${paymentIntent.id} already recorded in status table. Skipping update.`);
        break;
      }

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
      }

      // Update order/booking payment status
      await updateReferencePaymentStatus(referenceType, referenceId, 'paid');

      // Award loyalty points for successful payment
      const amountDollars = paymentIntent.amount / 100;
      await awardLoyaltyPointsForPayment(referenceType, referenceId, amountDollars);

      logger.info(`Payment succeeded for ${referenceType}:${referenceId}`);
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

export async function recordCashPayment(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate input
    const validatedData = validateBody(recordCashPaymentSchema, req.body);
    const { referenceType, referenceId, amount, notes } = validatedData;

    const supabase = getSupabase();

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        reference_type: referenceType,
        reference_id: referenceId,
        amount: amount.toFixed(2),
        currency: 'USD',
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
  } catch (error) {
    next(error);
  }
}

export async function recordManualPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = validateBody(recordManualPaymentSchema, req.body);
    const { referenceType, referenceId, amount, method, notes } = validatedData;

    const supabase = getSupabase();

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        reference_type: referenceType,
        reference_id: referenceId,
        amount: amount.toFixed(2),
        currency: 'USD',
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
  } catch (error) {
    next(error);
  }
}

export async function getPaymentMethods(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { limit = 50, offset = 0 } = req.query;

    const { data: transactions, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    res.json({ success: true, data: transactions || [] });
  } catch (error) {
    next(error);
  }
}

export async function getTransaction(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function refundPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { reason, amount } = req.body; // amount is optional, if not provided, full refund

    // Get original payment
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    if (payment.status === 'refunded') {
      return res.status(400).json({ success: false, error: 'Payment is already refunded' });
    }

    interface RefundDetails {
      status: string;
      notes: string | null;
      processed_at: string;
      processed_by: string;
    }

    const refundDetails: RefundDetails = {
      status: 'refunded',
      notes: reason ? `${payment.notes || ''} [Refund Reason: ${reason}]` : payment.notes,
      processed_at: new Date().toISOString(),
      processed_by: req.user!.userId,
    };

    // If it's a Stripe payment, trigger Stripe refund
    if (payment.method === 'card' && payment.stripe_payment_intent_id) {
      // Skip Stripe refund for test/fake payment intents
      const isTestPaymentIntent = payment.stripe_payment_intent_id.startsWith('pi_test_') || 
                                   !payment.stripe_payment_intent_id.startsWith('pi_');
      
      if (!isTestPaymentIntent) {
        try {
          const stripe = await getStripeInstance();
          const stripeRefund = await stripe.refunds.create({
            payment_intent: payment.stripe_payment_intent_id,
            amount: amount ? Math.round(amount * 100) : undefined,
            reason: 'requested_by_customer', // Default reason
          });
          refundDetails.notes = `${refundDetails.notes || ''} [Stripe Refund ID: ${stripeRefund.id}]`;
        } catch (stripeError: unknown) {
          const err = stripeError as Error;
          logger.error('Stripe refund failed:', stripeError);
          return res.status(400).json({ success: false, error: `Stripe refund failed: ${err.message}` });
        }
      } else {
        // For test payments, just mark as refunded without calling Stripe
        refundDetails.notes = `${refundDetails.notes || ''} [Test Payment - No Stripe Refund Required]`;
        logger.info(`Skipping Stripe refund for test payment intent: ${payment.stripe_payment_intent_id}`);
      }
    }

    // Update payment record
    const { error: updateError } = await supabase
      .from('payments')
      .update(refundDetails)
      .eq('id', id);

    if (updateError) throw updateError;

    // Update source reference (Order/Booking)
    await updateReferencePaymentStatus(payment.reference_type, payment.reference_id, 'refunded');

    res.json({ success: true, message: 'Payment refunded successfully' });
  } catch (error) {
    next(error);
  }
}
