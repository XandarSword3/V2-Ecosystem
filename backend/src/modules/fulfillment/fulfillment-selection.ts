/**
 * Fulfillment selection resolution (plan Stage 6 fix #2 & Phase F4).
 *
 * Invariant: for a required-fulfillment engine, the fulfillment selection is
 * MANDATORY BEFORE CONFIRMATION and is snapshotted into the transaction at
 * creation — it is part of the immutable commercial record, never left NULL
 * to be "decided later". The DB boundary enforces this: the confirm trigger
 * copies the snapshotted selection into the fulfillment row verbatim and
 * REFUSES to confirm an order whose selection is missing.
 *
 * Primary Contract (Phase F4):
 *   `fulfillmentSelection`: { mode: FulfillmentMode, destinationType: DestinationType, destinationRef: string | null }
 *   Validates directly against declared Engine A capability options.
 *
 * Legacy Adapter Boundary:
 *   Resolves legacy `orderType` (dine_in/takeaway/delivery/counter) ONLY when canonical
 *   fulfillmentSelection is not supplied.
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
  /** Canonical fulfillment mode */
  mode?: FulfillmentMode | null;
  /** Canonical destination type */
  destinationType?: DestinationType | null;
  /** Canonical destination reference (service location UUID, address, digital account, etc.) */
  destinationRef?: string | null;
  /** Optional nested canonical selection object */
  fulfillmentSelection?: {
    mode?: FulfillmentMode | null;
    destinationType?: DestinationType | null;
    destinationRef?: string | null;
  } | null;

  // === Legacy compatibility parameters (isolated adapter) ===
  orderType?: string | null;
  serviceLocationId?: string | null;
  tableNumber?: string | null;
  address?: string | null;
}

/**
 * Default destination type fallback per canonical mode when destinationType is omitted.
 */
const DEFAULT_DESTINATION_TYPE_PER_MODE: Readonly<Record<FulfillmentMode, DestinationType>> = {
  on_premise: 'on_premise_location',
  pickup: 'pickup_location',
  local_delivery: 'address',
  digital_delivery: 'digital_account',
  shipment: 'address',
  service_execution: 'service_location',
  none: 'none',
};

/**
 * Legacy order-type → typed mode/destination mapping (hospitality adapter boundary only).
 */
const LEGACY_ORDER_TYPE_TO_SELECTION: Readonly<
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
 * Canonical fulfillment selection is prioritized. Legacy orderType is consulted
 * only as a compatibility fallback.
 */
export function resolveFulfillmentSelection(
  engineType: keyof EngineRegistry,
  input: FulfillmentSelectionInput,
): FulfillmentSelection {
  const engine = getEngine(engineType);

  // 1. Check for canonical fulfillment selection input (primary path)
  const canonicalInput = input.fulfillmentSelection || input;
  const canonicalMode = canonicalInput.mode;

  if (canonicalMode) {
    const mode = canonicalMode;
    const destinationType: DestinationType =
      canonicalInput.destinationType || DEFAULT_DESTINATION_TYPE_PER_MODE[mode] || 'none';
    
    let destinationRef: string | null = null;
    if (mode !== 'none') {
      destinationRef =
        canonicalInput.destinationRef ??
        input.serviceLocationId ??
        input.address ??
        input.tableNumber ??
        null;
    }

    const selection: FulfillmentSelection = {
      mode,
      destinationType,
      destinationRef,
    };

    // Capability validation against THIS engine's declared options
    assertValidFulfillmentSelection(
      engine.capabilities.fulfillment,
      selection.mode,
      selection.destinationType,
    );

    return selection;
  }

  // 2. Legacy fallback path (isolated backward-compatibility adapter)
  const legacyOrderType = input.orderType;
  if (!legacyOrderType) {
    throw new FulfillmentContractError(
      `Fulfillment selection is required on engine '${engine.type}' — ` +
        `provide canonical 'fulfillmentSelection' or legacy 'orderType'`,
    );
  }

  const legacyBase = LEGACY_ORDER_TYPE_TO_SELECTION[legacyOrderType];
  if (!legacyBase) {
    throw new FulfillmentContractError(
      `Legacy order type '${legacyOrderType}' cannot be mapped to a fulfillment mode on engine '${engine.type}' — ` +
        `fulfillment selection must be resolvable before confirmation`,
    );
  }

  const destinationRef =
    legacyBase.mode === 'local_delivery'
      ? (input.address ?? null)
      : (input.serviceLocationId ?? input.tableNumber ?? null);

  const selection: FulfillmentSelection = {
    mode: legacyBase.mode,
    destinationType: legacyBase.destinationType,
    destinationRef,
  };

  // Capability validation against THIS engine's declared options
  assertValidFulfillmentSelection(
    engine.capabilities.fulfillment,
    selection.mode,
    selection.destinationType,
  );

  return selection;
}
