/**
 * Engine A: Instant Transaction
 * 
 * Economic Pattern: Order → Prepare → Deliver → Done
 * Commercial Entity: Order
 * Examples: Restaurant, Snack Bar, Room Service, any menu-based ordering
 * 
 * This engine handles:
 *   - Menu items with categories, modifiers, and variants
 *   - Full pricing pipeline (tax, service charge, delivery fee, discounts)
 *   - Order lifecycle from placement to completion
 *   - Kitchen Display System (KDS) integration
 *   - Inventory deduction on order creation
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  InstantTransactionStatus,
} from '../types.js';

// ============================================
// State Machine
// ============================================

export const instantTransactionStateMachine: StateMachineDefinition<InstantTransactionStatus> = {
  states: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'],

  initialState: 'pending',

  terminalStates: ['completed', 'cancelled'],

  transitions: [
    // Happy path
    {
      from: 'pending',
      to: 'confirmed',
      action: 'confirm',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Payment validated or pay-at-counter accepted',
    },
    {
      from: 'confirmed',
      to: 'preparing',
      action: 'start_preparation',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Kitchen/bar has accepted the order',
    },
    {
      from: 'preparing',
      to: 'ready',
      action: 'mark_ready',
      allowedActors: ['staff'],
      guardDescription: 'All items in the order are prepared',
    },
    {
      from: 'ready',
      to: 'delivered',
      action: 'deliver',
      allowedActors: ['staff'],
      guardDescription: 'Order handed to customer or placed at table',
    },
    {
      from: 'delivered',
      to: 'completed',
      action: 'complete',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Customer confirmed receipt / auto-complete after timeout',
    },
    // Direct completion for quick-serve (takeaway/counter)
    {
      from: 'ready',
      to: 'completed',
      action: 'complete',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Takeaway/counter orders skip delivery step',
    },

    // Cancellation paths
    {
      from: 'pending',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Order not yet confirmed — free cancellation',
    },
    {
      from: 'confirmed',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['staff', 'admin'],
      guardDescription: 'Staff/admin can cancel confirmed orders (triggers refund)',
    },
    {
      from: 'preparing',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['admin'],
      guardDescription: 'Only admin can cancel orders in preparation (requires refund + inventory reversal)',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const instantTransactionPricing: PricingConfig = {
  applyTax: true,
  applyServiceCharge: true,
  serviceChargeCondition: 'orderType=dine_in',
  applyDeliveryFee: true,
  deliveryFeeCondition: 'orderType=delivery',
  supportsCoupons: true,
  supportsGiftCards: true,
  supportsLoyaltyRedemption: true,
  earnsLoyaltyPoints: true,
  deductsInventory: true,
  rounding: 'round',
  decimalPlaces: 2,
};

// ============================================
// Interaction Contracts
// ============================================

export const instantTransactionInteractions: InteractionContract[] = [
  {
    name: 'earn_loyalty_on_purchase',
    applicableEngines: ['instant_transaction'],
    trigger: 'on_payment',
    guardDescription: 'Customer has loyalty membership; payment is successful (not pending)',
    idempotent: true,
    failureMode: 'log_and_continue',
    compensatingAction: 'Reverse loyalty points if payment is refunded',
  },
  {
    name: 'deduct_inventory_on_purchase',
    applicableEngines: ['instant_transaction'],
    trigger: 'on_purchase',
    guardDescription: 'Menu items have inventory tracking enabled',
    idempotent: true,
    failureMode: 'log_and_continue',
    compensatingAction: 'Restore inventory if order is cancelled',
  },
  {
    name: 'notify_kitchen_on_confirm',
    applicableEngines: ['instant_transaction'],
    trigger: 'on_purchase',
    guardDescription: 'Module has KDS enabled',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
];

// ============================================
// Complete Engine Definition
// ============================================

export const instantTransactionEngine: EngineDefinition<InstantTransactionStatus> = {
  type: 'instant_transaction',
  name: 'Instant Transaction',
  description: 'Order → Prepare → Deliver → Done. Menu-based instant commerce.',
  commercialEntity: 'order',
  stateMachine: instantTransactionStateMachine,
  pricing: instantTransactionPricing,
  interactions: instantTransactionInteractions,
};
