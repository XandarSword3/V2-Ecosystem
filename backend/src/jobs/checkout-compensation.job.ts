/**
 * Checkout Compensation Queue Worker Job (Phase F4)
 * 
 * Periodically processes pending compensation tasks from checkout_compensation_queue.
 * Guarantees durable recovery if any step of order rollback failed during checkout.
 * Emits critical alerts for unrecoverable items (attempts >= 5).
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Process a batch of pending compensation queue items.
 * Can be invoked on a schedule or directly by tests.
 */
export async function processCheckoutCompensationQueue(batchSize: number = 20): Promise<{ processed: number; failed: number }> {
  if (isRunning) {
    return { processed: 0, failed: 0 };
  }
  isRunning = true;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('process_checkout_compensation_queue', {
      p_batch_size: batchSize,
    });

    if (error) {
      logger.error('[Checkout Compensation Worker] Error calling process_checkout_compensation_queue RPC:', error);
      return { processed: 0, failed: 0 };
    }

    const processed = data?.processed ?? 0;
    const failed = data?.failed ?? 0;

    if (processed > 0 || failed > 0) {
      logger.info(`[Checkout Compensation Worker] Processed: ${processed}, Failed: ${failed}`);
    }

    // Monitor for permanently failed rows to alert operations
    const { data: deadItems, error: deadErr } = await supabase
      .from('checkout_compensation_queue')
      .select('id, idempotency_key, transaction_id, operation, attempts, last_error, created_at')
      .eq('status', 'failed')
      .limit(10);

    if (!deadErr && deadItems && deadItems.length > 0) {
      for (const item of deadItems) {
        logger.error('[CRITICAL COMPENSATION ALERT] Order compensation failed permanently after 5 attempts:', {
          id: item.id,
          idempotencyKey: item.idempotency_key,
          transactionId: item.transaction_id,
          operation: item.operation,
          attempts: item.attempts,
          lastError: item.last_error,
          createdAt: item.created_at,
        });
      }
    }

    return { processed, failed };
  } catch (err) {
    logger.error('[Checkout Compensation Worker] Unexpected exception during processing:', err);
    return { processed: 0, failed: 0 };
  } finally {
    isRunning = false;
  }
}

/**
 * Start the background polling loop for checkout compensations (runs every 30 seconds).
 */
export function startCheckoutCompensationWorker(intervalMs: number = 30_000): NodeJS.Timeout {
  if (intervalId) {
    clearInterval(intervalId);
  }

  // Run initial pass after short startup delay
  setTimeout(() => {
    processCheckoutCompensationQueue().catch(() => {});
  }, 2000);

  intervalId = setInterval(() => {
    processCheckoutCompensationQueue().catch(() => {});
  }, intervalMs);

  logger.info(`[Checkout Compensation Worker] Started background worker (polling every ${intervalMs / 1000}s)`);
  return intervalId;
}

/**
 * Stop the background polling loop (for graceful server shutdown or test cleanup).
 */
export function stopCheckoutCompensationWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[Checkout Compensation Worker] Stopped background worker');
  }
}
