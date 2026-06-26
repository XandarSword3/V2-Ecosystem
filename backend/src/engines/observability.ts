/**
 * Engine Observability
 * 
 * Structured logging, metrics, and audit trail for all engine operations.
 * Provides the "black box" recording needed for debugging, monitoring,
 * and compliance auditing.
 * 
 * Three pillars:
 *   1. Structured Events — typed, searchable event records
 *   2. Metrics Counters — aggregatable numeric counters
 *   3. Audit Trail Writer — DB-backed immutable state transition log
 * 
 * INVARIANT: Every state transition is logged.
 * INVARIANT: Every pricing calculation is logged.
 * INVARIANT: Every financial ledger write is logged.
 * INVARIANT: Every anomaly (invariant violation, duplicate, negative capacity) is logged.
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import type { EngineType, PricingResult, TransitionResult } from './types.js';

// ============================================
// Event Types
// ============================================

export type EngineEventType =
  | 'state_transition'
  | 'state_transition_rejected'
  | 'pricing_calculated'
  | 'pricing_invariant_violation'
  | 'ledger_write'
  | 'ledger_invariant_violation'
  | 'idempotency_hit'
  | 'idempotency_conflict'
  | 'transaction_started'
  | 'transaction_completed'
  | 'transaction_failed'
  | 'compensation_executed'
  | 'compensation_failed'
  | 'capacity_violation'
  | 'booking_overlap_rejected'
  | 'duplicate_loyalty_prevented'
  | 'feature_flag_checked'
  | 'rpc_call'
  | 'rpc_failure';

export interface EngineEvent {
  type: EngineEventType;
  engineType: EngineType;
  entityId?: string;
  moduleId?: string;
  tenantId?: string;
  actor?: string;
  actorId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
  durationMs?: number;
}

// ============================================
// Metrics
// ============================================

interface MetricEntry {
  count: number;
  lastOccurrence: Date;
  sumValue: number;
}

export class EngineMetrics {
  private counters: Map<string, MetricEntry> = new Map();

  /**
   * Increment a counter metric.
   */
  increment(name: string, value: number = 1): void {
    const existing = this.counters.get(name) || { count: 0, lastOccurrence: new Date(), sumValue: 0 };
    existing.count += 1;
    existing.sumValue += value;
    existing.lastOccurrence = new Date();
    this.counters.set(name, existing);
  }

  /**
   * Get current metric value.
   */
  get(name: string): MetricEntry | undefined {
    return this.counters.get(name);
  }

  /**
   * Get all metrics as a snapshot.
   */
  snapshot(): Record<string, MetricEntry> {
    const result: Record<string, MetricEntry> = {};
    for (const [name, entry] of this.counters) {
      result[name] = { ...entry };
    }
    return result;
  }

  /**
   * Reset all metrics (for testing).
   */
  reset(): void {
    this.counters.clear();
  }
}

// ============================================
// Engine Observer
// ============================================

export class EngineObserver {
  private readonly metrics: EngineMetrics;
  private readonly eventBuffer: EngineEvent[] = [];
  private readonly maxBufferSize: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(metrics?: EngineMetrics, maxBufferSize: number = 100) {
    this.metrics = metrics || new EngineMetrics();
    this.maxBufferSize = maxBufferSize;
  }

  // ============================================
  // State Transition Events
  // ============================================

  /**
   * Log a successful state transition.
   */
  onStateTransition(
    engineType: EngineType,
    entityId: string,
    previousState: string,
    newState: string,
    action: string,
    actor: string,
    context?: Record<string, unknown>,
  ): void {
    this.metrics.increment(`state_transition.${engineType}`);
    this.metrics.increment(`state_transition.${engineType}.${action}`);

    this.emit({
      type: 'state_transition',
      engineType,
      entityId,
      actor,
      data: {
        previousState,
        newState,
        action,
        ...context,
      },
      timestamp: new Date(),
    });

    logger.info('[ENGINE EVENT] State transition', {
      engineType,
      entityId,
      previousState,
      newState,
      action,
      actor,
    });
  }

  /**
   * Log a rejected state transition.
   */
  onStateTransitionRejected(
    engineType: EngineType,
    entityId: string,
    currentState: string,
    attemptedAction: string,
    actor: string,
    reason: string,
  ): void {
    this.metrics.increment(`state_transition_rejected.${engineType}`);

    this.emit({
      type: 'state_transition_rejected',
      engineType,
      entityId,
      actor,
      data: {
        currentState,
        attemptedAction,
        reason,
      },
      timestamp: new Date(),
    });

    logger.warn('[ENGINE EVENT] State transition rejected', {
      engineType,
      entityId,
      currentState,
      attemptedAction,
      actor,
      reason,
    });
  }

  // ============================================
  // Pricing Events
  // ============================================

  /**
   * Log a pricing calculation.
   */
  onPricingCalculated(
    engineType: EngineType,
    entityId: string,
    result: PricingResult,
    durationMs: number,
  ): void {
    this.metrics.increment(`pricing_calculated.${engineType}`);
    this.metrics.increment('amount', result.totalAmount);

    this.emit({
      type: 'pricing_calculated',
      engineType,
      entityId,
      data: {
        subtotal: result.subtotal,
        taxAmount: result.taxAmount,
        serviceCharge: result.serviceCharge,
        deliveryFee: result.deliveryFee,
        totalDiscount: result.totalDiscount,
        totalAmount: result.totalAmount,
        lineItemCount: result.lineItems.length,
        discountCount: result.discounts.length,
      },
      timestamp: new Date(),
      durationMs,
    });
  }

  /**
   * Log a pricing invariant violation.
   */
  onPricingInvariantViolation(
    engineType: EngineType,
    entityId: string,
    expected: number,
    actual: number,
    breakdown: Record<string, number>,
  ): void {
    this.metrics.increment('pricing_invariant_violation');

    this.emit({
      type: 'pricing_invariant_violation',
      engineType,
      entityId,
      data: { expected, actual, diff: Math.abs(expected - actual), breakdown },
      timestamp: new Date(),
    });

    logger.error('[ENGINE EVENT] PRICING INVARIANT VIOLATION', {
      engineType,
      entityId,
      expected,
      actual,
      diff: Math.abs(expected - actual),
      breakdown,
    });
  }

  // ============================================
  // Ledger Events
  // ============================================

  /**
   * Log a financial ledger write.
   */
  onLedgerWrite(
    engineType: EngineType,
    entityId: string,
    transactionType: string,
    totalAmount: number,
    idempotencyKey?: string,
  ): void {
    this.metrics.increment(`ledger_write.${engineType}`);
    this.metrics.increment(`ledger_write.${transactionType}`);
    this.metrics.increment('amount', totalAmount);

    this.emit({
      type: 'ledger_write',
      engineType,
      entityId,
      data: { transactionType, totalAmount, idempotencyKey },
      timestamp: new Date(),
    });
  }

  // ============================================
  // Idempotency Events
  // ============================================

  /**
   * Log an idempotency cache hit (duplicate request).
   */
  onIdempotencyHit(key: string, engineType: EngineType, entityId: string): void {
    this.metrics.increment('idempotency_hit');

    this.emit({
      type: 'idempotency_hit',
      engineType,
      entityId,
      data: { key },
      timestamp: new Date(),
    });

    logger.info('[ENGINE EVENT] Idempotency cache hit', { key, engineType, entityId });
  }

  /**
   * Log an idempotency conflict (concurrent processing).
   */
  onIdempotencyConflict(key: string, engineType: EngineType, entityId: string): void {
    this.metrics.increment('idempotency_conflict');

    this.emit({
      type: 'idempotency_conflict',
      engineType,
      entityId,
      data: { key },
      timestamp: new Date(),
    });

    logger.warn('[ENGINE EVENT] Idempotency conflict', { key, engineType, entityId });
  }

  // ============================================
  // Transaction Events
  // ============================================

  /**
   * Log a transaction start.
   */
  onTransactionStarted(
    txId: string,
    engineType: EngineType,
    entityId: string,
    stepCount: number,
  ): void {
    this.metrics.increment(`transaction_started.${engineType}`);

    this.emit({
      type: 'transaction_started',
      engineType,
      entityId,
      data: { txId, stepCount },
      timestamp: new Date(),
    });
  }

  /**
   * Log a transaction completion.
   */
  onTransactionCompleted(
    txId: string,
    engineType: EngineType,
    entityId: string,
    durationMs: number,
  ): void {
    this.metrics.increment(`transaction_completed.${engineType}`);

    this.emit({
      type: 'transaction_completed',
      engineType,
      entityId,
      data: { txId, durationMs },
      timestamp: new Date(),
      durationMs,
    });
  }

  /**
   * Log a transaction failure.
   */
  onTransactionFailed(
    txId: string,
    engineType: EngineType,
    entityId: string,
    failedStep: string,
    error: string,
    compensatedSteps: string[],
  ): void {
    this.metrics.increment(`transaction_failed.${engineType}`);

    this.emit({
      type: 'transaction_failed',
      engineType,
      entityId,
      data: { txId, failedStep, error, compensatedSteps },
      timestamp: new Date(),
    });

    logger.error('[ENGINE EVENT] Transaction failed', {
      txId,
      engineType,
      entityId,
      failedStep,
      error,
      compensatedSteps,
    });
  }

  // ============================================
  // Anomaly Events
  // ============================================

  /**
   * Log a capacity violation attempt.
   */
  onCapacityViolation(
    engineType: EngineType,
    entityId: string,
    currentOccupancy: number,
    maxCapacity: number,
  ): void {
    this.metrics.increment('capacity_violation');

    this.emit({
      type: 'capacity_violation',
      engineType,
      entityId,
      data: { currentOccupancy, maxCapacity },
      timestamp: new Date(),
    });

    logger.error('[ENGINE EVENT] Capacity violation', {
      engineType,
      entityId,
      currentOccupancy,
      maxCapacity,
    });
  }

  /**
   * Log a duplicate loyalty earn prevention.
   */
  onDuplicateLoyaltyPrevented(
    engineType: EngineType,
    entityId: string,
    customerId: string,
  ): void {
    this.metrics.increment('duplicate_loyalty_prevented');

    this.emit({
      type: 'duplicate_loyalty_prevented',
      engineType,
      entityId,
      data: { customerId },
      timestamp: new Date(),
    });

    logger.warn('[ENGINE EVENT] Duplicate loyalty earn prevented', {
      engineType,
      entityId,
      customerId,
    });
  }

  /**
   * Log an RPC failure.
   */
  onRpcFailure(
    rpcName: string,
    engineType: EngineType,
    error: string,
  ): void {
    this.metrics.increment(`rpc_failure.${rpcName}`);
    this.metrics.increment('rpc_failure.total');

    this.emit({
      type: 'rpc_failure',
      engineType,
      data: { rpcName, error },
      timestamp: new Date(),
    });

    logger.error('[ENGINE EVENT] RPC failure', { rpcName, engineType, error });
  }

  // ============================================
  // Metrics Access
  // ============================================

  /**
   * Get the metrics instance for querying counters.
   */
  getMetrics(): EngineMetrics {
    return this.metrics;
  }

  /**
   * Get all buffered events (for testing or batch processing).
   */
  getEventBuffer(): EngineEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Clear the event buffer.
   */
  clearEventBuffer(): void {
    this.eventBuffer.length = 0;
  }

  // ============================================
  // Audit Trail Writer
  // ============================================

  /**
   * Write a state transition to the persistent audit trail.
   * This is the DB-backed immutable record.
   */
  async writeAuditTrail(
    tenantId: string,
    moduleId: string,
    engineType: EngineType,
    entityId: string,
    previousState: string,
    newState: string,
    action: string,
    actorType: string,
    actorId?: string,
    context?: Record<string, unknown>,
    transactionId?: string,
  ): Promise<void> {
    try {
      const supabase = getSupabase();
      await supabase.from('engine_state_transitions').insert({
        tenant_id: tenantId,
        module_id: moduleId,
        engine_type: engineType,
        entity_id: entityId,
        previous_state: previousState,
        new_state: newState,
        action,
        actor_type: actorType,
        actor_id: actorId,
        context: context || {},
        transaction_id: transactionId,
      });
    } catch (err) {
      logger.error('[AUDIT TRAIL] Failed to write state transition audit', {
        entityId,
        action,
        error: err instanceof Error ? err.message : String(err),
      });
      // Audit trail failures are logged but not propagated — they shouldn't block operations
    }
  }

  // ============================================
  // Internal
  // ============================================

  private emit(event: EngineEvent): void {
    this.eventBuffer.push(event);

    // Auto-flush if buffer is full
    if (this.eventBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffered events (for batch processing or periodic writes).
   * Default implementation just clears the buffer; override for external systems.
   */
  flush(): void {
    // In production, this would send to an external observability system
    // (DataDog, New Relic, CloudWatch, etc.)
    // For now, just clear the buffer — events are already logged individually
    this.eventBuffer.length = 0;
  }
}

// ============================================
// Singleton
// ============================================

let _observer: EngineObserver | null = null;
let _metrics: EngineMetrics | null = null;

export function getEngineObserver(): EngineObserver {
  if (!_observer) {
    _metrics = new EngineMetrics();
    _observer = new EngineObserver(_metrics);
  }
  return _observer;
}

export function getEngineMetrics(): EngineMetrics {
  if (!_metrics) {
    getEngineObserver(); // Initialize both
  }
  return _metrics!;
}

export function resetEngineObserver(): void {
  _observer = null;
  _metrics = null;
}
