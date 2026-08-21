/**
 * Fulfillment persistence service (plan Stage 6).
 *
 * Gives the fulfillment layer its own persistence so `transactions.status`
 * stops carrying fulfillment meaning. This module is GENERIC — it reads the
 * engine's capability contract (fulfillment mode/destination/state machine)
 * and persists canonical fulfillment rows. It never contains vertical
 * vocabulary; the hospitality adapter supplies the machine.
 *
 * Responsibilities:
 *   - ensure: create the canonical fulfillment row when a transaction with a
 *     required fulfillment layer is confirmed (idempotent);
 *   - transition: validate a fulfillment-layer move through the engine's
 *     layered validator, then persist it atomically with an append-only event;
 *   - read: fetch the canonical fulfillment state for consumers (KDS,
 *     analytics, fiscal) instead of reading fulfillment meaning from
 *     transactions.status.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getEngineService } from '../../engines/engine-service.js';
import { getEngine, type EngineRegistry } from '../../engines/registry.js';
import { assertValidFulfillmentSelection } from '../../engines/fulfillment-contract.js';
import type { DestinationType, FulfillmentDefinition, FulfillmentMode } from '../../engines/types.js';
import { logger } from '../../utils/logger.js';

export type FulfillmentActor = 'system' | 'staff' | 'customer' | 'admin';

export interface FulfillmentCreateParams {
  transactionId: string;
  engineType: string;
  moduleId?: string | null;
  propertyId?: string | null;
  tenantId?: string | null;
  /** Typed domain value — validated against the engine's declared options. */
  mode?: FulfillmentMode | null;
  /** Typed domain value — must be legal for the selected mode on this engine. */
  destinationType?: DestinationType | null;
  destinationRef?: string | null;
}

export interface FulfillmentTransitionParams {
  transactionId: string;
  /** The fulfillment-layer move to validate + persist (e.g. 'start_preparation', 'deliver'). */
  action: string;
  actor: FulfillmentActor;
  actorId?: string | null;
  /** Canonical fulfillment state the caller believes the row is in (optimistic concurrency). */
  expectedFrom?: string | null;
  context?: Record<string, unknown>;
}

export interface FulfillmentRow {
  id: string;
  transaction_id: string;
  engine_type: string;
  status: string;
  mode: string | null;
  destination_type: string | null;
  destination_ref: string | null;
  tracking_ref: string | null;
  queued_at: string | null;
  in_progress_at: string | null;
  ready_at: string | null;
  handed_off_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export class FulfillmentService {
  /**
   * Fetch the canonical fulfillment row for a transaction.
   *
   * FAIL-CLOSED: a database read error THROWS — it is never confused with
   * "no row". Callers that treat null as "no fulfillment layer" would
   * otherwise silently fall back to transactions.status on an error, which
   * is exactly the pre-Stage-6 behavior this module exists to kill. Null is
   * returned ONLY when the row genuinely does not exist.
   *
   * @throws Error on read failure (callers must surface it, not degrade).
   */
  async getForTransaction(
    supabase: SupabaseClient,
    transactionId: string,
  ): Promise<FulfillmentRow | null> {
    const { data, error } = await supabase
      .from('fulfillments')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();
    if (error) {
      logger.error('[Fulfillment] Failed to read fulfillment row', { transactionId, error: error.message });
      throw new Error(`Failed to read fulfillment state for transaction ${transactionId}: ${error.message}`);
    }
    return data as FulfillmentRow | null;
  }

  /**
   * Explicitly create the canonical fulfillment row for a transaction with a
   * required fulfillment layer (idempotent — the DB RPC is ON CONFLICT DO
   * NOTHING). In production, confirmation creates the row ATOMICALLY via the
   * DB trigger (Stage 6 fix); this is the explicit-create API for paths that
   * initialize fulfillment independently (e.g. dispatch setup) and validates
   * the selection against the engine's capability contract before writing.
   */
  async ensure(
    supabase: SupabaseClient,
    params: FulfillmentCreateParams,
  ): Promise<{ ok: boolean; error?: string; status?: string }> {
    // Fail closed on an unknown engine, then validate the mode/destination
    // selection against THAT engine's declared options (typed domain values).
    let fulfillment: FulfillmentDefinition;
    try {
      const engine = getEngine(params.engineType as keyof EngineRegistry);
      fulfillment = engine.capabilities.fulfillment;
      assertValidFulfillmentSelection(fulfillment, params.mode ?? null, params.destinationType ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[Fulfillment] ensure rejected by capability validation', {
        transactionId: params.transactionId,
        engineType: params.engineType,
        error: message,
      });
      return { ok: false, error: message };
    }

    const { data, error } = await supabase.rpc('ensure_fulfillment', {
      p_transaction_id: params.transactionId,
      p_engine_type: params.engineType,
      p_module_id: params.moduleId ?? null,
      p_property_id: params.propertyId ?? null,
      p_tenant_id: params.tenantId ?? null,
      p_mode: params.mode ?? null,
      p_destination_type: params.destinationType ?? null,
      p_destination_ref: params.destinationRef ?? null,
    });
    if (error) {
      logger.error('[Fulfillment] ensure failed', { transactionId: params.transactionId, error: error.message });
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success) {
      return { ok: false, error: row?.error_message ?? 'ensure_fulfillment failed' };
    }
    return { ok: true, status: row.status ?? 'queued' };
  }

  /**
   * Validate a fulfillment-layer move through the engine's layered validator
   * and persist the resulting canonical state atomically with an append-only
   * event.
   *
   * @returns the canonical target state on success, or an error.
   */
  async transition(
    supabase: SupabaseClient,
    params: FulfillmentTransitionParams,
  ): Promise<{ ok: boolean; targetState?: string; canonicalState?: string; layer?: string; error?: string }> {
    const engineService = getEngineService();
    // FAIL-CLOSED: a read error throws and is surfaced as a failed result —
    // it is never treated as "no row" (which would fall back to
    // transactions.status). Missing row = explicit error, not degradation.
    let fulfillment: FulfillmentRow | null;
    try {
      fulfillment = await this.getForTransaction(supabase, params.transactionId);
    } catch (readErr) {
      const message = readErr instanceof Error ? readErr.message : String(readErr);
      logger.error('[Fulfillment] transition aborted — fulfillment state read failed', {
        transactionId: params.transactionId,
        error: message,
      });
      return { ok: false, error: message };
    }
    if (!fulfillment) {
      return { ok: false, error: 'No fulfillment row for this transaction' };
    }

    // Canonical fulfillment state is the row's status — the engine never
    // reads fulfillment meaning from transactions.status. The engine type
    // comes from the row itself, never hardcoded, so non-hospitality
    // fulfillment adapters work through this same service.
    const currentState = fulfillment.status;
    // The row's MODE is the runtime authority: only the mode's binding
    // machine may validate this move (a digital_delivery row can never be
    // moved with a hospitality action, even if adapters ever share a state
    // name). An unknown/null mode resolves to no fulfillment layer and fails
    // closed — the mode is NOT NULL by contract, so this only happens on
    // corrupt data.
    const transition = await engineService.transitionState(
      fulfillment.engine_type,
      currentState,
      params.action,
      params.actor,
      { ...(params.context ?? {}), transactionId: params.transactionId },
      (fulfillment.mode ?? undefined) as FulfillmentMode | undefined,
    );

    if (!transition.allowed || !transition.targetState) {
      return { ok: false, error: transition.error ?? 'Fulfillment transition rejected' };
    }

    // Only persist fulfillment-layer moves here; transaction-layer moves
    // (e.g. cross-layer cancel) are handled by the caller.
    if (transition.layer !== 'fulfillment') {
      return { ok: true, targetState: transition.targetState, canonicalState: transition.canonicalState, layer: transition.layer };
    }

    const { data, error } = await supabase.rpc('transition_fulfillment', {
      p_transaction_id: params.transactionId,
      p_to_status: transition.canonicalState ?? transition.targetState,
      p_action: params.action,
      p_actor: params.actor,
      p_actor_id: params.actorId ?? null,
      p_expected_from: params.expectedFrom ?? currentState,
      p_metadata: params.context ?? {},
    });
    if (error) {
      logger.error('[Fulfillment] transition persistence failed', { transactionId: params.transactionId, error: error.message });
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success) {
      return { ok: false, error: row?.error_message ?? 'transition_fulfillment failed' };
    }
    return {
      ok: true,
      targetState: row.status,
      canonicalState: row.status,
      layer: 'fulfillment',
    };
  }
}

let _fulfillmentService: FulfillmentService | null = null;

/** Get the singleton fulfillment service (same pattern as the engine service). */
export function getFulfillmentService(): FulfillmentService {
  if (!_fulfillmentService) {
    _fulfillmentService = new FulfillmentService();
  }
  return _fulfillmentService;
}
