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
 * Hospitality fulfillment-layer states (hospitality adapter machine).
 * NEVER inferred from transactions.status — read from the fulfillment
 * row / fulfillmentStatus payload.
 */
export type FulfillmentState = 'queued' | 'in_progress' | 'ready' | 'handed_off';

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
  return value === 'queued' || value === 'in_progress' || value === 'ready' || value === 'handed_off';
}

/** Canonical fulfillment-layer states (vs transaction-layer statuses). */
export const FULFILLMENT_LAYER_STATES: readonly FulfillmentState[] = ['queued', 'in_progress', 'ready', 'handed_off'];

/**
 * Resolve the canonical state for an order payload. Stage 6: prefer the
 * canonical field (fulfillmentStatus / fulfillment_status), fall back to
 * the transitional metadata value, then map legacy composite statuses
 * (pre-Stage-6 rows / old socket events). The ONLY place legacy composites
 * ('preparing'/'delivered'/'served') may appear outside the adapter.
 */
export function canonicalFulfillmentState(order: {
  fulfillmentStatus?: string | null;
  fulfillment_status?: string | null;
  status?: string;
}): CanonicalOrderState | null {
  const canonical = order.fulfillmentStatus ?? order.fulfillment_status ?? null;
  if (canonical && (isTransactionState(canonical) || isFulfillmentState(canonical))) {
    return canonical as CanonicalOrderState;
  }
  switch (order.status) {
    case 'preparing': return 'in_progress';
    case 'delivered':
    case 'served':    return 'handed_off';
    case 'ready':     return 'ready';
    default:          return (order.status as CanonicalOrderState) ?? null;
  }
}

// ============================================
// Fulfillment capability
// ============================================

export type FulfillmentMode =
  | 'none'
  | 'pickup'
  | 'on_premise'
  | 'local_delivery'
  | 'shipment'
  | 'digital_delivery'
  | 'service_execution';

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

/** A legal mode/destination combination (capability options, never a free string). */
export interface FulfillmentOption {
  mode: FulfillmentMode;
  destinations: readonly string[];
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

// ============================================
// Money — never floats at the boundary
// ============================================

export interface Money {
  /** Minor-unit integer when the backend supplies one; otherwise a rounded decimal. */
  amount: number;
  currency: string;
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
