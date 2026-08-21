/**
 * Generic resource-consumption contract (plan Phase 5).
 *
 * The generic boundary for HOW an engine consumes resources, adapter-agnostic:
 * the core knows only the declared model (which generic kinds, when
 * allocation/consumption happens, whether cancellation reverses it) and
 * enforces it with code. Vertical resources — the hospitality BOM, capacity
 * slots, staff rosters — are resolved by ADAPTERS into typed
 * ResourceRequirement[] and never appear here.
 *
 * Enforcement:
 *   - impossible configurations are rejected at definition-registration time
 *     (a non-consuming engine cannot declare kinds/timing; a consuming
 *     engine must declare kinds; consumption tied to fulfillment handoff
 *     requires a required fulfillment layer with a machine);
 *   - a requested requirement set is validated against the engine's declared
 *     model before any allocation/consumption write (fail closed).
 */

import type { ResourceConsumptionModel, ResourceRequirement } from './types.js';
import type { FulfillmentDefinition, ExecutionDefinition } from './types.js';

export class ResourceContractError extends Error {
  public readonly code = 'RESOURCE_CONTRACT_VIOLATION';
  constructor(message: string) {
    super(message);
    this.name = 'ResourceContractError';
  }
}

/**
 * Validate an engine's declared resource-consumption model at registration.
 * Throws on any impossible configuration — enforced by code, not convention.
 */
export function assertValidResourceConsumption(
  resources: ResourceConsumptionModel,
  fulfillment: FulfillmentDefinition,
  execution?: ExecutionDefinition,
): void {
  if (resources.type === 'none') {
    return;
  }
  if (!resources.kinds || resources.kinds.length === 0) {
    throw new ResourceContractError(
      `Resource consumption model '${resources.type}' must declare at least one resource kind`,
    );
  }
  // Consumption tied to fulfillment handoff requires a required fulfillment
  // layer — you cannot consume on a handoff that never happens.
  if (resources.consumption === 'on_fulfillment_handoff') {
    if (!fulfillment.required) {
      throw new ResourceContractError(
        "Resource consumption on 'on_fulfillment_handoff' requires a required fulfillment layer — the engine cannot consume on a handoff it never performs",
      );
    }
    if (!fulfillment.stateMachine) {
      throw new ResourceContractError(
        "Resource consumption on 'on_fulfillment_handoff' requires a fulfillment state machine to determine when handoff occurs",
      );
    }
  }
  // Allocation on fulfillment start requires SOME declared way to detect it:
  // a fulfillment machine, or an execution model with states (engines like
  // shared_capacity_access model fulfillment start in the transaction machine
  // — valid → active on entry — and declare it via execution.states).
  if (resources.allocation === 'on_fulfillment_start') {
    const hasFulfillmentMachine = Boolean(fulfillment.stateMachine);
    const hasExecutionModel = Boolean(execution?.enabled && execution.states.length > 0);
    if (!hasFulfillmentMachine && !hasExecutionModel) {
      throw new ResourceContractError(
        "Resource allocation on 'on_fulfillment_start' requires a fulfillment machine OR an execution model with states to determine when fulfillment starts",
      );
    }
  }
}

/**
 * Validate a transaction's resolved requirement set against the engine's
 * declared resource model BEFORE any allocation/consumption write.
 * Fail-closed: a requirement whose kind the engine does not declare is a
 * contract violation, never silently accepted.
 */
export function assertValidResourceRequirements(
  resources: ResourceConsumptionModel,
  requirements: ResourceRequirement[],
): void {
  if (resources.type === 'none') {
    if (requirements.length > 0) {
      throw new ResourceContractError(
        "Engine declares no resource consumption but requirements were resolved — impossible configuration",
      );
    }
    return;
  }
  for (const requirement of requirements) {
    if (!resources.kinds.includes(requirement.kind)) {
      throw new ResourceContractError(
        `Resource kind '${requirement.kind}' is not declared by this engine's resource model (declared: ${resources.kinds.join(', ')})`,
      );
    }
    if (!requirement.ref) {
      throw new ResourceContractError('Resource requirement ref must be a non-empty domain reference');
    }
    if (requirement.quantity <= 0) {
      throw new ResourceContractError(`Resource requirement quantity must be positive (got ${requirement.quantity})`);
    }
  }
}
