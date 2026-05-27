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
}

export interface PricingConfig {
  applyTax: boolean;
  applyServiceCharge: boolean;
  serviceChargeCondition?: string;
  applyDeliveryFee: boolean;
  deliveryFeeCondition?: string;
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

export interface PricingResult extends EconomicsReporting {
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  serviceCharge: number;
  serviceChargeRate: number;
  deliveryFee: number;
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
  trigger: 'on_purchase' | 'on_payment' | 'on_refund' | 'on_cancel' | 'on_check_in' | 'on_check_out';
  guardDescription: string;
  idempotent: boolean;
  failureMode: 'block' | 'log_and_continue' | 'retry';
  compensatingAction?: string;
}

export interface EngineDefinition<TStatus extends string = string> {
  type: EngineType;
  name: string;
  description: string;
  commercialEntity: string;
  stateMachine: StateMachineDefinition<TStatus>;
  pricing: PricingConfig;
  interactions: InteractionContract[];
  dataExtraction?: Record<string, {
    enabled: boolean;
    fields: string[];
    description: string;
  }>;
}

export type InstantTransactionStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'completed'
  | 'cancelled';

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
