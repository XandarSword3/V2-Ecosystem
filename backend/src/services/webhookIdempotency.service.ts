/**
 * Webhook Idempotency Service
 * 
 * Prevents duplicate processing of webhook events using database-backed tracking.
 */

import crypto from 'crypto';
import { getSupabase } from '../database/supabase';
import { logger } from '../utils/logger';

interface ProcessedEvent {
  id: string;
  event_id: string;
  event_type: string;
  processed_at: Date;
  payload_hash: string | null;
  result: any | null;
}

/**
 * Check if a webhook event has already been processed
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('processed_webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    logger.error('Error checking webhook event:', error);
    throw error;
  }

  return !!data;
}

/**
 * Mark a webhook event as processed
 * Returns true if the event was newly marked, false if it already existed
 */
export async function markEventProcessed(
  eventId: string,
  eventType: string,
  result?: any
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('processed_webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      result: result || null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation = already processed
    if (error.code === '23505') {
      return false;
    }
    logger.error('Error marking webhook event as processed:', error);
    throw error;
  }

  return !!data;
}

/**
 * Process a webhook event with idempotency protection
 * Returns the result of the handler, or null if already processed
 */
export async function processWithIdempotency<T>(
  eventId: string,
  eventType: string,
  handler: () => Promise<T>
): Promise<{ processed: boolean; result: T | null; alreadyProcessed: boolean }> {
  // Check if already processed
  const alreadyProcessed = await isEventProcessed(eventId);
  if (alreadyProcessed) {
    logger.debug(`Webhook event ${eventId} already processed, skipping`);
    return { processed: false, result: null, alreadyProcessed: true };
  }

  try {
    // Process the event
    const result = await handler();

    // Mark as processed (with race condition protection)
    const wasMarked = await markEventProcessed(eventId, eventType, result);
    
    if (!wasMarked) {
      // Another process beat us to it
      logger.debug(`Webhook event ${eventId} was processed by another worker`);
      return { processed: false, result: null, alreadyProcessed: true };
    }

    return { processed: true, result, alreadyProcessed: false };
  } catch (error) {
    // Don't mark as processed on error - allow retry
    logger.error(`Error processing webhook event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Generate a hash of the webhook payload for verification
 */
export function hashPayload(payload: object): string {
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Clean up old processed events
 */
export async function cleanupOldEvents(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { data, error } = await getSupabase()
    .from('processed_webhook_events')
    .delete()
    .lt('processed_at', cutoffDate.toISOString())
    .select();

  if (error) {
    logger.error('Error cleaning up old webhook events:', error);
    throw error;
  }

  return data?.length || 0;
}

/**
 * Get processing statistics for webhook events
 */
export async function getWebhookStats(): Promise<{
  totalProcessed: number;
  byType: Record<string, number>;
  last24Hours: number;
}> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Get all events
  const { data: allEvents, error: allError } = await getSupabase()
    .from('processed_webhook_events')
    .select('event_type, processed_at');

  if (allError) {
    throw allError;
  }

  const byType: Record<string, number> = {};
  let last24Hours = 0;

  for (const event of allEvents || []) {
    byType[event.event_type] = (byType[event.event_type] || 0) + 1;
    if (new Date(event.processed_at) >= yesterday) {
      last24Hours++;
    }
  }

  return {
    totalProcessed: allEvents?.length || 0,
    byType,
    last24Hours,
  };
}
