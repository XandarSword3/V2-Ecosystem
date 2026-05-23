/**
 * Token Blacklist Cleanup Job
 * 
 * Purges expired token_blacklist entries daily.
 * Expired entries are safe to delete — an expired JWT is already invalid
 * by its own exp claim, so there's nothing to protect anymore.
 * 
 * Wired into SchedulerService.init() alongside existing daily jobs.
 */

/**
 * Engine Cleanup Job — token blacklist prune + idempotency key prune.
 * 
 * HOW TO HOOK IN (one-time setup):
 * In backend/src/index.ts, after the SchedulerService.init() call, add:
 * 
 *   import { registerEngineCleanupJobs } from './jobs/engine-cleanup.job.js';
 *   registerEngineCleanupJobs();
 * 
 * Or call it inside SchedulerService.init() directly.
 */

import cron from 'node-cron';
import { pruneExpiredBlacklistEntries } from '../services/token-blacklist.service.js';
import { getIdempotencyGuard } from '../engines/idempotency-guard.js';
import { logger } from '../utils/logger.js';

/**
 * Register all engine-layer cleanup jobs.
 * Call once at app startup from SchedulerService.init() or index.ts.
 */
export function registerEngineCleanupJobs(): void {
  // Daily at 02:00 — prune expired token blacklist entries
  cron.schedule('0 2 * * *', async () => {
    try {
      const count = await pruneExpiredBlacklistEntries();
      logger.info(`[CLEANUP] Token blacklist: pruned ${count} expired entries`);
    } catch (err) {
      logger.error('[CLEANUP] Token blacklist prune failed:', err);
    }
  });

  // Daily at 02:15 — prune expired idempotency keys
  cron.schedule('15 2 * * *', async () => {
    try {
      const guard = getIdempotencyGuard();
      const count = await guard.cleanupExpired();
      logger.info(`[CLEANUP] Idempotency keys: pruned ${count} expired entries`);
    } catch (err) {
      logger.error('[CLEANUP] Idempotency key prune failed:', err);
    }
  });

  logger.info('[SCHEDULER] Engine cleanup jobs registered (token blacklist + idempotency keys)');
}
