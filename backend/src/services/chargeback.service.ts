/**
 * V2 Resort - Chargeback Handling Service
 * Manages Stripe disputes and chargeback workflows
 */

import Stripe from 'stripe';
import { supabase } from '../lib/supabase';
import { emailService } from './email.service';
import { activityLogger } from '../utils/activityLogger';
import { logger } from '../utils/logger';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export interface Chargeback {
  id: string;
  payment_id: string;
  stripe_dispute_id: string;
  stripe_charge_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: ChargebackStatus;
  evidence_submitted: ChargebackEvidence | null;
  due_date: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  outcome: ChargebackOutcome | null;
}

export type ChargebackStatus = 
  | 'needs_response'
  | 'under_review'
  | 'charge_refunded'
  | 'won'
  | 'lost';

export type ChargebackOutcome = 'won' | 'lost' | 'refunded';

export interface ChargebackEvidence {
  customer_name?: string;
  customer_email?: string;
  billing_address?: string;
  product_description?: string;
  service_date?: string;
  receipt?: string;
  customer_signature?: string;
  customer_communication?: string;
  refund_policy?: string;
  refund_policy_disclosure?: string;
  uncategorized_text?: string;
  access_activity_log?: string;
  submitted_at?: string;
}

class ChargebackService {
  /**
   * Handle incoming Stripe dispute webhook
   */
  async handleDisputeCreated(dispute: Stripe.Dispute): Promise<Chargeback> {
    logger.info(`[ChargebackService] New dispute created: ${dispute.id}`);

    // Find the original payment
    const { data: payment, error: paymentError } = await supabase
      .from('payment_ledger')
      .select('*')
      .eq('stripe_payment_intent_id', dispute.payment_intent)
      .single();

    if (paymentError || !payment) {
      logger.error(`[ChargebackService] Payment not found for dispute: ${dispute.id}`);
      throw new Error(`Payment not found for charge ${dispute.charge}`);
    }

    // Create chargeback record
    const chargebackData = {
      payment_id: payment.id,
      stripe_dispute_id: dispute.id,
      stripe_charge_id: dispute.charge as string,
      amount: dispute.amount / 100, // Convert from cents
      currency: dispute.currency.toUpperCase(),
      reason: dispute.reason,
      status: 'needs_response' as ChargebackStatus,
      due_date: new Date(dispute.evidence_details.due_by * 1000).toISOString(),
      evidence_submitted: null,
      outcome: null,
    };

    const { data: chargeback, error: insertError } = await supabase
      .from('chargebacks')
      .insert(chargebackData)
      .select()
      .single();

    if (insertError) {
      logger.error('[ChargebackService] Failed to create chargeback:', insertError);
      throw insertError;
    }

    // Send alert to admin
    await this.alertAdmin(chargeback, payment);

    // Log activity
    await activityLogger.log({
      action: 'chargeback_created',
      entity_type: 'chargeback',
      entity_id: chargeback.id,
      details: {
        dispute_id: dispute.id,
        amount: chargebackData.amount,
        reason: dispute.reason,
      },
    });

    return chargeback;
  }

  /**
   * Handle dispute updated webhook
   */
  async handleDisputeUpdated(dispute: Stripe.Dispute): Promise<Chargeback | null> {
    logger.info(`[ChargebackService] Dispute updated: ${dispute.id}`);

    // Find chargeback record
    const { data: chargeback, error } = await supabase
      .from('chargebacks')
      .select('*')
      .eq('stripe_dispute_id', dispute.id)
      .single();

    if (error || !chargeback) {
      logger.error(`[ChargebackService] Chargeback not found: ${dispute.id}`);
      return null;
    }

    // Map Stripe status to our status
    let status: ChargebackStatus = chargeback.status;
    let outcome: ChargebackOutcome | null = null;

    switch (dispute.status) {
      case 'needs_response':
        status = 'needs_response';
        break;
      case 'under_review':
        status = 'under_review';
        break;
      case 'charge_refunded':
        status = 'charge_refunded';
        outcome = 'refunded';
        break;
      case 'won':
        status = 'won';
        outcome = 'won';
        break;
      case 'lost':
        status = 'lost';
        outcome = 'lost';
        break;
    }

    // Update record
    const { data: updated, error: updateError } = await supabase
      .from('chargebacks')
      .update({
        status,
        outcome,
        resolved_at: outcome ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chargeback.id)
      .select()
      .single();

    if (updateError) {
      logger.error('[ChargebackService] Failed to update chargeback:', updateError);
      throw updateError;
    }

    // Log activity
    await activityLogger.log({
      action: 'chargeback_status_updated',
      entity_type: 'chargeback',
      entity_id: chargeback.id,
      details: {
        old_status: chargeback.status,
        new_status: status,
        outcome,
      },
    });

    // Notify admin if resolved
    if (outcome) {
      await this.notifyOutcome(updated);
    }

    return updated;
  }

  /**
   * Submit evidence for a chargeback
   */
  async submitEvidence(
    chargebackId: string,
    evidence: ChargebackEvidence,
    adminUserId: string
  ): Promise<Chargeback> {
    // Get chargeback
    const { data: chargeback, error } = await supabase
      .from('chargebacks')
      .select('*')
      .eq('id', chargebackId)
      .single();

    if (error || !chargeback) {
      throw new Error('Chargeback not found');
    }

    if (chargeback.status !== 'needs_response') {
      throw new Error('Cannot submit evidence for this dispute');
    }

    // Prepare evidence for Stripe
    const stripeEvidence: Stripe.DisputeUpdateParams.Evidence = {
      customer_name: evidence.customer_name,
      customer_email_address: evidence.customer_email,
      billing_address: evidence.billing_address,
      product_description: evidence.product_description,
      service_date: evidence.service_date,
      receipt: evidence.receipt,
      customer_signature: evidence.customer_signature,
      customer_communication: evidence.customer_communication,
      refund_policy: evidence.refund_policy,
      refund_policy_disclosure: evidence.refund_policy_disclosure,
      uncategorized_text: evidence.uncategorized_text,
      access_activity_log: evidence.access_activity_log,
    };

    // Submit to Stripe
    try {
      await stripe.disputes.update(chargeback.stripe_dispute_id, {
        evidence: stripeEvidence,
        submit: true, // This submits the evidence
      });
    } catch (stripeError: any) {
      logger.error('[ChargebackService] Failed to submit evidence to Stripe:', stripeError);
      throw new Error(`Stripe error: ${stripeError.message}`);
    }

    // Update our record
    const { data: updated, error: updateError } = await supabase
      .from('chargebacks')
      .update({
        status: 'under_review',
        evidence_submitted: {
          ...evidence,
          submitted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', chargebackId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log activity
    await activityLogger.log({
      action: 'chargeback_evidence_submitted',
      entity_type: 'chargeback',
      entity_id: chargebackId,
      user_id: adminUserId,
      details: {
        evidence_fields: Object.keys(evidence),
      },
    });

    return updated;
  }

  /**
   * Get chargeback by ID
   */
  async getById(chargebackId: string): Promise<Chargeback | null> {
    const { data, error } = await supabase
      .from('chargebacks')
      .select(`
        *,
        payment:payment_ledger(
          id,
          user_id,
          amount,
          description,
          stripe_payment_intent_id
        )
      `)
      .eq('id', chargebackId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * List all chargebacks with filters
   */
  async list(filters: {
    status?: ChargebackStatus;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Chargeback[]; total: number }> {
    let query = supabase
      .from('chargebacks')
      .select(`
        *,
        payment:payment_ledger(
          id,
          user_id,
          amount,
          description
        )
      `, { count: 'exact' });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.from_date) {
      query = query.gte('created_at', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(
        filters.offset || 0,
        (filters.offset || 0) + (filters.limit || 20) - 1
      );

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
    };
  }

  /**
   * Get chargeback statistics
   */
  async getStats(period: 'month' | 'quarter' | 'year' = 'month'): Promise<{
    total_count: number;
    total_amount: number;
    needs_response: number;
    under_review: number;
    won: number;
    lost: number;
    win_rate: number;
    average_amount: number;
  }> {
    const now = new Date();
    let fromDate: Date;

    switch (period) {
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        fromDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const { data, error } = await supabase
      .from('chargebacks')
      .select('status, outcome, amount')
      .gte('created_at', fromDate.toISOString());

    if (error) {
      throw error;
    }

    interface ChargebackRecord {
      amount?: number;
      status?: string;
      outcome?: string;
    }

    const stats = {
      total_count: data.length,
      total_amount: data.reduce((sum: number, c: ChargebackRecord) => sum + (c.amount || 0), 0),
      needs_response: data.filter((c: ChargebackRecord) => c.status === 'needs_response').length,
      under_review: data.filter((c: ChargebackRecord) => c.status === 'under_review').length,
      won: data.filter((c: ChargebackRecord) => c.outcome === 'won').length,
      lost: data.filter((c: ChargebackRecord) => c.outcome === 'lost').length,
      win_rate: 0,
      average_amount: 0,
    };

    const resolved = stats.won + stats.lost;
    if (resolved > 0) {
      stats.win_rate = (stats.won / resolved) * 100;
    }

    if (stats.total_count > 0) {
      stats.average_amount = stats.total_amount / stats.total_count;
    }

    return stats;
  }

  /**
   * Alert admin about new chargeback
   */
  private async alertAdmin(chargeback: Chargeback, payment: any): Promise<void> {
    const dueDate = new Date(chargeback.due_date);
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    await emailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@v2resort.com',
      subject: `[URGENT] New Chargeback Dispute - ${chargeback.amount} ${chargeback.currency}`,
      template: 'admin-chargeback-alert',
      data: {
        chargeback_id: chargeback.id,
        dispute_id: chargeback.stripe_dispute_id,
        amount: chargeback.amount,
        currency: chargeback.currency,
        reason: chargeback.reason,
        due_date: dueDate.toLocaleDateString(),
        days_remaining: daysRemaining,
        payment_description: payment.description,
        admin_url: `${process.env.FRONTEND_URL}/admin/payments/chargebacks/${chargeback.id}`,
      },
    });
  }

  /**
   * Notify admin of chargeback outcome
   */
  private async notifyOutcome(chargeback: Chargeback): Promise<void> {
    const subject = chargeback.outcome === 'won'
      ? `[Resolved - WON] Chargeback ${chargeback.id}`
      : `[Resolved - LOST] Chargeback ${chargeback.id}`;

    await emailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@v2resort.com',
      subject,
      template: 'admin-chargeback-outcome',
      data: {
        chargeback_id: chargeback.id,
        outcome: chargeback.outcome,
        amount: chargeback.amount,
        currency: chargeback.currency,
        reason: chargeback.reason,
      },
    });
  }

  /**
   * Generate evidence template based on reason
   */
  getEvidenceTemplate(reason: string): Partial<ChargebackEvidence> {
    const templates: Record<string, Partial<ChargebackEvidence>> = {
      fraudulent: {
        uncategorized_text: 'The customer authorized this transaction...',
        access_activity_log: 'Customer activity log showing legitimate access...',
      },
      duplicate: {
        product_description: 'This was not a duplicate charge...',
        uncategorized_text: 'Transaction details showing unique purchase...',
      },
      subscription_canceled: {
        refund_policy: 'Our cancellation policy states...',
        refund_policy_disclosure: 'Policy was disclosed at time of purchase...',
      },
      product_not_received: {
        service_date: 'Service was provided on...',
        customer_communication: 'Customer acknowledged receipt via...',
      },
      product_unacceptable: {
        product_description: 'The service/product met all stated specifications...',
        customer_communication: 'We offered resolution options...',
      },
      credit_not_processed: {
        refund_policy: 'Our refund policy states...',
        customer_communication: 'Refund was processed on...',
      },
      general: {
        uncategorized_text: 'This transaction was legitimate...',
      },
    };

    return templates[reason] || templates['general'];
  }
}

export const chargebackService = new ChargebackService();
