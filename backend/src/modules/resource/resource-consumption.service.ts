/**
 * Generic resource-consumption service (plan Phase 5).
 *
 * Gives resource consumption a generic, capability-driven abstraction shared
 * by inventory / capacity / resource engines. The engine declares its
 * resource model (engines/types.ts ResourceConsumptionModel); an ADAPTER
 * resolves a transaction's commercial lines into typed ResourceRequirement[]
 * (the generic BOM line); this service:
 *
 *   - validates the resolved requirements against the DECLARED model for
 *     (engine, mode) — MODE-AWARE (plan Phase 5): the engine-level model is
 *     the default, and a mode binding may override it (digital_delivery
 *     consumes nothing), so an engine-wide setting can never force a mode
 *     into resource behavior it cannot satisfy
 *     (fail closed — an undeclared kind is a contract violation);
 *   - allocates (reserves), consumes (deducts on fulfillment), and releases
 *     (compensates on cancellation) through the engine's layered validator,
 *     so the move is legal for THIS engine before any write;
 *   - persists allocation state (resource_allocations + append-only events)
 *     via RPCs — the same pattern as fulfillment.
 *
 * It contains NO vertical vocabulary: the hospitality BOM (order items →
 * ingredient lines) is resolved by adapters/hospitality/resources.ts, and
 * any future adapter (capacity slots, staff time) plugs in the same way.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getEngineService } from '../../engines/engine-service.js';
import { getEngine, type EngineRegistry } from '../../engines/registry.js';
import {
  assertValidResourceRequirements,
  ResourceContractError,
} from '../../engines/resource-contract.js';
import { COMPLETION_STATE } from '../../engines/fulfillment-contract.js';
import type {
  FulfillmentMode,
  ResourceConsumptionModel,
  ResourceRequirement,
} from '../../engines/types.js';
import { logger } from '../../utils/logger.js';

export type ResourceActor = 'system' | 'staff' | 'customer' | 'admin';

/** Adapter hook: resolve a transaction's commercial lines into generic requirements. */
export interface ResourceRequirementResolver {
  resolveRequirements(
    supabase: SupabaseClient,
    transactionId: string,
    context?: Record<string, unknown>,
  ): Promise<ResourceRequirement[]>;
}

export interface ResourceAllocateParams {
  transactionId: string;
  engineType: string;
  /** The transaction's fulfillment MODE — selects the mode's resource model (mode-aware). */
  mode?: FulfillmentMode;
  requirements: ResourceRequirement[];
  propertyId?: string | null;
  tenantId?: string | null;
}

export interface ResourceOperationParams {
  transactionId: string;
  engineType: string;
  /** The transaction's fulfillment MODE — selects the mode's resource model and mode-scoped validation. */
  mode?: FulfillmentMode;
  /** The fulfillment-layer move that triggers the operation (e.g. 'deliver', 'cancel'). */
  action: string;
  actor: ResourceActor;
  actorId?: string | null;
  context?: Record<string, unknown>;
}

/** Facts of one canonical state move, for the mode-aware lifecycle driver. */
export interface ResourceLifecycleMoveParams {
  transactionId: string;
  engineType: string;
  /** The transaction's fulfillment MODE — selects the mode's resource model. */
  mode?: FulfillmentMode;
  /** The move that was performed (e.g. 'confirm', 'deliver', 'cancel'). */
  action: string;
  actor: ResourceActor;
  actorId?: string | null;
  /** Canonical state BEFORE the move (the row's status / transactions.status). */
  currentState: string;
  /** Canonical target state of the move. */
  targetState: string;
  /** Which layer performed the move. */
  layer: 'transaction' | 'fulfillment';
  propertyId?: string | null;
  tenantId?: string | null;
  context?: Record<string, unknown>;
}

export interface ResourceLifecycleResult {
  ok: boolean;
  op: 'none' | 'allocated' | 'consumed' | 'released';
  error?: string;
  allocated?: number;
  consumed?: number;
  released?: number;
}

export interface ResourceAllocationRow {
  id: string;
  transaction_id: string;
  engine_type: string;
  kind: string;
  resource_ref: string;
  quantity: number;
  unit: string | null;
  status: 'allocated' | 'consumed' | 'released';
  allocated_at: string | null;
  consumed_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ResourceConsumptionService {
  constructor(private readonly resolver?: ResourceRequirementResolver) {}

  /**
   * Resolve a transaction's resource requirements through the adapter, then
   * validate them against the model for (engine, mode). Fail-closed: an
   * undeclared kind or a negative quantity throws BEFORE any write.
   */
  async resolveForTransaction(
    supabase: SupabaseClient,
    transactionId: string,
    engineType: string,
    mode?: FulfillmentMode,
    context?: Record<string, unknown>,
  ): Promise<ResourceRequirement[]> {
    if (!this.resolver) {
      throw new ResourceContractError(
        'No resource requirement resolver is wired for this service instance',
      );
    }
    const requirements = await this.resolver.resolveRequirements(supabase, transactionId, context);
    const resources = this.getResourceModel(engineType, mode);
    assertValidResourceRequirements(resources, requirements);
    return requirements;
  }

  /**
   * The resource model for (engine, mode) — MODE-AWARE (plan Phase 5). The
   * engine-level model is the default; a mode binding may override it for
   * its modes (digital_delivery overrides to 'none' — no physical
   * inventory, no handoff step). An unknown mode resolves to the engine
   * default; the model itself then fails closed for the mode's requirements.
   * Throws on an unknown engine.
   */
  private getResourceModel(engineType: string, mode?: FulfillmentMode): ResourceConsumptionModel {
    const engine = getEngine(engineType as keyof EngineRegistry);
    if (mode) {
      const binding = (engine.capabilities.fulfillment.modeMachines ?? [])
        .find(b => b.modes.includes(mode));
      if (binding?.resources) return binding.resources;
    }
    return engine.capabilities.resources;
  }

  /**
   * Validate a resolved requirement set against the model for (engine, mode).
   * Fail-closed: throws ResourceContractError on any undeclared kind.
   */
  validate(
    engineType: string,
    requirements: ResourceRequirement[],
    mode?: FulfillmentMode,
  ): void {
    const resources = this.getResourceModel(engineType, mode);
    assertValidResourceRequirements(resources, requirements);
  }

  /**
   * Allocate (reserve) the requirements for a transaction. Validates the
   * requirement set against the engine's declared model, then persists the
   * allocation rows via RPC (idempotent — ON CONFLICT DO NOTHING).
   */
  async allocate(
    supabase: SupabaseClient,
    params: ResourceAllocateParams,
  ): Promise<{ ok: boolean; error?: string; allocated?: number }> {
    try {
      this.validate(params.engineType, params.requirements, params.mode);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[Resource] allocate rejected by capability validation', {
        transactionId: params.transactionId,
        engineType: params.engineType,
        error: message,
      });
      return { ok: false, error: message };
    }

    const { data, error } = await supabase.rpc('allocate_resources', {
      p_transaction_id: params.transactionId,
      p_engine_type: params.engineType,
      p_property_id: params.propertyId ?? null,
      p_tenant_id: params.tenantId ?? null,
      p_requirements: params.requirements,
    });
    if (error) {
      logger.error('[Resource] allocate failed', { transactionId: params.transactionId, error: error.message });
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success) {
      return { ok: false, error: row?.error_message ?? 'allocate_resources failed' };
    }
    return { ok: true, allocated: row.allocated ?? params.requirements.length };
  }

  /**
   * Consume (deduct) allocated resources when the engine's consumption point
   * is reached. The CALLER supplies the current canonical state (they read
   * the fulfillment row — see FulfillmentService.getForTransaction); the
   * move is validated through the engine's layered validator, and the RPC is
   * only called for a legal, layer-canonical move. Missing state FAILS
   * CLOSED — the generic service never assumes a vertical default state.
   */
  async consume(
    supabase: SupabaseClient,
    params: ResourceOperationParams & { currentState: string },
  ): Promise<{ ok: boolean; error?: string; consumed?: number }> {
    const engineService = getEngineService();
    // Mode-scoped validation: the move is legal only on the selected mode's
    // binding (a digital row can never be consumed with a hospitality
    // action). consume() must only be reached when the mode's model says
    // consumption happens here — the declaration gates it.
    const transition = await engineService.transitionState(
      params.engineType,
      params.currentState,
      params.action,
      params.actor,
      { ...(params.context ?? {}), transactionId: params.transactionId },
      params.mode,
    );
    if (!transition.allowed) {
      return { ok: false, error: transition.error ?? 'Resource consume move rejected' };
    }

    const { data, error } = await supabase.rpc('consume_resources', {
      p_transaction_id: params.transactionId,
      p_engine_type: params.engineType,
      p_action: params.action,
      p_actor: params.actor,
      p_actor_id: params.actorId ?? null,
    });
    if (error) {
      logger.error('[Resource] consume failed', { transactionId: params.transactionId, error: error.message });
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success) {
      return { ok: false, error: row?.error_message ?? 'consume_resources failed' };
    }
    return { ok: true, consumed: row.consumed ?? 0 };
  }

  /**
   * Release (restore/compensate) allocated resources on cancellation.
   * The CALLER supplies the current canonical state; the engine's
   * cancellation path (confirmed → cancelled, or any fulfillment stage →
   * cancelled) is validated through the layered validator; the RPC is only
   * called for a legal move. Missing state FAILS CLOSED.
   */
  async release(
    supabase: SupabaseClient,
    params: ResourceOperationParams & { currentState: string },
  ): Promise<{ ok: boolean; error?: string; released?: number }> {
    const engineService = getEngineService();
    // Mode-scoped validation (same as consume): cancellation is only legal
    // on the selected mode's binding.
    const transition = await engineService.transitionState(
      params.engineType,
      params.currentState,
      params.action,
      params.actor,
      { ...(params.context ?? {}), transactionId: params.transactionId },
      params.mode,
    );
    if (!transition.allowed) {
      return { ok: false, error: transition.error ?? 'Resource release move rejected' };
    }

    const { data, error } = await supabase.rpc('release_resources', {
      p_transaction_id: params.transactionId,
      p_engine_type: params.engineType,
      p_action: params.action,
      p_actor: params.actor,
      p_actor_id: params.actorId ?? null,
    });
    if (error) {
      logger.error('[Resource] release failed', { transactionId: params.transactionId, error: error.message });
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success) {
      return { ok: false, error: row?.error_message ?? 'release_resources failed' };
    }
    return { ok: true, released: row.released ?? 0 };
  }

  /**
   * MODE-AWARE lifecycle driver (plan Phase 5 — resume: wire resources into
   * the order lifecycle). Given the canonical move facts of a persisted state
   * change, performs the resource operation the (engine, mode) model
   * declares — and NOTHING when the mode's model is 'none' (digital
   * delivery skips the whole inventory lifecycle):
   *
   *   - cancellation → release (compensation) when the model reverses on
   *     cancel, validated mode-scoped;
   *   - economic confirmation (layer 'transaction', target 'confirmed') with
   *     allocation on_purchase/on_confirm → resolve requirements through the
   *     resolver and allocate;
   *   - consumption: on_fulfillment_handoff fires when the fulfillment layer
   *     reaches a state from which the transaction completes (the handoff
   *     condition — derived generically from the mode binding's machine, so
   *     it works for hospitality 'handed_off' AND a digital-style
   *     'delivered' the same way); on_transaction_complete fires at
   *     'completed'; on_purchase fires at confirmation.
   *
   * Consumption/release moves are validated mode-scoped (the selected mode's
   * binding is the authority) before any write.
   */
  async handleLifecycleMove(
    supabase: SupabaseClient,
    params: ResourceLifecycleMoveParams,
  ): Promise<ResourceLifecycleResult> {
    const model = this.getResourceModel(params.engineType, params.mode);
    if (model.type === 'none') {
      return { ok: true, op: 'none' };
    }

    // 1. Cancellation → compensation.
    if (params.targetState === 'cancelled') {
      if (!model.reversalOnCancel) return { ok: true, op: 'none' };
      const release = await this.release(supabase, {
        transactionId: params.transactionId,
        engineType: params.engineType,
        mode: params.mode,
        action: params.action,
        actor: params.actor,
        actorId: params.actorId,
        currentState: params.currentState,
        context: params.context,
      });
      return { ok: release.ok, op: 'released', error: release.error, released: release.released };
    }

    // 2. Economic confirmation → allocation.
    if (
      params.layer === 'transaction' &&
      params.targetState === 'confirmed' &&
      (model.allocation === 'on_purchase' || model.allocation === 'on_confirm')
    ) {
      if (!this.resolver) {
        return {
          ok: false,
          op: 'none',
          error: 'Resource model allocates at confirmation but no requirement resolver is wired for this lifecycle move',
        };
      }
      try {
        const requirements = await this.resolver.resolveRequirements(supabase, params.transactionId, params.context);
        const allocate = await this.allocate(supabase, {
          transactionId: params.transactionId,
          engineType: params.engineType,
          mode: params.mode,
          requirements,
          propertyId: params.propertyId,
          tenantId: params.tenantId,
        });
        return { ok: allocate.ok, op: 'allocated', error: allocate.error, allocated: allocate.allocated };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, op: 'none', error: message };
      }
    }

    // 3. Consumption timing.
    let shouldConsume = false;
    if (model.consumption === 'on_fulfillment_handoff') {
      shouldConsume =
        params.layer === 'fulfillment' &&
        this.isHandoffReached(params.engineType, params.mode, params.targetState) &&
        // Exactly-once at the service boundary: consumption fires when the
        // move ENTERS a handoff-reaching state (deliver → handed_off), and
        // must NOT fire again when the follow-up move LEAVES it (complete →
        // completed). The DB RPC is idempotent as the backstop; this keeps
        // the redundant call from happening at all.
        !this.isHandoffReached(params.engineType, params.mode, params.currentState);
    } else if (model.consumption === 'on_transaction_complete') {
      shouldConsume = params.targetState === 'completed';
    } else if (model.consumption === 'on_purchase') {
      shouldConsume = params.layer === 'transaction' && params.targetState === 'confirmed';
    }
    if (shouldConsume) {
      const consume = await this.consume(supabase, {
        transactionId: params.transactionId,
        engineType: params.engineType,
        mode: params.mode,
        action: params.action,
        actor: params.actor,
        actorId: params.actorId,
        currentState: params.currentState,
        context: params.context,
      });
      return { ok: consume.ok, op: 'consumed', error: consume.error, consumed: consume.consumed };
    }

    return { ok: true, op: 'none' };
  }

  /**
   * Whether the fulfillment layer reached its handoff condition: the target
   * state is 'completed' (cross-layer completion, incl. auto-handoff) or is
   * a state from which the mode binding's machine completes (hospitality
   * 'handed_off', digital-style 'delivered'). Derived from the machine — the
   * generic core never names a vertical handoff state.
   */
  private isHandoffReached(
    engineType: string,
    mode: FulfillmentMode | undefined,
    targetState: string,
  ): boolean {
    if (targetState === COMPLETION_STATE) return true;
    if (!mode) return false;
    const binding = (getEngine(engineType as keyof EngineRegistry).capabilities.fulfillment.modeMachines ?? [])
      .find(b => b.modes.includes(mode));
    if (!binding) return false;
    return binding.machine.transitions.some(t => t.from === targetState && t.to === COMPLETION_STATE);
  }

  /**
   * Read the current allocation state for a transaction. FAIL-CLOSED: a read
   * error THROWS — it is never confused with "no allocations". Null is
   * returned ONLY when no allocation rows exist.
   */
  async getForTransaction(
    supabase: SupabaseClient,
    transactionId: string,
  ): Promise<ResourceAllocationRow[] | null> {
    const { data, error } = await supabase
      .from('resource_allocations')
      .select('*')
      .eq('transaction_id', transactionId);
    if (error) {
      logger.error('[Resource] Failed to read allocations', { transactionId, error: error.message });
      throw new Error(`Failed to read resource allocations for transaction ${transactionId}: ${error.message}`);
    }
    return (data as ResourceAllocationRow[]) ?? null;
  }

}

let _resourceConsumptionService: ResourceConsumptionService | null = null;

/** Get the singleton resource consumption service (no resolver — wiring is explicit per call site). */
export function getResourceConsumptionService(): ResourceConsumptionService {
  if (!_resourceConsumptionService) {
    _resourceConsumptionService = new ResourceConsumptionService();
  }
  return _resourceConsumptionService;
}
