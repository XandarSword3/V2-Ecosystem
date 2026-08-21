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
import { logger } from '../../utils/logger.js';

export type FulfillmentActor = 'system' | 'staff' | 'customer' | 'admin';

export interface FulfillmentCreateParams {
  transactionId: string;
  engineType: string;
  moduleId?: string | null;
  propertyId?: string | null;
  tenantId?: string | null;
  mode?: string | null;
  destinationType?: string | null;
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
   * Returns null when the engine has no fulfillment layer or no row exists yet.
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
      return null;
    }
    return data as FulfillmentRow | null;
  }

  /**
   * Idempotently create the canonical fulfillment row for a confirmed
   * transaction with a required fulfillment layer. Safe to call on every
   * confirm — the DB RPC is ON CONFLICT DO NOTHING.
   */
  async ensure(
    supabase: SupabaseClient,
    params: FulfillmentCreateParams,
  ): Promise<{ ok: boolean; error?: string; status?: string }> {
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
    const fulfillment = await this.getForTransaction(supabase, params.transactionId);
    if (!fulfillment) {
      return { ok: false, error: 'No fulfillment row for this transaction' };
    }

    // Canonical fulfillment state is the row's status — the engine never
    // reads fulfillment meaning from transactions.status. The engine type
    // comes from the row itself, never hardcoded, so non-hospitality
    // fulfillment adapters work through this same service.
    const currentState = fulfillment.status;
    const transition = await engineService.transitionState(
      fulfillment.engine_type,
      currentState,
      params.action,
      params.actor,
      { ...(params.context ?? {}), transactionId: params.transactionId },
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
