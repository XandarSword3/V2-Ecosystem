import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { getSupabase } from "../../database/connection.js";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { createPaymentIntentSchema, recordCashPaymentSchema, recordManualPaymentSchema, validateBody } from "../../validation/schemas.js";

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate input
    const validatedData = validateBody(createPaymentIntentSchema, req.body);
    const { amount, currency = 'usd', referenceType, referenceId } = validatedData;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency as string,
      metadata: {
        referenceType,
        referenceId,
        userId: req.user!.userId,
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
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err: any) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = getSupabase();

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { referenceType, referenceId } = paymentIntent.metadata;

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
