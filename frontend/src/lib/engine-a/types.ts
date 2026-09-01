/**
 * Canonical Engine A frontend domain contracts (plan F1).
 *
 * The frontend consumes THESE typed contracts instead of inferring
 * semantics from arbitrary API JSON. The unions mirror the backend engine
 * definitions exactly (backend/src/engines/types.ts and
 * engines/definitions/instant-transaction.ts) so a frontend component can
 * ask "is this a canonical state?" through a type guard, never by comparing
 * against a guessed string list.
 *
 * Two-layer rule (Stage 6): a transaction's fulfillment is NEVER inferred
 * from transactions.status. The transaction layer owns
 * pending/confirmed/completed/cancelled; the fulfillment layer owns
 * queued/in_progress/ready/handed_off (per-mode machine states). Components
 * keying on fulfillment MUST consume FulfillmentState, not TransactionState.
 */

// ============================================
// Engine identity
// ============================================

export type EngineType =
  | 'instant_transaction'
  | 'time_exclusive_reservation'
  | 'shared_capacity_access'
  | 'ongoing_entitlement'
  | 'platform_entitlement';

// ============================================
// Layered state — the canonical unions
// ============================================

/** Engine A transaction-layer states (instant_transaction machine). */
export type TransactionState = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/**
 * Engine A fulfillment-layer states — the union of ALL mode-specific states.
 * Which subset applies depends on the order's fulfillmentMode:
 *
 *   Hospitality (on_premise/pickup/local_delivery):
 *     queued → in_progress → ready → handed_off
 *
 *   Digital (digital_delivery):
 *     provisioning → provisioned → delivered
 *
 *   Shipment (shipment):  (future)
 *     allocated → picking → packed → shipped → in_transit → delivered
 *
 *   Service (service_execution):  (future)
 *     received → working → ready → collected
 *
 * NEVER inferred from transactions.status — read from the fulfillment
 * row / fulfillmentStatus payload. The frontend must check
 * fulfillmentMode to know which subset of states is active.
 */
export type FulfillmentState =
  | 'queued' | 'in_progress' | 'ready' | 'handed_off'   // hospitality
  | 'provisioning' | 'provisioned' | 'delivered'         // digital
  | 'allocated' | 'picking' | 'packed' | 'shipped' | 'in_transit' // shipment (future)
  | 'received' | 'working' | 'collected';                 // service (future)

/**
 * The fulfillment mode tells the frontend which state machine
 * governs this order. Derived from fulfillments.mode or
 * metadata.fulfillment_mode.
 */
export type FulfillmentMode =
  | 'on_premise' | 'pickup' | 'local_delivery'
  | 'digital_delivery'
  | 'shipment'
  | 'service_execution'
  | 'none';

/**
 * Every state a frontend order surface may see, in canonical form: the
 * transaction layer, the fulfillment layer, and the cross-layer outcomes
 * (complete/cancel write both layers).
 */
export type CanonicalOrderState = TransactionState | FulfillmentState | 'completed' | 'cancelled';

export function isTransactionState(value: string): value is TransactionState {
  return value === 'pending' || value === 'confirmed' || value === 'completed' || value === 'cancelled';
}

export function isFulfillmentState(value: string): value is FulfillmentState {
  return (
    // hospitality
    value === 'queued' || value === 'in_progress' || value === 'ready' || value === 'handed_off'
    // digital
    || value === 'provisioning' || value === 'provisioned' || value === 'delivered'
    // shipment (future)
    || value === 'allocated' || value === 'picking' || value === 'packed' || value === 'shipped' || value === 'in_transit'
    // service (future)
    || value === 'received' || value === 'working' || value === 'collected'
  );
}

/** Canonical fulfillment-layer states (vs transaction-layer statuses). */
export const FULFILLMENT_LAYER_STATES: readonly FulfillmentState[] = [
  // hospitality
  'queued', 'in_progress', 'ready', 'handed_off',
  // digital
  'provisioning', 'provisioned', 'delivered',
  // shipment (future)
  'allocated', 'picking', 'packed', 'shipped', 'in_transit',
  // service (future)
  'received', 'working', 'collected',
];

/**
 * Returns the subset of FulfillmentStates that apply to a given mode.
 * The frontend uses this to render mode-specific columns/actions.
 */
export function statesForMode(mode: FulfillmentMode | null | undefined): FulfillmentState[] {
  switch (mode) {
    case 'on_premise':
    case 'pickup':
    case 'local_delivery':
      return ['queued', 'in_progress', 'ready', 'handed_off'];
    case 'digital_delivery':
      return ['provisioning', 'provisioned', 'delivered'];
    case 'shipment':
      return ['allocated', 'picking', 'packed', 'shipped', 'in_transit', 'delivered'];
    case 'service_execution':
      return ['received', 'working', 'ready', 'collected'];
    case 'none':
    default:
      return [];
  }
}

// ============================================
// Mode-specific state metadata (F1)
// ============================================
// Each fulfillment mode defines its own ordered state machine.
// The staff operating surface derives columns, labels, actions,
// transitions, and terminal states from this config — never from
// hardcoded hospitality arrays.

/** Metadata for one state within a mode's fulfillment machine. */
export interface ModeStateMetadata {
  /** Human-readable column/action label. */
  label: string;
  /** Tailwind classes for the column background. */
  bg: string;
  /** Tailwind classes for the column border. */
  border: string;
  /** Tailwind classes for the column text. */
  text: string;
  /** Label for the quick-action button in this column (null = no action). */
  actionLabel: string | null;
  /** Tailwind classes for the action button background. */
  actionBg: string;
  /** Whether this state is terminal (no further transitions). */
  terminal: boolean;
}

/** The complete state machine config for one fulfillment mode. */
export interface ModeStateConfig {
  /** Ordered states — each entry is a board column. */
  states: readonly FulfillmentState[];
  /** Per-state metadata. */
  metadata: Record<FulfillmentState, ModeStateMetadata>;
  /** Returns the next canonical target state for a given current state,
   *  or null if no forward transition exists (waiting on dispatch / terminal). */
  nextTarget: (current: FulfillmentState) => FulfillmentState | null;
}

function hospitalityMeta(state: FulfillmentState): ModeStateMetadata {
  const map: Record<string, ModeStateMetadata> = {
    queued: {
      label: 'Queued',
      bg: 'bg-indigo-50 dark:bg-indigo-900/10',
      border: 'border-indigo-300 dark:border-indigo-700',
      text: 'text-indigo-700 dark:text-indigo-300',
      actionLabel: 'Start Prep',
      actionBg: 'bg-indigo-600 hover:bg-indigo-700',
      terminal: false,
    },
    in_progress: {
      label: 'In Progress',
      bg: 'bg-orange-50 dark:bg-orange-900/10',
      border: 'border-orange-300 dark:border-orange-700',
      text: 'text-orange-700 dark:text-orange-300',
      actionLabel: 'Mark Ready',
      actionBg: 'bg-orange-500 hover:bg-orange-600',
      terminal: false,
    },
    ready: {
      label: 'Ready',
      bg: 'bg-green-50 dark:bg-green-900/10',
      border: 'border-green-300 dark:border-green-700',
      text: 'text-green-700 dark:text-green-300',
      actionLabel: null,
      actionBg: '',
      terminal: false,
    },
    handed_off: {
      label: 'Served',
      bg: 'bg-purple-50 dark:bg-purple-900/10',
      border: 'border-purple-300 dark:border-purple-700',
      text: 'text-purple-700 dark:text-purple-300',
      actionLabel: null,         // terminal fulfillment state; 'complete' is a transaction-layer move
      actionBg: '',
      terminal: true,
    },
  };
  return map[state];
}

function digitalMeta(state: FulfillmentState): ModeStateMetadata {
  const map: Record<string, ModeStateMetadata> = {
    provisioning: {
      label: 'Provisioning',
      bg: 'bg-cyan-50 dark:bg-cyan-900/10',
      border: 'border-cyan-300 dark:border-cyan-700',
      text: 'text-cyan-700 dark:text-cyan-300',
      actionLabel: 'Mark Provisioned',
      actionBg: 'bg-cyan-600 hover:bg-cyan-700',
      terminal: false,
    },
    provisioned: {
      label: 'Provisioned',
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-300 dark:border-blue-700',
      text: 'text-blue-700 dark:text-blue-300',
      actionLabel: 'Mark Delivered',
      actionBg: 'bg-blue-600 hover:bg-blue-700',
      terminal: false,
    },
    delivered: {
      label: 'Delivered',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-700 dark:text-emerald-300',
      actionLabel: null,
      actionBg: '',
      terminal: true,
    },
  };
  return map[state];
}

function shipmentMeta(state: FulfillmentState): ModeStateMetadata {
  const map: Record<string, ModeStateMetadata> = {
    allocated: {
      label: 'Allocated',
      bg: 'bg-sky-50 dark:bg-sky-900/10',
      border: 'border-sky-300 dark:border-sky-700',
      text: 'text-sky-700 dark:text-sky-300',
      actionLabel: 'Start Picking',
      actionBg: 'bg-sky-600 hover:bg-sky-700',
      terminal: false,
    },
    picking: {
      label: 'Picking',
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-300',
      actionLabel: 'Mark Packed',
      actionBg: 'bg-amber-600 hover:bg-amber-700',
      terminal: false,
    },
    packed: {
      label: 'Packed',
      bg: 'bg-orange-50 dark:bg-orange-900/10',
      border: 'border-orange-300 dark:border-orange-700',
      text: 'text-orange-700 dark:text-orange-300',
      actionLabel: 'Ship',
      actionBg: 'bg-orange-600 hover:bg-orange-700',
      terminal: false,
    },
    shipped: {
      label: 'Shipped',
      bg: 'bg-violet-50 dark:bg-violet-900/10',
      border: 'border-violet-300 dark:border-violet-700',
      text: 'text-violet-700 dark:text-violet-300',
      actionLabel: null,
      actionBg: '',
      terminal: false,
    },
    in_transit: {
      label: 'In Transit',
      bg: 'bg-indigo-50 dark:bg-indigo-900/10',
      border: 'border-indigo-300 dark:border-indigo-700',
      text: 'text-indigo-700 dark:text-indigo-300',
      actionLabel: null,
      actionBg: '',
      terminal: false,
    },
    delivered: {
      label: 'Delivered',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-700 dark:text-emerald-300',
      actionLabel: null,
      actionBg: '',
      terminal: true,
    },
  };
  return map[state];
}

function serviceMeta(state: FulfillmentState): ModeStateMetadata {
  const map: Record<string, ModeStateMetadata> = {
    received: {
      label: 'Received',
      bg: 'bg-slate-50 dark:bg-slate-800/10',
      border: 'border-slate-300 dark:border-slate-700',
      text: 'text-slate-700 dark:text-slate-300',
      actionLabel: 'Start Work',
      actionBg: 'bg-slate-600 hover:bg-slate-700',
      terminal: false,
    },
    working: {
      label: 'Working',
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-300',
      actionLabel: 'Mark Ready',
      actionBg: 'bg-amber-600 hover:bg-amber-700',
      terminal: false,
    },
    ready: {
      label: 'Ready for Collection',
      bg: 'bg-green-50 dark:bg-green-900/10',
      border: 'border-green-300 dark:border-green-700',
      text: 'text-green-700 dark:text-green-300',
      actionLabel: null,
      actionBg: '',
      terminal: false,
    },
    collected: {
      label: 'Collected',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-700 dark:text-emerald-300',
      actionLabel: null,
      actionBg: '',
      terminal: true,
    },
  };
  return map[state];
}

const HOSPITALITY_NEXT: Record<string, FulfillmentState | null> = {
  queued: 'in_progress',
  in_progress: 'ready',
  ready: null,            // waiting on dispatch — not terminal in the fulfillment machine
  handed_off: null,       // terminal fulfillment state; 'completed' is transaction-layer
};
const DIGITAL_NEXT: Record<string, FulfillmentState | null> = {
  provisioning: 'provisioned',
  provisioned: 'delivered',
  delivered: null,
};
const SHIPMENT_NEXT: Record<string, FulfillmentState | null> = {
  allocated: 'picking',
  picking: 'packed',
  packed: 'shipped',
  shipped: 'in_transit',
  in_transit: 'delivered',
  delivered: null,
};
const SERVICE_NEXT: Record<string, FulfillmentState | null> = {
  received: 'working',
  working: 'ready',
  ready: 'collected',
  collected: null,
};

function makeConfig(
  states: readonly FulfillmentState[],
  metaFn: (s: FulfillmentState) => ModeStateMetadata,
  nextMap: Record<string, FulfillmentState | null>,
): ModeStateConfig {
  const metadata: Record<string, ModeStateMetadata> = {};
  for (const s of states) metadata[s] = metaFn(s);
  return {
    states,
    metadata: metadata as Record<FulfillmentState, ModeStateMetadata>,
    nextTarget: (current) => nextMap[current] ?? null,
  };
}

const MODE_CONFIGS: Record<
  'on_premise' | 'pickup' | 'local_delivery' | 'digital_delivery' | 'shipment' | 'service_execution',
  ModeStateConfig
> = {
  on_premise: makeConfig(['queued', 'in_progress', 'ready', 'handed_off'], hospitalityMeta, HOSPITALITY_NEXT),
  pickup: makeConfig(['queued', 'in_progress', 'ready', 'handed_off'], hospitalityMeta, HOSPITALITY_NEXT),
  local_delivery: makeConfig(['queued', 'in_progress', 'ready', 'handed_off'], hospitalityMeta, HOSPITALITY_NEXT),
  digital_delivery: makeConfig(['provisioning', 'provisioned', 'delivered'], digitalMeta, DIGITAL_NEXT),
  shipment: makeConfig(['allocated', 'picking', 'packed', 'shipped', 'in_transit', 'delivered'], shipmentMeta, SHIPMENT_NEXT),
  service_execution: makeConfig(['received', 'working', 'ready', 'collected'], serviceMeta, SERVICE_NEXT),
};

/**
 * Returns the full state machine config for a fulfillment mode.
 * The staff operating surface derives columns, labels, actions, and
 * transitions from this — never from hardcoded hospitality arrays.
 *
 * Modes on_premise/pickup/local_delivery share the same hospitality
 * state machine. 'none' returns an empty config (no fulfillment states,
 * no fulfillment actions — the transaction layer handles completion).
 * null/undefined returns null (legacy recovery).
 */
const NONE_CONFIG: ModeStateConfig = {
  states: [],
  metadata: {} as Record<FulfillmentState, ModeStateMetadata>,
  nextTarget: () => null,
};

export function getModeStateConfig(mode: FulfillmentMode | null | undefined): ModeStateConfig | null {
  if (mode === 'none') return NONE_CONFIG;
  if (!mode) return null;  // null/undefined → legacy recovery (null signals fallback)
  return MODE_CONFIGS[mode] ?? null;
}

/**
 * Resolve the column key for an order's current fulfillment state.
 * 'confirmed' (transaction-layer) maps to the first fulfillment column
 * for backward compat. Returns null if the state doesn't belong to the
 * mode's column set.
 */
export function resolveColumnKey(
  state: CanonicalOrderState | null,
  modeConfig: ModeStateConfig | null,
): string {
  if (!modeConfig) return 'pending';
  // none mode has empty states — transaction-only, no fulfillment columns
  if (modeConfig.states.length === 0) return 'pending';
  if (state === 'confirmed' || state === 'pending') return modeConfig.states[0];
  if (state && state in modeConfig.metadata) return state;
  return modeConfig.states[0];
}

/**
 * Resolve the canonical state for an order payload. Stage 6: prefer the
 * canonical field (fulfillmentStatus / fulfillment_status), fall back to
 * the transitional metadata value, then map legacy composite statuses
 * (pre-Stage-6 rows / old socket events).
 *
 * The legacy mapping (preparing->in_progress, delivered/served->handed_off)
 * is ONLY valid for hospitality modes (on_premise/pickup/local_delivery)
 * or when the mode is unknown (legacy recovery). When fulfillmentMode is a
 * known non-hospitality mode, a raw FulfillmentState value from status is
 * passed through without hospitality reinterpretation.
 *
 * @param order - The order object with status fields
 * @param fulfillmentMode - The order's fulfillment mode. When provided,
 *   legacy hospitality mappings are ONLY applied for hospitality modes.
 *   When omitted, the function assumes legacy recovery (hospitality compat).
 */
export function canonicalFulfillmentState(
  order: {
    fulfillmentStatus?: string | null;
    fulfillment_status?: string | null;
    status?: string;
  },
  fulfillmentMode?: FulfillmentMode | string | null,
): CanonicalOrderState | null {
  // 1. Prefer the canonical fulfillment status field
  const canonical = order.fulfillmentStatus ?? order.fulfillment_status ?? null;
  if (canonical && (isTransactionState(canonical) || isFulfillmentState(canonical))) {
    return canonical as CanonicalOrderState;
  }

  // 2. Determine if legacy hospitality mapping should apply
  const isHospitalityOrUnknown = !fulfillmentMode
    || fulfillmentMode === 'on_premise'
    || fulfillmentMode === 'pickup'
    || fulfillmentMode === 'local_delivery';

  // 3. Fall back to status with mode-aware legacy mapping
  const raw = order.status;
  if (!raw) return null;

  if (isHospitalityOrUnknown) {
    // Legacy hospitality composites (pre-Stage-6 / old socket events)
    switch (raw) {
      case 'preparing':  return 'in_progress';
      case 'delivered':
      case 'served':     return 'handed_off';
      case 'ready':      return 'ready';
    }
  }

  // Non-hospitality mode or no legacy match: pass through if valid
  if (isFulfillmentState(raw)) return raw as FulfillmentState;
  if (isTransactionState(raw))  return raw as TransactionState;

  // Unknown value — return as-is for downstream handling
  return raw as CanonicalOrderState;
}

// ============================================
// Fulfillment capability
// ============================================

// FulfillmentMode is defined above in the fulfillment states section.
// isFulfillmentMode is the runtime type guard.

export function isFulfillmentMode(value: string): value is FulfillmentMode {
  return (
    value === 'none' ||
    value === 'pickup' ||
    value === 'on_premise' ||
    value === 'local_delivery' ||
    value === 'shipment' ||
    value === 'digital_delivery' ||
    value === 'service_execution'
  );
}

export type DestinationType =
  | 'none'
  | 'pickup_location'
  | 'on_premise_location'
  | 'room'
  | 'address'
  | 'digital_account'
  | 'service_location';

/** A legal mode/destination combination (capability options, never a free string). */
export interface FulfillmentOption {
  mode: FulfillmentMode;
  destinations: readonly (DestinationType | string)[];
}

export interface FulfillmentCapability {
  /** When true the transaction cannot complete until fulfillment reaches its terminal/handoff condition. */
  required: boolean;
  /** The legal mode/destination combinations this engine/module offers. */
  options: FulfillmentOption[];
}

/**
 * The Engine A capability surface the frontend renders against. UI derives
 * itself from this — never from `if (slug === 'restaurant')`.
 */
export interface EngineACapabilities {
  fulfillment: FulfillmentCapability;
}

/**
 * Canonical default Engine A capabilities matching backend EngineDefinition (backend/src/engines/definitions/instant-transaction.ts).
 * Mode/destination combinations are legal contract values covering all 6 canonical fulfillment modes.
 */
export const CANONICAL_ENGINE_A_CAPABILITIES: EngineACapabilities = {
  fulfillment: {
    required: true,
    options: [
      { mode: 'on_premise', destinations: ['on_premise_location', 'room'] },
      { mode: 'pickup', destinations: ['pickup_location'] },
      { mode: 'local_delivery', destinations: ['address'] },
      { mode: 'digital_delivery', destinations: ['digital_account'] },
      { mode: 'shipment', destinations: ['address'] },
      { mode: 'service_execution', destinations: ['service_location'] },
      { mode: 'none', destinations: ['none'] },
    ],
  },
};

// ============================================
// Money — never floats at the boundary
// ============================================
// The canonical Money representation uses minor units (e.g. cents) as a
// safe integer. The backend guarantees integer amounts in the payment and
// ledger subsystems. Presentation-layer conversion to display decimals
// happens ONLY through toDisplayMoney() at the rendering edge.

export interface Money {
  /** Amount in minor units (cents). Always an integer from the backend. */
  amount: number;
  /** ISO 4217 currency code. */
  currency: string;
}

/** ISO 4217 currency exponents (number of decimal places).
 *  Only non-2 exponents are listed; everything else defaults to 2.
 *  Source: https://en.wikipedia.org/wiki/ISO_4217 */
const CURRENCY_EXPONENTS: Record<string, number> = {
  // 0 decimal places (minor unit = 1)
  'JPY': 0, 'KRW': 0, 'VND': 0, 'KHR': 0, 'LAK': 0, 'MNT': 0,
  'UGX': 0, 'RWF': 0, 'CLP': 0, 'ISK': 0, 'VUV': 0, 'KMF': 0,
  // 3 decimal places (minor unit = 1/1000)
  'BHD': 3, 'KWD': 3, 'OMR': 3, 'TND': 3, 'LYD': 3, 'JOD': 3,
  'IQD': 3,
};

/** Get the number of decimal places for a currency code. */
export function getCurrencyExponent(currency: string): number {
  return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2;
}

/** Convert minor-unit Money to a display-ready decimal number.
 *  Use this ONLY at the presentation edge (formatCurrency, JSX).
 *  Never use it in business logic or state comparisons. */
export function toDisplayMoney(money: Money): number {
  const exponent = getCurrencyExponent(money.currency);
  const divisor = Math.pow(10, exponent);
  return money.amount / divisor;
}

export interface PricingBreakdown {
  name: string;
  rate: number;
  amount: number;
}

/**
 * Canonical server pricing result. The frontend renders this; it never
 * recalculates tax/service/delivery/discounts (backend pricing authority).
 * Presentation-level previews (qty × displayed unit price) are allowed, but
 * the final number always comes from here.
 */
export interface PricingResult {
  currency: string;
  subtotal: number;
  taxAmount: number;
  taxBreakdown: PricingBreakdown[];
  feeBreakdown: PricingBreakdown[];
  totalDiscount: number;
  totalAmount: number;
  lineItems: Array<{
    itemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    metadata?: Record<string, unknown>;
  }>;
}

// ============================================
// Payment — settlement is a fact, not completion
// ============================================

export type PaymentStateStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'failed';

export interface PaymentState {
  status: PaymentStateStatus;
  method?: string;
  paidAt?: string;
  amountPaid?: number;
  changeAmount?: number;
}
