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
  DestinationType,
  FulfillmentDefinition,
  FulfillmentMode,
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
 *   - required fulfillment must declare a fulfillment state machine;
 *   - every declared option's destinations must be legal for its mode;
 *   - an engine cannot declare both required fulfillment AND zero options.
 */
export function assertValidFulfillmentCapabilities(
  fulfillment: FulfillmentDefinition,
): void {
  if (fulfillment.required && !fulfillment.stateMachine) {
    throw new FulfillmentContractError(
      'Fulfillment is required but no fulfillment state machine is declared — the transaction could never complete',
    );
  }
  if (!fulfillment.required && fulfillment.stateMachine) {
    // Allowed: a machine may exist for tracking even when completion is not
    // gated on it — but it must be consistent (see options below).
  }
  if (fulfillment.options.length === 0) {
    if (fulfillment.required) {
      throw new FulfillmentContractError(
        'Fulfillment is required but no mode/destination options are declared',
      );
    }
    return;
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
