/**
 * Generic resource-consumption service (plan Phase 5).
 *
 * Gives resource consumption a generic, capability-driven abstraction shared
 * by inventory / capacity / resource engines. The engine declares its
 * resource model (engines/types.ts ResourceConsumptionModel); an ADAPTER
 * resolves a transaction's commercial lines into typed ResourceRequirement[]
 * (the generic BOM line); this service:
 *
 *   - validates the resolved requirements against the engine's DECLARED model
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
import type {
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
  requirements: ResourceRequirement[];
  propertyId?: string | null;
  tenantId?: string | null;
}

export interface ResourceOperationParams {
  transactionId: string;
  engineType: string;
  /** The fulfillment-layer move that triggers the operation (e.g. 'deliver', 'cancel'). */
  action: string;
  actor: ResourceActor;
  actorId?: string | null;
  context?: Record<string, unknown>;
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
   * validate them against the engine's declared model. Fail-closed: an
   * undeclared kind or a negative quantity throws BEFORE any write.
   */
  async resolveForTransaction(
    supabase: SupabaseClient,
    transactionId: string,
    engineType: string,
    context?: Record<string, unknown>,
  ): Promise<ResourceRequirement[]> {
    if (!this.resolver) {
      throw new ResourceContractError(
        'No resource requirement resolver is wired for this service instance',
      );
    }
    const requirements = await this.resolver.resolveRequirements(supabase, transactionId, context);
    const resources = this.getResourceModel(engineType);
    assertValidResourceRequirements(resources, requirements);
    return requirements;
  }

  /** The engine's declared resource model (throws on an unknown engine). */
  private getResourceModel(engineType: string): ResourceConsumptionModel {
    const engine = getEngine(engineType as keyof EngineRegistry);
    return engine.capabilities.resources;
  }

  /**
   * Validate a resolved requirement set against the engine's model.
   * Fail-closed: throws ResourceContractError on any undeclared kind.
   */
  validate(
    engineType: string,
    requirements: ResourceRequirement[],
  ): void {
    const resources = this.getResourceModel(engineType);
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
      this.validate(params.engineType, params.requirements);
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
    const transition = await engineService.transitionState(
      params.engineType,
      params.currentState,
      params.action,
      params.actor,
      { ...(params.context ?? {}), transactionId: params.transactionId },
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
    const transition = await engineService.transitionState(
      params.engineType,
      params.currentState,
      params.action,
      params.actor,
      { ...(params.context ?? {}), transactionId: params.transactionId },
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
