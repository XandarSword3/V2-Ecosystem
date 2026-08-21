export type UUID = string;

export type EngineType =
  | 'instant_transaction'
  | 'time_exclusive_reservation'
  | 'shared_capacity_access'
  | 'ongoing_entitlement'
  | 'platform_entitlement';

export const TEMPLATE_TO_ENGINE: Record<string, EngineType> = {
  // ── Real engine type names (1:1) — new modules use these ──────────────────
  instant_transaction:       'instant_transaction',
  time_exclusive_reservation:'time_exclusive_reservation',
  shared_capacity_access:    'shared_capacity_access',
  ongoing_entitlement:       'ongoing_entitlement',
  platform_entitlement:      'platform_entitlement',
  // ── Legacy alias names — kept for backwards compat with existing DB rows ──
  menu_service:              'instant_transaction',
  multi_day_booking:         'time_exclusive_reservation',
  session_access:            'shared_capacity_access',
  subscription:              'ongoing_entitlement',
  membership_access:         'ongoing_entitlement',
  class_scheduling:          'shared_capacity_access',
  appointment_booking:       'time_exclusive_reservation',
  saas_subscription:         'platform_entitlement',
};

export const ENGINE_TO_TEMPLATE: Record<EngineType, string> = {
  instant_transaction:        'instant_transaction',
  time_exclusive_reservation: 'time_exclusive_reservation',
  shared_capacity_access:     'shared_capacity_access',
  ongoing_entitlement:        'ongoing_entitlement',
  platform_entitlement:       'platform_entitlement',
};

/** Maps canonical engine_type → legacy modules.template_type enum value (deprecated column). */
export const ENGINE_TO_LEGACY_TEMPLATE_TYPE: Partial<Record<EngineType, string>> = {
  instant_transaction:        'menu_service',
  time_exclusive_reservation: 'multi_day_booking',
  shared_capacity_access:     'session_access',
  ongoing_entitlement:        'subscription',
};

export interface StateTransition<TStatus extends string = string> {
  from: TStatus;
  to: TStatus;
  action: string;
  allowedActors: ('system' | 'staff' | 'customer' | 'admin')[];
  guardDescription?: string;
}

export interface StateMachineDefinition<TStatus extends string = string> {
  states: TStatus[];
  initialState: TStatus;
  terminalStates: TStatus[];
  transitions: StateTransition<TStatus>[];
}

export interface TransitionResult<TStatus extends string = string> {
  success: boolean;
  previousState: TStatus;
  newState: TStatus;
  action: string;
  error?: string;
  timestamp: Date;
}

export interface PricingLineItem {
  itemId?: UUID;
  name: string;
  unitPrice: number;
  quantity: number;
  unitAdjustment?: number;
  metadata?: Record<string, unknown>;
  taxCategory?: string; // Tax category for scoping (e.g., 'accommodation', 'food_beverage', 'all'). Defaults to 'all' if unset.
  category?: string;
  moduleId?: UUID;
}

export interface PricingConfig {
  applyTax: boolean;
  /** Whether CMS-configured fees (service_charge/resort_fee/delivery_fee/custom fee_types
   *  on tax_configuration) apply to this engine. There is no hardcoded fee amount or
   *  order-type condition — admins scope fees via applies_to/payment_methods on the
   *  Tax & Fee admin page. */
  applyFees: boolean;
  supportsCoupons: boolean;
  supportsGiftCards: boolean;
  supportsLoyaltyRedemption: boolean;
  earnsLoyaltyPoints: boolean;
  deductsInventory: boolean;
  rounding: 'round' | 'floor' | 'ceil';
  decimalPlaces: number;
}

export interface EconomicsReporting {
  staffId?: UUID;
  propertyId?: UUID;
  cancellationReason?: string;
  refundReason?: string;
  promoCodeUsed?: string;
  refundAmount?: number;
  moduleId?: UUID;
}

export interface PricingContext extends EconomicsReporting {
  engineType?: EngineType;
  /** ISO 4217 currency for this commercial operation. Required at runtime —
   *  resolve via currency-resolver before calling the pipeline. */
  currency?: string;
  conditions?: Record<string, unknown>;
  customerId?: UUID;
  couponCode?: string;
  giftCardCodes?: string[];
  loyaltyPointsToRedeem?: number;
}

export interface DiscountBreakdown {
  type: 'coupon' | 'gift_card' | 'loyalty' | 'promotion';
  referenceId?: string;
  label: string;
  amount: number;
  taxSavings: number;
  metadata?: Record<string, unknown>;
}

export interface TaxBreakdownItem {
  id: string;
  name: string;
  rate: number;
  amount: number;
  type: string;
}

export interface FeeBreakdownItem {
  id: string; // tax_configuration rate id this fee came from
  type: 'service_charge' | 'delivery_fee' | 'resort_fee' | 'custom';
  name: string;
  amount: number;
  rate?: number; // For percentage-based fees like service charge
}

export interface PricingResult extends EconomicsReporting {
  /** ISO 4217 currency — always populated by the pipeline (DOMAIN.md F2). */
  currency: string;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  taxBreakdown: TaxBreakdownItem[]; // Detailed breakdown of all taxes applied
  // serviceCharge/deliveryFee are aggregates derived from feeBreakdown, kept for the
  // financial ledger's existing service_charge/delivery_fee columns. feeBreakdown is the
  // source of truth — read it directly for anything CMS-fee-type-specific (resort_fee, custom).
  serviceCharge: number;
  serviceChargeRate: number;
  deliveryFee: number;
  feeBreakdown: FeeBreakdownItem[]; // Detailed breakdown of all CMS fees (service charge, delivery, resort, custom)
  preDiscountTotal: number;
  discounts: DiscountBreakdown[];
  totalDiscount: number;
  totalAmount: number;
  lineItems: Array<{
    itemId: string;
    name: string;
    unitPrice: number;
    unitAdjustment: number;
    quantity: number;
    lineTotal: number;
  }>;
  loyaltyPointsEarned: number;
  depositAmount: number;
}

export interface InteractionContract {
  name: string;
  applicableEngines: EngineType[];
  trigger: 'on_purchase' | 'on_payment' | 'on_refund' | 'on_cancel' | 'on_check_in' | 'on_check_out' | 'on_plan_change';
  guardDescription: string;
  idempotent: boolean;
  failureMode: 'block' | 'log_and_continue' | 'retry';
  compensatingAction?: string;
}

export interface EngineDefinition<TStatus extends string = string, TFulfillmentStatus extends string = string> {
  type: EngineType;
  name: string;
  description: string;
  commercialEntity: string;
  /** TRANSACTION-layer state machine (canonical, generic). */
  stateMachine: StateMachineDefinition<TStatus>;
  pricing: PricingConfig;
  interactions: InteractionContract[];
  /**
   * Declarative capabilities — the fulfillment definition is bound to the
   * SAME fulfillment-state type this engine declares, so the compiler
   * enforces that the adapter's state machine uses the engine's own
   * fulfillment states.
   */
  capabilities: EngineCapabilities<TFulfillmentStatus>;
  dataExtraction?: Record<string, {
    enabled: boolean;
    fields: string[];
    description: string;
  }>;
}

// ============================================================
// Layered state model (DOMAIN.md — plan Phase 3)
//
// Transaction state ≠ cart state ≠ fulfillment state. The engine's
// `stateMachine` is the TRANSACTION layer; `capabilities.fulfillment` is the
// FULFILLMENT layer (adapter-shaped). They interact but neither impersonates
// the other. A draft cart is NOT an economically committed transaction.
// ============================================================

/** Cart/workspace state — a draft cart is not an economic commitment. */
export type CartState =
  | 'draft'
  | 'open'
  | 'converted'   // became a pending transaction
  | 'expired'
  | 'abandoned';

/** Transaction lifecycle — the engine's canonical economic states. */
export type TransactionState =
  | 'pending'
  | 'confirmed'  // economically committed
  | 'completed'
  | 'cancelled';

/**
 * TRANSITIONAL (Stage 6 removes this): legacy composite status persisted on
 * transactions.status until real fulfillment persistence exists. The maps
 * are declared by the ADAPTER that needs the bridge — the generic core only
 * applies whatever is declared. Production code must treat this as a
 * migration mechanism, never as the canonical fulfillment state.
 */
export interface LegacyStatusBridge {
  /** canonical fulfillment state → legacy composite value (persisted output). */
  canonicalToLegacy: Readonly<Record<string, string>>;
  /** legacy composite value → canonical fulfillment state (current-state input). */
  legacyToCanonical: Readonly<Record<string, string>>;
}

export type FulfillmentMode =
  | 'none'
  | 'pickup'
  | 'on_premise'
  | 'local_delivery'
  | 'shipment'
  | 'digital_delivery'
  | 'service_execution';

export type DestinationType =
  | 'none'
  | 'address'
  | 'pickup_location'
  | 'service_location'
  | 'on_premise_location'
  | 'room'
  | 'digital_account';

/**
 * One legal fulfillment mode → destination combination. Combinations are
 * explicit so an engine cannot declare an impossible pairing (e.g. shipment
 * to a room) — engines/fulfillment-contract.ts validates against the legal
 * registry.
 */
export interface FulfillmentOption {
  mode: FulfillmentMode;
  destinations: DestinationType[];
}

// ============================================================
// Declarative capability contract (DOMAIN.md — plan Phase 2)
//
// Every engine declares WHAT it supports so the generic core never needs
// vertical vocabulary. Adapters (hospitality, retail, digital, service)
// implement these capabilities; the core only reads the declarations.
// ============================================================

export interface FulfillmentDefinition<TFulfillmentStatus extends string = string> {
  /**
   * When true, the TRANSACTION cannot complete until the fulfillment layer
   * reaches its terminal/handoff condition. When false, the transaction may
   * complete directly on the transaction machine.
   */
  required: boolean;
  /** Legal fulfillment mode → destination combinations. */
  options: FulfillmentOption[];
  /** Whether one transaction can split into multiple fulfillment groups (partial fulfillment). */
  groups: boolean;
  /** Whether fulfillment carries carrier/execution tracking. */
  tracking: boolean;
  /** Whether handoff (who/what/when/where/proof) is modeled. */
  handoff: boolean;
  /** The fulfillment lifecycle — adapter-shaped state machine (absent when the engine has no fulfillment layer). */
  stateMachine?: StateMachineDefinition<TFulfillmentStatus>;
  /**
   * TRANSITIONAL — declared ONLY by adapters still writing legacy composite
   * statuses until Stage 6 gives fulfillment its own persistence. Generic
   * code applies it mechanically; nothing may read fulfillment meaning from
   * the legacy column once fulfillment rows exist.
   */
  legacyStatusBridge?: LegacyStatusBridge;
}

export interface ExecutionDefinition {
  enabled: boolean;
  workCenters: boolean;
  operators: boolean;
  states: string[];
  /** When the work center / operator is notified. */
  notificationTrigger: 'on_purchase' | 'on_confirm' | 'on_payment' | 'on_fulfillment_start';
}

/**
 * How the transaction commits scarce resources — a DISCRIMINATED UNION so
 * impossible configurations (e.g. no commitment but a deduction trigger) are
 * rejected by the compiler, not by convention.
 */
export type CommitmentModel =
  | { type: 'none' }
  | {
      type: 'inventory' | 'resource' | 'capacity' | 'inventory_and_capacity';
      reservation: boolean;
      commitmentTrigger: 'on_purchase' | 'on_confirm' | 'on_fulfillment_start';
      reversalOnCancel: boolean;
    };

export interface EconomicCapabilities {
  multiTender: boolean;
  refunds: boolean;
  voids: boolean;
  ledger: boolean;
  loyalty: 'none' | 'earn' | 'earn_and_redeem';
  coupons: boolean;
  giftCards: boolean;
  pos: boolean;
  /** Explicit ISO 4217 currency required on every monetary record (DOMAIN.md F2). */
  currencyRequired: boolean;
}

export interface CustomerCapabilities {
  guests: boolean;
  accounts: boolean;
  staffAssisted: boolean;
  reviews: boolean;
  serviceRecovery: boolean;
}

export interface FiscalCapabilities {
  documents: string[];
  eInvoicing: boolean;
  controlledNumbering: boolean;
}

export interface ReturnCapabilities {
  refund: 'none' | 'full' | 'partial';
  physicalReturn: boolean;
  exchange: boolean;
  replacement: boolean;
  cancellation: boolean;
}

export interface EngineCapabilities<TFulfillmentStatus extends string = string> {
  transactionModel: {
    supportsDraft: boolean;
    autoComplete: boolean;
    /** The engine's own transaction-lifecycle states (the canonical TransactionState list is the generic commerce reference). */
    states: string[];
  };
  commitment: CommitmentModel;
  fulfillment: FulfillmentDefinition<TFulfillmentStatus>;
  execution: ExecutionDefinition;
  economics: EconomicCapabilities;
  customer: CustomerCapabilities;
  fiscal: FiscalCapabilities;
  returns: ReturnCapabilities;
}

export type TimeExclusiveReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type SharedCapacityAccessStatus =
  | 'valid'
  | 'active'
  | 'used'
  | 'expired'
  | 'cancelled';

export type OngoingEntitlementStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'expired'
  | 'cancelled';

// Engine E — Platform-level SaaS subscription status
export type PlatformEntitlementStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled';
