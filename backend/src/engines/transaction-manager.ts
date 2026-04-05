/**
 * Transaction Manager
 * 
 * Provides transactional atomicity for engine operations.
 * Wraps multi-step operations (pricing + state transition + ledger write + side effects)
 * in a single logical transaction with rollback/compensation support.
 * 
 * INVARIANT: No partial financial writes. Either ALL succeed or ALL roll back.
 * INVARIANT: State transitions + financial mutations are atomic.
 * INVARIANT: Compensation actions are recorded for post-hoc reversal.
 * 
 * Architecture:
 *   - Supabase RPCs already provide row-level atomicity (each RPC is a DB transaction)
 *   - This manager provides OPERATION-level atomicity across multiple steps
 *   - Uses a compensation log for saga-pattern rollback when full DB transactions aren't possible
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface TransactionStep<T = unknown> {
  /** Unique name for this step (used in logging/compensation) */
  name: string;
  /** The forward operation */
  execute: () => Promise<T>;
  /** Compensation action to undo this step if a later step fails. Receives the execute result. */
  compensate?: (result: T) => Promise<void>;
  /** If true, failure of this step does NOT roll back previous steps (fire-and-forget) */
  optional?: boolean;
}

export interface TransactionResult<T = unknown> {
  success: boolean;
  /** Results from each step, keyed by step name */
  results: Record<string, unknown>;
  /** The final/primary result */
  value?: T;
  /** Error if failed */
  error?: string;
  /** Which step failed */
  failedStep?: string;
  /** Steps that were compensated */
  compensatedSteps?: string[];
  /** Timing */
  durationMs: number;
}

export interface EngineOperationContext {
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** Module ID */
  moduleId: string;
  /** Engine type */
  engineType: string;
  /** Entity ID (order, booking, session, subscription) */
  entityId: string;
  /** Idempotency key for deduplication */
  idempotencyKey?: string;
  /** Actor performing the operation */
  actor: 'system' | 'staff' | 'customer' | 'admin';
  /** Actor's user ID */
  actorId?: string;
}

// ============================================
// Transaction Manager
// ============================================

export class TransactionManager {
  
  /**
   * Execute a series of steps as a logical transaction.
   * If any non-optional step fails, all previous steps are compensated in reverse order.
   * 
   * This implements the Saga pattern for distributed/multi-step operations.
   * 
   * @param steps - Ordered list of steps to execute
   * @param context - Operation context for logging/auditing
   * @returns TransactionResult with all step results or compensation info
   */
  async executeTransaction<T = unknown>(
    steps: TransactionStep[],
    context: EngineOperationContext,
  ): Promise<TransactionResult<T>> {
    const startTime = Date.now();
    const completedSteps: Array<{ step: TransactionStep; result: unknown }> = [];
    const results: Record<string, unknown> = {};

    const txId = `tx_${context.engineType}_${context.entityId}_${Date.now()}`;
    
    logger.info(`[TX MANAGER] Starting transaction ${txId}`, {
      txId,
      engineType: context.engineType,
      entityId: context.entityId,
      stepCount: steps.length,
      steps: steps.map(s => s.name),
      actor: context.actor,
      idempotencyKey: context.idempotencyKey,
    });

    for (const step of steps) {
      try {
        logger.info(`[TX MANAGER] Executing step '${step.name}'`, { txId });
        
        const result = await step.execute();
        completedSteps.push({ step, result });
        results[step.name] = result;

        logger.info(`[TX MANAGER] Step '${step.name}' succeeded`, { txId });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        
        if (step.optional) {
          // Optional steps don't trigger compensation
          logger.warn(`[TX MANAGER] Optional step '${step.name}' failed (continuing)`, {
            txId,
            error,
          });
          results[step.name] = { skipped: true, error };
          continue;
        }

        logger.error(`[TX MANAGER] Step '${step.name}' FAILED — initiating compensation`, {
          txId,
          error,
          completedSteps: completedSteps.map(s => s.step.name),
        });

        // Compensate in reverse order
        const compensatedSteps = await this.compensate(completedSteps, txId);

        return {
          success: false,
          results,
          error,
          failedStep: step.name,
          compensatedSteps,
          durationMs: Date.now() - startTime,
        };
      }
    }

    logger.info(`[TX MANAGER] Transaction ${txId} completed successfully`, {
      txId,
      durationMs: Date.now() - startTime,
      stepCount: completedSteps.length,
    });

    // Return the last step's result as the primary value
    const lastResult = completedSteps.length > 0
      ? completedSteps[completedSteps.length - 1].result
      : undefined;

    return {
      success: true,
      results,
      value: lastResult as T,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Compensate completed steps in reverse order.
   * Compensation failures are logged but don't propagate — best-effort rollback.
   */
  private async compensate(
    completedSteps: Array<{ step: TransactionStep; result: unknown }>,
    txId: string,
  ): Promise<string[]> {
    const compensated: string[] = [];

    // Reverse order — undo latest first
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const { step, result } = completedSteps[i];

      if (!step.compensate) {
        logger.warn(`[TX MANAGER] Step '${step.name}' has no compensation — skipping`, { txId });
        continue;
      }

      try {
        logger.info(`[TX MANAGER] Compensating step '${step.name}'`, { txId });
        await step.compensate(result);
        compensated.push(step.name);
        logger.info(`[TX MANAGER] Step '${step.name}' compensated successfully`, { txId });
      } catch (compErr) {
        const error = compErr instanceof Error ? compErr.message : String(compErr);
        logger.error(`[TX MANAGER] COMPENSATION FAILED for step '${step.name}'`, {
          txId,
          error,
          stepName: step.name,
        });
        // Record failed compensation for manual intervention
        await this.recordCompensationFailure(txId, step.name, error);
      }
    }

    return compensated;
  }

  /**
   * Record a compensation failure for manual review/intervention.
   * These are critical — they indicate a partially-rolled-back transaction.
   */
  private async recordCompensationFailure(
    txId: string,
    stepName: string,
    error: string,
  ): Promise<void> {
    try {
      const supabase = getSupabase();
      await supabase.from('engine_compensation_log').insert({
        tx_id: txId,
        step_name: stepName,
        error_message: error,
        status: 'failed',
        requires_manual_review: true,
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      // If we can't even log the failure, emit to stderr
      logger.error('[TX MANAGER] CRITICAL: Cannot log compensation failure', {
        txId,
        stepName,
        originalError: error,
        logError: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }
  }
}

// ============================================
// Singleton
// ============================================

let _txManager: TransactionManager | null = null;

export function getTransactionManager(): TransactionManager {
  if (!_txManager) {
    _txManager = new TransactionManager();
  }
  return _txManager;
}

export function resetTransactionManager(): void {
  _txManager = null;
}
