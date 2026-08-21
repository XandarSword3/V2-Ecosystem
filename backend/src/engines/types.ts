export type UUID = string;

export type EngineType =
  | 'instant_transaction'
  | 'time_exclusive_reservation'
  | 'shared_capacity_access'
  | 'ongoing_entitlement'
  | 'platform_entitlement';

/**
 * Literal template → engine map (the type-level source of truth). Kept as a
 * const so `getEngineByTemplate('menu_service')` resolves to the engine's
 * FULL definition type — including its fulfillment-status generic — instead
 * of erasing it to `string`.
 */
export const ENGINE_TEMPLATES = {
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
} as const;

export type TemplateKey = keyof typeof ENGINE_TEMPLATES;

/** Dynamic (string-keyed) lookup for DB-driven call sites. */
export const TEMPLATE_TO_ENGINE: Record<string, EngineType> = ENGINE_TEMPLATES;

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

/**
 * One fulfillment ADAPTER binding: a set of modes handled by one adapter's
 * state machine. An engine may bind several adapters — Engine A binds the
 * hospitality machine (on_premise/pickup/local_delivery) AND the digital
 * machine (digital_delivery) — proving radically different fulfillment
 * modes ride on ONE engine's capability contract without new engine
 * semantics. The compiler enforces each binding's machine uses the engine's
 * own fulfillment-status type (the generic is preserved through the
 * registry).
 */
export interface FulfillmentModeBinding<TFulfillmentStatus extends string = string> {
  /** The fulfillment modes this adapter machine handles. */
  modes: readonly FulfillmentMode[];
  /** The adapter's fulfillment lifecycle — adapter-shaped state machine. */
  machine: StateMachineDefinition<TFulfillmentStatus>;
  /**
   * EXPLICIT auto-handoff policy for THIS binding (replaces implicit machine
   * shortcuts): when the fulfillment layer reaches `atState`, handoff is
   * deemed complete and the transaction may complete directly from there via
   * this machine's own completion action. Declared by the ADAPTER that owns
   * the state name — the generic core derives the action from the machine
   * and never hardcodes a vertical state.
   */
  autoHandoff?: AutoHandoffPolicy<TFulfillmentStatus>;
}

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
  /**
   * Per-mode machine routing (plan Phase: digital as a MODE of Engine A).
   * Each binding maps the modes it handles to the adapter's state machine;
   * the layered validator tries every bound machine, so a single engine can
   * fulfill through radically different adapters (hospitality work flow,
   * digital provisioning, …) without new engine semantics. Absent when the
   * engine has no fulfillment machine (its lifecycle is purely declarative
   * or lives on the transaction machine).
   */
  modeMachines?: ReadonlyArray<FulfillmentModeBinding<TFulfillmentStatus>>;
}

/**
 * Explicit auto-handoff declaration: fulfillment reaching `atState` implies
 * handoff, so the transaction may complete without a separate handoff step.
 */
export interface AutoHandoffPolicy<TFulfillmentStatus extends string = string> {
  /** Fulfillment state at which handoff is deemed automatic. */
  atState: TFulfillmentStatus;
  /** Who may complete the transaction from the auto-handoff state. */
  allowedActors: ('system' | 'staff' | 'customer' | 'admin')[];
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

// ============================================================
// Resource consumption (plan Phase 5 — generic resource system)
//
// The generic core declares WHAT an engine consumes and WHEN, without ever
// naming a vertical resource (the hospitality BOM — menu_item_ingredients —
// lives in the hospitality adapter, never here). Adapters resolve a
// transaction's commercial lines into typed ResourceRequirement[] (the
// generic BOM line); the generic service allocates/reserves, consumes on
// fulfillment, and releases on cancellation — driven by this declaration.
// ============================================================

/** The generic resource kinds an engine may consume. */
export type ResourceKind =
  | 'inventory_item' // consumable stock (hospitality: recipe ingredients)
  | 'capacity_slot' // time-boxed capacity (reservations, sessions)
  | 'staff_time' // labor allocation
  | 'equipment'; // reusable equipment

/**
 * One line of a transaction's resource requirement (the generic BOM line).
 * `ref` is the domain reference to the concrete resource the ADAPTER resolved
 * (inventory_item_id, capacity slot id, …) — the core never interprets it.
 */
export interface ResourceRequirement {
  kind: ResourceKind;
  ref: string;
  quantity: number;
  unit?: string;
}

/**
 * Declarative resource-consumption model (discriminated — an engine either
 * consumes resources or it doesn't; a non-consuming engine cannot declare a
 * consumption timing). Validated by engines/resource-contract.ts.
 */
export type ResourceConsumptionModel =
  | { type: 'none' }
  | {
      type: 'inventory' | 'capacity' | 'resource' | 'inventory_and_capacity';
      /** Which generic resource kinds this engine consumes. */
      kinds: ResourceKind[];
      /** When allocation (reservation) happens in the transaction lifecycle. */
      allocation: 'on_purchase' | 'on_confirm' | 'on_fulfillment_start';
      /** When consumption (deduction) happens. */
      consumption: 'on_purchase' | 'on_fulfillment_handoff' | 'on_transaction_complete';
      /** Whether cancellation reverses allocation/consumption (compensation). */
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
  /** Generic resource-consumption declaration (plan Phase 5). */
  resources: ResourceConsumptionModel;
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
