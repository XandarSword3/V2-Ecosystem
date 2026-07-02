/**
 * V2 Ecosystem - Webhook Retry Service
 * Handles failed webhook processing with exponential backoff
 */

import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { activityLogger } from '../utils/activityLogger.js';
import { logger } from '../utils/logger.js';

export interface WebhookFailure {
  id: string;
  event_type: string;
  event_id: string;
  source: 'stripe' | 'twilio' | 'sendgrid' | 'other';
  payload: Record<string, any>;
  error_message: string;
  error_stack?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  status: WebhookStatus;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WebhookStatus =
  | 'pending'
  | 'retrying'
  | 'resolved'
  | 'failed'
  | 'manual_review';

// Retry delays in milliseconds (exponential backoff)
const RETRY_DELAYS = [
  60 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

type WebhookHandler = (payload: any) => Promise<void>;

class WebhookRetryService {
  private handlers: Map<string, WebhookHandler> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  registerHandler(eventType: string, handler: WebhookHandler): void {
    this.handlers.set(eventType, handler);
    logger.info(`[WebhookRetry] Handler registered for: ${eventType}`);
  }

  async recordFailure(
    source: WebhookFailure['source'],
    eventType: string,
    eventId: string,
    payload: Record<string, any>,
    error: Error
  ): Promise<WebhookFailure> {
    logger.info(`[WebhookRetry] Recording failure for ${eventType} (${eventId})`);

    const failureData = {
      event_type: eventType,
      event_id: eventId,
      source,
      payload,
      error_message: error.message,
      error_stack: error.stack,
      retry_count: 0,
      max_retries: RETRY_DELAYS.length,
      next_retry_at: new Date(Date.now() + RETRY_DELAYS[0]).toISOString(),
      status: 'pending' as WebhookStatus,
    };

    const { data, error: insertError } = await supabase
      .from('webhook_failures')
      .insert(failureData)
      .select()
      .single();

    if (insertError) {
      logger.error('[WebhookRetry] Failed to record webhook failure:', insertError);
      throw insertError;
    }

    await activityLogger.log({
      action: 'webhook_failed',
      entity_type: 'webhook',
      entity_id: data.id,
      details: { event_type: eventType, event_id: eventId, source, error: error.message },
    });

    return data;
  }

  async processFailure(failure: WebhookFailure): Promise<boolean> {
    logger.info(`[WebhookRetry] Processing failure: ${failure.id}`);

    await supabase
      .from('webhook_failures')
      .update({ status: 'retrying', updated_at: new Date().toISOString() })
      .eq('id', failure.id);

    const handler = this.handlers.get(failure.event_type);
    if (!handler) {
      logger.error(`[WebhookRetry] No handler for event type: ${failure.event_type}`);
      await this.markForManualReview(failure.id, 'No handler registered');
      return false;
    }

    try {
      await handler(failure.payload);

      await supabase
        .from('webhook_failures')
        .update({
          status: 'resolved',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', failure.id);

      logger.info(`[WebhookRetry] Successfully processed: ${failure.id}`);

      await activityLogger.log({
        action: 'webhook_retry_success',
        entity_type: 'webhook',
        entity_id: failure.id,
        details: { event_type: failure.event_type, retry_count: failure.retry_count + 1 },
      });

      return true;
    } catch (error: any) {
      logger.error(`[WebhookRetry] Retry failed: ${failure.id} - ${error.message}`);

      const newRetryCount = failure.retry_count + 1;

      if (newRetryCount >= failure.max_retries) {
        await this.markAsFailed(failure.id, error.message);
        await this.alertMaxRetriesExceeded(failure);
        return false;
      }

      const nextDelay = RETRY_DELAYS[newRetryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

      await supabase
        .from('webhook_failures')
        .update({
          status: 'pending',
          retry_count: newRetryCount,
          next_retry_at: new Date(Date.now() + nextDelay).toISOString(),
          error_message: error.message,
          error_stack: error.stack,
          updated_at: new Date().toISOString(),
        })
        .eq('id', failure.id);

      logger.info(`[WebhookRetry] Scheduled retry ${newRetryCount + 1} for: ${failure.id}`);
      return false;
    }
  }

  async processPendingRetries(): Promise<{ processed: number; succeeded: number }> {
    if (this.isProcessing) return { processed: 0, succeeded: 0 };

    this.isProcessing = true;
    let processed = 0;
    let succeeded = 0;

    try {
      const { data: failures, error } = await supabase
        .from('webhook_failures')
        .select('*')
        .eq('status', 'pending')
        .lte('next_retry_at', new Date().toISOString())
        .order('next_retry_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      if (!failures || failures.length === 0) return { processed: 0, succeeded: 0 };

      logger.info(`[WebhookRetry] Found ${failures.length} pending retries`);

      for (const failure of failures) {
        const success = await this.processFailure(failure);
        processed++;
        if (success) succeeded++;
      }
    } finally {
      this.isProcessing = false;
    }

    return { processed, succeeded };
  }

  async manualRetry(failureId: string, adminUserId: string): Promise<boolean> {
    const { data: failure, error } = await supabase
      .from('webhook_failures')
      .select('*')
      .eq('id', failureId)
      .single();

    if (error || !failure) throw new Error('Webhook failure not found');
    if (failure.status === 'resolved') throw new Error('This webhook has already been processed');

    await activityLogger.log({
      action: 'webhook_manual_retry',
      entity_type: 'webhook',
      entity_id: failureId,
      user_id: adminUserId,
    });

    await supabase
      .from('webhook_failures')
      .update({
        retry_count: failure.retry_count,
        status: 'pending',
        next_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', failureId);

    return this.processFailure(failure);
  }

  private async markForManualReview(failureId: string, reason: string): Promise<void> {
    await supabase
      .from('webhook_failures')
      .update({ status: 'manual_review', error_message: reason, updated_at: new Date().toISOString() })
      .eq('id', failureId);
  }

  private async markAsFailed(failureId: string, lastError: string): Promise<void> {
    await supabase
      .from('webhook_failures')
      .update({
        status: 'failed',
        error_message: `Max retries exceeded. Last error: ${lastError}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', failureId);
  }

  private async alertMaxRetriesExceeded(failure: WebhookFailure): Promise<void> {
    const { emailService } = await import('./email.service.js');
    await emailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@v2ecosystem.com',
      subject: `[Alert] Webhook Failed After ${failure.max_retries} Retries`,
      template: 'admin-webhook-failure',
      data: {
        failure_id: failure.id,
        event_type: failure.event_type,
        event_id: failure.event_id,
        source: failure.source,
        error_message: failure.error_message,
        retry_count: failure.retry_count,
        admin_url: `${process.env.FRONTEND_URL}/admin/payments/webhooks/${failure.id}`,
      },
    });
  }

  async getStats(): Promise<{
    pending: number;
    retrying: number;
    resolved: number;
    failed: number;
    manual_review: number;
    by_source: Record<string, number>;
    by_event_type: Record<string, number>;
  }> {
    const { data: failures, error } = await supabase
      .from('webhook_failures')
      .select('status, source, event_type');

    if (error) throw error;

    const stats = {
      pending: 0, retrying: 0, resolved: 0, failed: 0, manual_review: 0,
      by_source: {} as Record<string, number>,
      by_event_type: {} as Record<string, number>,
    };

    for (const failure of failures || []) {
      stats[failure.status as keyof typeof stats]++;
      const source = failure.source || 'unknown';
      stats.by_source[source] = (stats.by_source[source] || 0) + 1;
      if (failure.status !== 'resolved') {
        stats.by_event_type[failure.event_type] = (stats.by_event_type[failure.event_type] || 0) + 1;
      }
    }

    return stats;
  }

  async list(filters: {
    status?: WebhookStatus;
    source?: string;
    event_type?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: WebhookFailure[]; total: number }> {
    let query = supabase.from('webhook_failures').select('*', { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.source) query = query.eq('source', filters.source);
    if (filters.event_type) query = query.eq('event_type', filters.event_type);
    if (filters.from_date) query = query.gte('created_at', filters.from_date);
    if (filters.to_date) query = query.lte('created_at', filters.to_date);

    query = query
      .order('created_at', { ascending: false })
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20) - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { data: data || [], total: count || 0 };
  }

  startBackgroundProcessing(intervalMs: number = 60000): void {
    if (this.processingInterval) return;
    logger.info('[WebhookRetry] Starting background processing');
    this.processPendingRetries();
    this.processingInterval = setInterval(() => { this.processPendingRetries(); }, intervalMs);
  }

  stopBackgroundProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('[WebhookRetry] Stopped background processing');
    }
  }
}

export const webhookRetryService = new WebhookRetryService();
