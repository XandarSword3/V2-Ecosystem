// ============================================
// Engine Type System - First Principles
// ============================================
//
// The V2 Ecosystem platform reduces ALL hospitality commerce
// to four economic patterns (engines):
//
//   A. Instant Transaction   — Order → Prepare → Deliver → Done
//   B. Time-Exclusive Reservation — Reserve → Confirm → Check-In → Occupy → Check-Out
//   C. Shared Capacity Access — Purchase → Validate → Enter → Exit
//   D. Ongoing Entitlement   — Subscribe → Activate → Use → Renew/Cancel
//
// Every "module" is a configuration instance of one of these engines.
// The engine defines:  state machine + pricing pipeline + interaction contracts.
// The module configures: names, prices, UI, categories, available add-ons.

import type { UUID } from './index';

// ============================================
// 1. Engine Identity
// ============================================

/**
 * The four fundamental economic engines.
 * Maps 1:1 to database enum `module_template_type`.
 *
 * Database mapping:
 *   'menu_service'       → EngineType.InstantTransaction
 *   'multi_day_booking'  → EngineType.TimeExclusiveReservation
 *   'session_access'     → EngineType.SharedCapacityAccess
 *   'subscription'       → EngineType.OngoingEntitlement   (future)
 */
export type EngineType =
  | 'instant_transaction'
  | 'time_exclusive_reservation'
  | 'shared_capacity_access'
  | 'ongoing_entitlement';

/** Database template_type → engine type mapping */
export const TEMPLATE_TO_ENGINE: Record<string, EngineType> = {
  menu_service: 'instant_transaction',
  multi_day_booking: 'time_exclusive_reservation',
  session_access: 'shared_capacity_access',
  subscription: 'ongoing_entitlement',
};

export const ENGINE_TO_TEMPLATE: Record<EngineType, string> = {
  instant_transaction: 'menu_service',
  time_exclusive_reservation: 'multi_day_booking',
  shared_capacity_access: 'session_access',
  ongoing_entitlement: 'subscription',
};

// ============================================
// 2. State Machine Types
// ============================================

/**
 * A state machine transition definition.
 * Defines: from → to, with optional guard condition & side effects.
 */
export interface StateTransition<TStatus extends string = string> {
  /** Source state */
  from: TStatus;
  /** Target state */
  to: TStatus;
  /** Human-readable name for this transition (e.g., "confirm", "cancel") */
  action: string;
  /** 
   * Who can trigger this transition.
   * 'system' = automated (webhooks, cron), 'staff' = employees, 'customer' = end user
   */
  allowedActors: ('system' | 'staff' | 'customer' | 'admin')[];
  /** Optional: description of guard condition (evaluated at runtime) */
  guardDescription?: string;
}

/**
 * Complete state machine definition for an engine.
 * This is the source of truth — no ad-hoc if/throw allowed outside this.
 */
export interface StateMachineDefinition<TStatus extends string = string> {
  /** All valid states */
  states: TStatus[];
  /** Initial state when entity is created */
  initialState: TStatus;
  /** Terminal states (no transitions out) */
  terminalStates: TStatus[];
  /** All valid transitions */
  transitions: StateTransition<TStatus>[];
}

/**
 * Result of attempting a state transition.
 */
export interface TransitionResult<TStatus extends string = string> {
  success: boolean;
  previousState: TStatus;
  newState: TStatus;
  action: string;
  error?: string;
  /** Timestamp of the transition */
  timestamp: Date;
}

// ============================================
// 3. Pricing Pipeline Types
// ============================================

/**
 * A line item entering the pricing pipeline.
 * This is a universal abstraction — handles menu items, nights, tickets, subscriptions.
 */
export interface PricingLineItem {
  /** Identifier of the purchasable item (optional — auto-generated if omitted) */
  itemId?: UUID;
  /** Display name (for receipts/invoices) */
  name: string;
  /** Unit price before any adjustments */
  unitPrice: number;
  /** Quantity (items, nights, guests, etc.) */
  quantity: number;
  /** Additional price adjustments (modifiers, add-ons) per unit. Defaults to 0. */
  unitAdjustment?: number;
  /** Metadata for engine-specific behavior */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the pricing pipeline.
 * Every engine provides its own pricing config.
 */
export interface PricingConfig {
  /** Whether this engine applies tax */
  applyTax: boolean;
  /** Whether this engine applies a service charge */
  applyServiceCharge: boolean;
  /** 
   * Condition for service charge (e.g., only for dine-in).
   * Engine evaluates this at runtime. If undefined, always apply.
   */
  serviceChargeCondition?: string;
  /** Whether this engine applies delivery fees */
  applyDeliveryFee: boolean;
  /** 
   * Condition for delivery fee (e.g., only for delivery orders).
   * Engine evaluates this at runtime. If undefined, always apply.
   */
  deliveryFeeCondition?: string;
  /** Whether this engine supports coupon discounts */
  supportsCoupons: boolean;
  /** Whether this engine supports gift card redemption */
  supportsGiftCards: boolean;
  /** Whether this engine supports loyalty point redemption */
  supportsLoyaltyRedemption: boolean;
  /** Whether this engine earns loyalty points on purchase */
  earnsLoyaltyPoints: boolean;
  /** Whether this engine deducts inventory on purchase */
  deductsInventory: boolean;
  /** Rounding strategy */
  rounding: 'round' | 'floor' | 'ceil';
  /** Decimal places for currency */
  decimalPlaces: number;
}

/**
 * Context provided to the pricing pipeline at calculation time.
 * Includes runtime conditions needed for conditional fees/charges.
 */
export interface PricingContext {
  /** Module ID for per-module tax/config overrides */
  moduleId?: UUID;
  /** Engine type driving this calculation (auto-set by engine service if omitted) */
  engineType?: EngineType;
  /** Runtime conditions (e.g., { orderType: 'dine_in' }). Defaults to {} */
  conditions?: Record<string, unknown>;
  /** Customer ID (for loyalty/coupon eligibility lookups) */
  customerId?: UUID;
  /** Coupon code to apply, if any */
  couponCode?: string;
  /** Gift card codes to apply, if any */
  giftCardCodes?: string[];
  /** Loyalty points to redeem, if any */
  loyaltyPointsToRedeem?: number;
}

/**
 * Breakdown of a single discount application.
 */
export interface DiscountBreakdown {
  type: 'coupon' | 'gift_card' | 'loyalty' | 'promotion';
  /** Reference ID (coupon ID, gift card ID, etc.) */
  referenceId?: string;
  /** Display label */
  label: string;
  /** Amount discounted (positive number, subtracted from total) */
  amount: number;
  /** Tax savings from pre-tax discounts */
  taxSavings: number;
  /** Extra data specific to the discount type (e.g., pointsUsed for loyalty) */
  metadata?: Record<string, unknown>;
}

/**
 * The universal pricing result.
 * Every engine returns this exact structure, ensuring financial consistency.
 *
 * INVARIANT: totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee - totalDiscount
 * INVARIANT: totalAmount >= 0
 * INVARIANT: All amounts are rounded to `decimalPlaces`
 */
export interface PricingResult {
  /** Sum of (unitPrice + unitAdjustments) * quantity for all items */
  subtotal: number;
  /** Tax amount (subtotal * taxRate, adjusted for pre-tax discounts) */
  taxAmount: number;
  /** Tax rate applied (decimal, e.g., 0.11) */
  taxRate: number;
  /** Service charge amount */
  serviceCharge: number;
  /** Service charge rate applied (decimal, e.g., 0.10) */
  serviceChargeRate: number;
  /** Delivery fee amount */
  deliveryFee: number;
  /** Total before discounts: subtotal + tax + serviceCharge + deliveryFee */
  preDiscountTotal: number;
  /** Individual discount breakdowns */
  discounts: DiscountBreakdown[];
  /** Sum of all discount amounts */
  totalDiscount: number;
  /** Final total = max(0, preDiscountTotal - totalDiscount) */
  totalAmount: number;
  /** Per-line-item subtotals */
  lineItems: Array<{
    itemId: string;
    name: string;
    unitPrice: number;
    unitAdjustment: number;
    quantity: number;
    lineTotal: number;
  }>;
  /** Loyalty points earned from this transaction (if applicable) */
  loyaltyPointsEarned: number;
  /** Deposit amount required (for reservations) */
  depositAmount: number;
}

// ============================================
// 4. Cross-Engine Interaction Contracts
// ============================================

/**
 * Contract for cross-engine interactions (loyalty, coupons, gift cards, etc.)
 * Every interaction must declare: trigger, guard, action, compensation.
 */
export interface InteractionContract {
  /** Unique name for this interaction */
  name: string;
  /** Which engine types this interaction applies to */
  applicableEngines: EngineType[];
  /** When this interaction fires */
  trigger: 'on_purchase' | 'on_payment' | 'on_refund' | 'on_cancel' | 'on_check_in' | 'on_check_out';
  /** Description of guard/precondition */
  guardDescription: string;
  /** Is this interaction idempotent? (safe to retry) */
  idempotent: boolean;
  /** What happens if this interaction fails — does it block the parent operation? */
  failureMode: 'block' | 'log_and_continue' | 'retry';
  /** Compensating action if parent operation is reversed (e.g., refund) */
  compensatingAction?: string;
}

// ============================================
// 5. Engine Definition (complete contract)
// ============================================

/**
 * Complete engine definition.
 * This is the FULL contract for a business engine.
 * Each engine type (A, B, C, D) must provide one of these.
 */
export interface EngineDefinition<TStatus extends string = string> {
  /** Engine type identifier */
  type: EngineType;
  /** Human-readable engine name */
  name: string;
  /** Short description */
  description: string;
  /** The commercial object this engine manages (order, booking, ticket, subscription) */
  commercialEntity: string;
  /** State machine definition */
  stateMachine: StateMachineDefinition<TStatus>;
  /** Pricing configuration */
  pricing: PricingConfig;
  /** Cross-engine interaction contracts */
  interactions: InteractionContract[];
}

// ============================================
// 6. Engine A: Instant Transaction States
// ============================================

export type InstantTransactionStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'completed'
  | 'cancelled';

// ============================================
// 7. Engine B: Time-Exclusive Reservation States
// ============================================

export type TimeExclusiveReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

// ============================================
// 8. Engine C: Shared Capacity Access States
// ============================================

export type SharedCapacityAccessStatus =
  | 'valid'
  | 'active'
  | 'used'
  | 'expired'
  | 'cancelled';

// ============================================
// 9. Engine D: Ongoing Entitlement States (future)
// ============================================

export type OngoingEntitlementStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'expired'
  | 'cancelled';
