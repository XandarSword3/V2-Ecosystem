/**
 * V2 Resort - Webhook Retry Service
 * Handles failed webhook processing with exponential backoff
 */

import { supabase } from '../lib/supabase';
import { activityLogger } from '../utils/activityLogger';
import { logger } from '../utils/logger';

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
  60 * 1000,       // 1 minute
  5 * 60 * 1000,   // 5 minutes
  30 * 60 * 1000,  // 30 minutes
  2 * 60 * 60 * 1000,  // 2 hours
  24 * 60 * 60 * 1000, // 24 hours
];

type WebhookHandler = (payload: any) => Promise<void>;

class WebhookRetryService {
  private handlers: Map<string, WebhookHandler> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Register a handler for a specific event type
   */
  registerHandler(eventType: string, handler: WebhookHandler): void {
    this.handlers.set(eventType, handler);
    logger.info(`[WebhookRetry] Handler registered for: ${eventType}`);
  }

  /**
   * Record a failed webhook for retry
   */
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

    // Log activity
    await activityLogger.log({
      action: 'webhook_failed',
      entity_type: 'webhook',
      entity_id: data.id,
      details: {
        event_type: eventType,
        event_id: eventId,
        source,
        error: error.message,
      },
    });

    return data;
  }

  /**
   * Process a single failed webhook
   */
  async processFailure(failure: WebhookFailure): Promise<boolean> {
    logger.info(`[WebhookRetry] Processing failure: ${failure.id}`);

    // Update status to retrying
    await supabase
      .from('webhook_failures')
      .update({
        status: 'retrying',
        updated_at: new Date().toISOString(),
      })
      .eq('id', failure.id);

    // Get handler
    const handler = this.handlers.get(failure.event_type);
    if (!handler) {
      logger.error(`[WebhookRetry] No handler for event type: ${failure.event_type}`);
      await this.markForManualReview(failure.id, 'No handler registered');
      return false;
    }

    try {
      // Attempt to process
      await handler(failure.payload);

      // Success!
      await supabase
        .from('webhook_failures')
        .update({
          status: 'resolved',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', failure.id);

      logger.info(`[WebhookRetry] Successfully processed: ${failure.id}`);

      // Log success
      await activityLogger.log({
        action: 'webhook_retry_success',
        entity_type: 'webhook',
        entity_id: failure.id,
        details: {
          event_type: failure.event_type,
          retry_count: failure.retry_count + 1,
        },
      });

      return true;
    } catch (error: any) {
      logger.error(`[WebhookRetry] Retry failed: ${failure.id} - ${error.message}`);

      const newRetryCount = failure.retry_count + 1;
      
      if (newRetryCount >= failure.max_retries) {
        // Max retries exceeded
        await this.markAsFailed(failure.id, error.message);
        await this.alertMaxRetriesExceeded(failure);
        return false;
      }

      // Schedule next retry
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

  /**
   * Process all pending webhook retries
   */
  async processPendingRetries(): Promise<{ processed: number; succeeded: number }> {
    if (this.isProcessing) {
      logger.debug('[WebhookRetry] Already processing, skipping');
      return { processed: 0, succeeded: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let succeeded = 0;

    try {
      // Get all pending retries that are due
      const { data: failures, error } = await supabase
        .from('webhook_failures')
        .select('*')
        .eq('status', 'pending')
        .lte('next_retry_at', new Date().toISOString())
        .order('next_retry_at', { ascending: true })
        .limit(10); // Process 10 at a time

      if (error) {
        throw error;
      }

      if (!failures || failures.length === 0) {
        return { processed: 0, succeeded: 0 };
      }

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

  /**
   * Manual retry of a specific failure
   */
  async manualRetry(failureId: string, adminUserId: string): Promise<boolean> {
    const { data: failure, error } = await supabase
      .from('webhook_failures')
      .select('*')
      .eq('id', failureId)
      .single();

    if (error || !failure) {
      throw new Error('Webhook failure not found');
    }

    if (failure.status === 'resolved') {
      throw new Error('This webhook has already been processed');
    }

    // Log manual retry
    await activityLogger.log({
      action: 'webhook_manual_retry',
      entity_type: 'webhook',
      entity_id: failureId,
      user_id: adminUserId,
    });

    // Reset retry count for manual retry
    await supabase
      .from('webhook_failures')
      .update({
        retry_count: failure.retry_count, // Keep current count but reset status
        status: 'pending',
        next_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', failureId);

    return this.processFailure(failure);
  }

  /**
   * Mark failure as requiring manual review
   */
  private async markForManualReview(failureId: string, reason: string): Promise<void> {
    await supabase
      .from('webhook_failures')
      .update({
        status: 'manual_review',
        error_message: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', failureId);
  }

  /**
   * Mark failure as permanently failed
   */
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

  /**
   * Alert admin when max retries exceeded
   */
  private async alertMaxRetriesExceeded(failure: WebhookFailure): Promise<void> {
    // Import email service dynamically to avoid circular dependency
    const { emailService } = await import('./email.service.js');

    await emailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@v2resort.com',
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

  /**
   * Get failure statistics
   */
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

    if (error) {
      throw error;
    }

    const stats = {
      pending: 0,
      retrying: 0,
      resolved: 0,
      failed: 0,
      manual_review: 0,
      by_source: {} as Record<string, number>,
      by_event_type: {} as Record<string, number>,
    };

    for (const failure of failures || []) {
      // Count by status
      stats[failure.status as keyof typeof stats]++;

      // Count by source
      stats.by_source[failure.source] = (stats.by_source[failure.source] || 0) + 1;

      // Count by event type (only for non-resolved)
      if (failure.status !== 'resolved') {
        stats.by_event_type[failure.event_type] = 
          (stats.by_event_type[failure.event_type] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * List failures with filters
   */
  async list(filters: {
    status?: WebhookStatus;
    source?: string;
    event_type?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: WebhookFailure[]; total: number }> {
    let query = supabase
      .from('webhook_failures')
      .select('*', { count: 'exact' });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.source) {
      query = query.eq('source', filters.source);
    }
    if (filters.event_type) {
      query = query.eq('event_type', filters.event_type);
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
   * Start background processing
   */
  startBackgroundProcessing(intervalMs: number = 60000): void {
    if (this.processingInterval) {
      return;
    }

    logger.info('[WebhookRetry] Starting background processing');
    
    // Initial run
    this.processPendingRetries();

    // Schedule periodic runs
    this.processingInterval = setInterval(() => {
      this.processPendingRetries();
    }, intervalMs);
  }

  /**
   * Stop background processing
   */
  stopBackgroundProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('[WebhookRetry] Stopped background processing');
    }
  }
}

export const webhookRetryService = new WebhookRetryService();
