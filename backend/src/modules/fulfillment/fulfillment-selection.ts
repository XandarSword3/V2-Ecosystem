/**
 * Fulfillment selection resolution (plan Stage 6 fix #2).
 *
 * Invariant: for a required-fulfillment engine, the fulfillment selection is
 * MANDATORY BEFORE CONFIRMATION and is snapshotted into the transaction at
 * creation — it is part of the immutable commercial record, never left NULL
 * to be "decided later". The DB boundary enforces this: the confirm trigger
 * copies the snapshotted selection into the fulfillment row verbatim and
 * REFUSES to confirm an order whose selection is missing.
 *
 * This module resolves the selection from the commercial facts an order is
 * created with (order type → fulfillment mode, location/table/address →
 * destination) and validates the result against the ENGINE's own declared
 * capability options — typed domain values, never arbitrary strings.
 * Vertical vocabulary (dine_in/takeaway/delivery/counter) lives in this
 * resolver, not in the generic engine core or the DB.
 */
import { getEngine, type EngineRegistry } from '../../engines/registry.js';
import {
  assertValidFulfillmentSelection,
  FulfillmentContractError,
} from '../../engines/fulfillment-contract.js';
import type { DestinationType, FulfillmentMode } from '../../engines/types.js';

export interface FulfillmentSelection {
  mode: FulfillmentMode;
  destinationType: DestinationType;
  /** The concrete destination (service location id, table, address…). Nullable — an attribute of the selection, not the selection itself. */
  destinationRef: string | null;
}

export interface FulfillmentSelectionInput {
  orderType?: string | null;
  serviceLocationId?: string | null;
  tableNumber?: string | null;
  address?: string | null;
}

/**
 * Order-type → typed mode/destination mapping (Engine A hospitality
 * vocabulary, resolved here — never in the generic core or the DB).
 * 'counter' is the staff walk-up flow: served at the pickup counter.
 */
const ORDER_TYPE_TO_SELECTION: Readonly<
  Record<string, { mode: FulfillmentMode; destinationType: DestinationType }>
> = {
  dine_in: { mode: 'on_premise', destinationType: 'on_premise_location' },
  counter: { mode: 'pickup', destinationType: 'pickup_location' },
  takeaway: { mode: 'pickup', destinationType: 'pickup_location' },
  delivery: { mode: 'local_delivery', destinationType: 'address' },
};

/**
 * Resolve and validate the fulfillment selection for a new order.
 *
 * Throws FulfillmentContractError when the order cannot be mapped to a legal
 * selection for the engine — an order that cannot be fulfilled per the
 * capability contract must not be created as confirmable.
 */
export function resolveFulfillmentSelection(
  engineType: keyof EngineRegistry,
  input: FulfillmentSelectionInput,
): FulfillmentSelection {
  const engine = getEngine(engineType);
  const orderType = input.orderType ?? 'dine_in';

  const base = ORDER_TYPE_TO_SELECTION[orderType];
  if (!base) {
    throw new FulfillmentContractError(
      `Order type '${orderType}' cannot be mapped to a fulfillment mode on engine '${engine.type}' — ` +
        `fulfillment selection must be resolvable before confirmation`,
    );
  }

  const destinationRef =
    base.mode === 'local_delivery'
      ? (input.address ?? null)
      : (input.serviceLocationId ?? input.tableNumber ?? null);

  const selection: FulfillmentSelection = {
    mode: base.mode,
    destinationType: base.destinationType,
    destinationRef,
  };

  // Capability validation against THIS engine's declared options — if the
  // engine does not offer this mode/destination pair, the order cannot be
  // created (fail closed, never confirm-with-NULL).
  assertValidFulfillmentSelection(
    engine.capabilities.fulfillment,
    selection.mode,
    selection.destinationType,
  );

  return selection;
}
