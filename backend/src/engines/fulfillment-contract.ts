/**
 * Generic fulfillment contract (plan Phase 2/6) — the boundary between the
 * generic Engine A core and any fulfillment adapter.
 *
 * The core knows ONLY what the capability contract declares. It never names a
 * vertical state, action, or concept — all vertical vocabulary belongs to the
 * adapters. What the core DOES know:
 *
 *   - whether fulfillment is REQUIRED before the transaction may complete;
 *   - which mode → destination combinations are legal (enforced at
 *     definition-registration time);
 *   - that completion of a required-fulfillment transaction must originate
 *     from the fulfillment layer (never from the transaction machine).
 *
 * The adapter supplies the fulfillment state machine and (transitionally,
 * until Stage 6) a legacy-status bridge. The core applies the bridge
 * mechanically and never treats the legacy column as canonical.
 */

import type {
  AutoHandoffPolicy,
  DestinationType,
  FulfillmentDefinition,
  FulfillmentMode,
  StateMachineDefinition,
} from './types.js';

/** The canonical transaction terminal that required fulfillment gates. */
export const COMPLETION_STATE = 'completed';

/**
 * Legal mode → destination combinations (the generic registry). Future modes
 * (shipment → address, digital_delivery → digital_account, …) extend this
 * registry — the core itself is unchanged when an adapter adds options.
 */
export const LEGAL_FULFILLMENT_COMBINATIONS: Readonly<Record<FulfillmentMode, readonly DestinationType[]>> = {
  none: ['none'],
  pickup: ['pickup_location'],
  on_premise: ['on_premise_location', 'room'],
  local_delivery: ['address'],
  shipment: ['address'],
  digital_delivery: ['digital_account'],
  service_execution: ['service_location'],
};

export class FulfillmentContractError extends Error {
  public readonly code = 'FULFILLMENT_CONTRACT_VIOLATION';
  constructor(message: string) {
    super(message);
    this.name = 'FulfillmentContractError';
  }
}

/** Whether the engine's capability contract gates transaction completion on fulfillment. */
export function isFulfillmentRequired(fulfillment: FulfillmentDefinition): boolean {
  return fulfillment.required;
}

/**
 * Validate a fulfillment capability declaration. Throws on any impossible
 * configuration — the boundary is enforced by code, not documentation:
 *   - required fulfillment must declare a machine binding for EVERY option
 *     mode (an unbound required mode could never complete);
 *   - a binding may only cover modes the engine declares as options;
 *   - no mode may be claimed by two bindings (ambiguous routing);
 *   - each binding's auto-handoff state must be a real state of ITS machine,
 *     and the machine must carry a transition to the completion state;
 *   - every declared option's destinations must be legal for its mode;
 *   - an engine cannot declare both required fulfillment AND zero options.
 */
export function assertValidFulfillmentCapabilities(
  fulfillment: FulfillmentDefinition,
): void {
  const bindings = fulfillment.modeMachines ?? [];
  if (fulfillment.required && bindings.length === 0) {
    throw new FulfillmentContractError(
      'Fulfillment is required but no fulfillment machine binding is declared — the transaction could never complete',
    );
  }
  if (fulfillment.options.length === 0) {
    if (fulfillment.required) {
      throw new FulfillmentContractError(
        'Fulfillment is required but no mode/destination options are declared',
      );
    }
    if (bindings.length > 0) {
      throw new FulfillmentContractError(
        'Fulfillment machine bindings declared but no mode/destination options exist to bind',
      );
    }
    return;
  }

  const claimedModes = new Set<FulfillmentMode>();
  for (const binding of bindings) {
    if (binding.modes.length === 0) {
      throw new FulfillmentContractError('A fulfillment machine binding must cover at least one mode');
    }
    for (const mode of binding.modes) {
      const option = fulfillment.options.find(o => o.mode === mode);
      if (!option) {
        throw new FulfillmentContractError(
          `Fulfillment machine binding covers mode '${mode}' but the engine does not declare it as an option`,
        );
      }
      if (claimedModes.has(mode)) {
        throw new FulfillmentContractError(
          `Fulfillment mode '${mode}' is bound by more than one machine — ambiguous routing`,
        );
      }
      claimedModes.add(mode);
    }
    if (binding.autoHandoff) {
      if (!binding.machine.states.includes(binding.autoHandoff.atState)) {
        throw new FulfillmentContractError(
          `Auto-handoff state '${binding.autoHandoff.atState}' is not in this binding's fulfillment machine states`,
        );
      }
      if (binding.autoHandoff.allowedActors.length === 0) {
        throw new FulfillmentContractError('Auto-handoff must declare at least one allowed actor');
      }
      const hasCompletion = binding.machine.transitions.some(t => t.to === COMPLETION_STATE);
      if (!hasCompletion) {
        throw new FulfillmentContractError(
          'Auto-handoff declared but this binding\'s machine has no transition to the completion state to derive the completion action from',
        );
      }
    }
  }
  if (fulfillment.required) {
    for (const option of fulfillment.options) {
      if (!claimedModes.has(option.mode)) {
        throw new FulfillmentContractError(
          `Fulfillment mode '${option.mode}' is required but has no machine binding — the transaction could never complete for it`,
        );
      }
    }
  }
  for (const option of fulfillment.options) {
    const legal = LEGAL_FULFILLMENT_COMBINATIONS[option.mode];
    if (!legal) {
      throw new FulfillmentContractError(`Unknown fulfillment mode: '${option.mode}'`);
    }
    for (const destination of option.destinations) {
      if (!legal.includes(destination)) {
        throw new FulfillmentContractError(
          `Impossible fulfillment combination: mode '${option.mode}' cannot serve destination '${destination}'`,
        );
      }
    }
  }
}

/**
 * Resolve the fulfillment machine bound to a mode (per-mode routing).
 * Returns undefined when the engine declares no fulfillment machine for the
 * mode. The generic core never names a vertical state — it reads the binding.
 */
export function resolveFulfillmentMachine<TFulfillmentStatus extends string = string>(
  fulfillment: FulfillmentDefinition<TFulfillmentStatus>,
  mode: FulfillmentMode,
): StateMachineDefinition<TFulfillmentStatus> | undefined {
  return (fulfillment.modeMachines ?? []).find(b => b.modes.includes(mode))?.machine;
}

/**
 * Resolve the auto-handoff policy bound to a mode (per-mode routing).
 * Returns undefined when that mode's binding declares no policy.
 */
export function resolveAutoHandoffPolicy<TFulfillmentStatus extends string = string>(
  fulfillment: FulfillmentDefinition<TFulfillmentStatus>,
  mode: FulfillmentMode,
): AutoHandoffPolicy<TFulfillmentStatus> | undefined {
  return (fulfillment.modeMachines ?? []).find(b => b.modes.includes(mode))?.autoHandoff;
}

/**
 * Validate a requested fulfillment mode/destination selection against the
 * engine's OWN declared capability options (plan Stage 6 fix). Typed domain
 * values only — arbitrary strings are rejected before they can reach the DB.
 *
 *   - the MODE IS MANDATORY: a null selection is a contract violation, not a
 *     "not decided yet". For a required-fulfillment engine the selection is
 *     snapshotted before confirmation and never left ambiguous;
 *   - the mode must be one of the engine's declared options;
 *   - if a destination type is given, it must be legal for THAT mode on
 *     THIS engine (not just the global registry).
 *
 * Throws FulfillmentContractError on any impossible selection.
 */
export function assertValidFulfillmentSelection(
  fulfillment: FulfillmentDefinition,
  mode: FulfillmentMode | null,
  destinationType: DestinationType | null,
): void {
  if (!mode) {
    throw new FulfillmentContractError(
      'Fulfillment mode is mandatory — a selection must be snapshotted before confirmation, never left null',
    );
  }
  const option = fulfillment.options.find((o) => o.mode === mode);
  if (!option) {
    throw new FulfillmentContractError(
      `Mode '${mode}' is not offered by this engine's fulfillment capability (offered: ${fulfillment.options.map(o => o.mode).join(', ') || 'none'})`,
    );
  }
  if (destinationType && !option.destinations.includes(destinationType)) {
    throw new FulfillmentContractError(
      `Destination '${destinationType}' is not valid for mode '${mode}' on this engine (legal for this mode: ${option.destinations.join(', ')})`,
    );
  }
}

/**
 * The completion gate — capability-driven enforcement (plan Phase 2 fix #1).
 *
 * A move on the TRANSACTION machine whose target is the completion state is
 * only legal when fulfillment is NOT required. When fulfillment is required,
 * completion must originate from the fulfillment layer: the adapter's machine
 * carries the terminal → completed transition, which the layered validator
 * executes after the fulfillment layer reached its handoff/terminal condition.
 *
 * @returns an error message when the move is forbidden, or null when allowed.
 */
export function assertTransactionCompletionAllowed(
  fulfillment: FulfillmentDefinition,
  targetState: string,
): string | null {
  if (isFulfillmentRequired(fulfillment) && targetState === COMPLETION_STATE) {
    return (
      `Transaction cannot complete at the transaction layer while fulfillment is required — ` +
      `the fulfillment layer must reach its terminal/handoff state first`
    );
  }
  return null;
}
