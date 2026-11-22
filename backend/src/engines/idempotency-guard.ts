/**
 * Idempotency Guard
 * 
 * Prevents duplicate processing of payment webhooks, state transitions,
 * and financial operations. Uses a database-backed idempotency key store.
 * 
 * INVARIANT: Every financial mutation has a unique idempotency key.
 * INVARIANT: Retrying the same key returns the cached result (200), never re-executes.
 * INVARIANT: Keys are scoped to tenant + engine + entity.
 * 
 * Architecture:
 *   - Database table `engine_idempotency_keys` stores processed keys
 *   - Keys have a TTL (default: 24 hours) after which they expire
 *   - Check-and-insert is done atomically via Supabase RPC or unique constraint
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface IdempotencyResult<T = unknown> {
  /** Whether this is a new (first-time) execution */
  isNew: boolean;
  /** Whether the result was served from cache (duplicate request) */
  isDuplicate: boolean;
  /** The result data */
  result: T;
  /** The idempotency key that was used */
  key: string;
}

export interface IdempotencyEntry {
  key: string;
  tenant_id: string;
  engine_type: string;
  entity_id: string;
  action: string;
  status: 'processing' | 'completed' | 'failed';
  result_data?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
  expires_at: string;
}

// ============================================
// Idempotency Guard
// ============================================

export class IdempotencyGuard {
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 24 * 60 * 60 * 1000) { // 24 hours
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Generate a deterministic idempotency key for an engine operation.
   * 
   * Key format: `{tenantId}:{engineType}:{entityId}:{action}:{nonce}`
   * The nonce prevents collisions when the same action is legitimately retried
   * (e.g., paying for a second order for the same entity).
   */
  generateKey(
    tenantId: string,
    engineType: string,
    entityId: string,
    action: string,
    nonce?: string,
  ): string {
    const parts = [tenantId, engineType, entityId, action];
    if (nonce) parts.push(nonce);
    return parts.join(':');
  }

  /**
   * Execute an operation with idempotency protection.
   * 
   * 1. Check if key already exists in the idempotency store
   * 2. If exists and completed → return cached result (no re-execution)
   * 3. If exists and processing → return conflict (another request is handling it)
   * 4. If not exists → claim the key, execute, store result
   * 
   * @param key - Idempotency key
   * @param tenantId - Tenant context
   * @param engineType - Engine type
   * @param entityId - Entity being operated on
   * @param action - Action being performed
   * @param operation - The actual operation to execute
   * @returns IdempotencyResult with the operation's return value
   */
  async executeOnce<T>(
    key: string,
    tenantId: string,
    engineType: string,
    entityId: string,
    action: string,
    operation: () => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    const supabase = getSupabase();

    // Step 1: Atomically claim the key. The RPC uses INSERT ... ON CONFLICT
    // DO NOTHING under a row lock; it never downgrades a completed key and it
    // reclaims only failed or expired claims.
    const { data: claim, error: claimError } = await supabase.rpc(
      'claim_engine_idempotency_key',
      {
        p_key: key,
        p_tenant_id: tenantId,
        p_engine_type: engineType,
        p_entity_id: entityId,
        p_action: action,
        p_ttl_seconds: Math.max(1, Math.ceil(this.defaultTtlMs / 1000)),
      },
    );

    if (claimError) {
      // Fail closed: running unprotected is worse than making the caller retry.
      logger.error('[IDEMPOTENCY] Failed to claim idempotency key', {
        key,
        error: claimError.message,
      });
      throw new Error(`Idempotency claim failed for key '${key}': ${claimError.message}`);
    }

    if (!claim?.claimed) {
      if (claim?.status === 'completed') {
        logger.info('[IDEMPOTENCY] Duplicate request — returning cached result', {
          key,
          engineType,
          entityId,
          action,
        });
        return {
          isNew: false,
          isDuplicate: true,
          result: (claim.result_data as T) ?? ({} as T),
          key,
        };
      }

      logger.warn('[IDEMPOTENCY] Request already being processed (conflict)', {
        key,
        engineType,
        entityId,
        action,
      });
      throw new IdempotencyConflictError(
        `Operation with key '${key}' is already being processed`,
        key,
      );
    }

    // Step 2: Execute the operation
    try {
      const result = await operation();

      // Step 3: Store the result. Only update a row that is still processing,
      // so an expired-then-reclaimed key cannot be overwritten by the old
      // worker after it finishes.
      await supabase
        .from('engine_idempotency_keys')
        .update({
          status: 'completed',
          result_data: result as Record<string, unknown>,
          completed_at: new Date().toISOString(),
        })
        .eq('key', key)
        .eq('status', 'processing');

      logger.info('[IDEMPOTENCY] Operation completed and result cached', {
        key,
        engineType,
        entityId,
        action,
      });

      return {
        isNew: true,
        isDuplicate: false,
        result,
        key,
      };
    } catch (err) {
      // Mark as failed so retries can re-attempt. Guarded by status so a key
      // reclaimed by another worker is not clobbered.
      await supabase
        .from('engine_idempotency_keys')
        .update({
          status: 'failed',
          result_data: { error: err instanceof Error ? err.message : String(err) },
          completed_at: new Date().toISOString(),
        })
        .eq('key', key)
        .eq('status', 'processing');

      throw err;
    }
  }

  /**
   * Check whether a key has already been processed (without executing anything).
   */
  async isProcessed(key: string): Promise<boolean> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('engine_idempotency_keys')
      .select('status')
      .eq('key', key)
      .single();

    return data?.status === 'completed';
  }

  /**
   * Clean up expired idempotency keys.
   * Should be called periodically (e.g., daily cron job).
   */
  async cleanupExpired(): Promise<number> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('engine_idempotency_keys')
      .delete()
      .lt('expires_at', now)
      .select('key');

    if (error) {
      logger.error('[IDEMPOTENCY] Failed to clean up expired keys', {
        error: error.message,
      });
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      logger.info(`[IDEMPOTENCY] Cleaned up ${count} expired keys`);
    }
    return count;
  }
}

// ============================================
// Error Types
// ============================================

export class IdempotencyConflictError extends Error {
  public readonly code = 'IDEMPOTENCY_CONFLICT';
  public readonly statusCode = 409;
  public readonly key: string;

  constructor(message: string, key: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.key = key;
  }
}

// ============================================
// Singleton
// ============================================

let _guard: IdempotencyGuard | null = null;

export function getIdempotencyGuard(): IdempotencyGuard {
  if (!_guard) {
    _guard = new IdempotencyGuard();
  }
  return _guard;
}

export function resetIdempotencyGuard(): void {
  _guard = null;
}
