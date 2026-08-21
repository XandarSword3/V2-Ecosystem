/**
 * Engine A: Instant Transaction
 *
 * Economic Pattern: one-time commercial transaction with downstream fulfillment.
 * Commercial Entity: Order
 *
 * GENERIC CORE — no vertical vocabulary. "Menu", "kitchen", "table", "waiter"
 * are hospitality ADAPTER concepts (Stages 24/43); this definition declares
 * capabilities and lets adapters implement them.
 *
 * LAYERED STATE MODEL (plan Phase 3):
 *   - `stateMachine`            = TRANSACTION layer: pending → confirmed →
 *                                 completed / cancelled
 *   - `capabilities.fulfillment`= FULFILLMENT layer: confirmed → queued →
 *                                 in_progress → ready → handed_off
 * Until the fulfillment table exists (Stage 6), fulfillment state is bridged
 * onto transactions.status via legacy composite values (engines/fulfillment-states.ts).
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  TransactionState,
} from '../types.js';
import { instantTransactionFulfillmentStateMachine } from '../fulfillment-states.js';

// ============================================
// Transaction-layer state machine
// ============================================

export const instantTransactionStateMachine: StateMachineDefinition<TransactionState> = {
  states: ['pending', 'confirmed', 'completed', 'cancelled'],

  initialState: 'pending',

  terminalStates: ['completed', 'cancelled'],

  transitions: [
    // Economic commitment
    {
      from: 'pending',
      to: 'confirmed',
      action: 'confirm',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Payment validated or pay-at-counter accepted',
    },
    // Completion — the transaction can complete once its fulfillment layer
    // reports handoff (fulfillment machine carries the fulfillment moves).
    {
      from: 'confirmed',
      to: 'completed',
      action: 'complete',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Fulfillment handed off and acknowledged (or no fulfillment required)',
    },
    // Cancellation
    {
      from: 'pending',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['customer', 'staff', 'admin'],
      guardDescription: 'Not yet confirmed — free cancellation',
    },
    {
      from: 'confirmed',
      to: 'cancelled',
      action: 'cancel',
      allowedActors: ['staff', 'admin'],
      guardDescription: 'Staff/admin can cancel confirmed orders (triggers refund)',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const instantTransactionPricing: PricingConfig = {
  applyTax: true,
  // Service charge, delivery fee, resort fee, and any custom surcharges are entirely
  // CMS-driven via tax_configuration — configure them from Admin > Settings > Tax.
  applyFees: true,
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
    guardDescription: 'Products have inventory tracking enabled',
    idempotent: true,
    failureMode: 'log_and_continue',
    compensatingAction: 'Restore inventory if order is cancelled',
  },
  {
    // Generic execution notification — the hospitality adapter implements this
    // as the kitchen display system (KDS) notification (plan Phase 20/43).
    name: 'notify_execution_on_confirm',
    applicableEngines: ['instant_transaction'],
    trigger: 'on_purchase',
    guardDescription: 'Engine has an execution work center enabled',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
];

// ============================================
// Complete Engine Definition
// ============================================

export const instantTransactionEngine: EngineDefinition<TransactionState> = {
  type: 'instant_transaction',
  name: 'Instant Transaction',
  description: 'One-time commercial transaction with downstream fulfillment: commitment → execution → handoff → completion.',
  commercialEntity: 'order',
  stateMachine: instantTransactionStateMachine,
  pricing: instantTransactionPricing,
  interactions: instantTransactionInteractions,
  capabilities: {
    transactionModel: {
      supportsDraft: false, // draft lives in the cart workspace (plan Phase 13)
      autoComplete: true,
      states: ['draft', 'pending', 'confirmed', 'completed', 'cancelled'],
    },
    commitment: {
      type: 'inventory',
      reservation: false,
      deductionTrigger: 'on_purchase',
      reversalOnCancel: true,
    },
    fulfillment: {
      modes: ['on_premise', 'pickup', 'local_delivery'],
      destinations: ['on_premise_location', 'pickup_location', 'room', 'address'],
      groups: false,
      tracking: false,
      handoff: true,
      stateMachine: instantTransactionFulfillmentStateMachine,
    },
    execution: {
      enabled: true,
      workCenters: true,
      operators: true,
      states: ['queued', 'in_progress', 'ready', 'handed_off'],
      notificationTrigger: 'on_confirm',
    },
    economics: {
      multiTender: true,
      refunds: true,
      voids: true,
      ledger: true,
      loyalty: 'earn_and_redeem',
      coupons: true,
      giftCards: true,
      pos: true,
      currencyRequired: true,
    },
    customer: {
      guests: true,
      accounts: true,
      staffAssisted: true,
      reviews: true,
      serviceRecovery: true,
    },
    fiscal: {
      documents: ['invoice', 'receipt', 'credit_note', 'debit_note'],
      eInvoicing: false,
      controlledNumbering: true,
    },
    returns: {
      refund: 'full',
      physicalReturn: false,
      exchange: false,
      replacement: false,
      cancellation: true,
    },
  },
  // Economics data extraction capabilities
  dataExtraction: {
    staffAttribution: {
      enabled: true,
      fields: ['staffId', 'propertyId', 'moduleId'],
      description: 'Extract staff sales performance and tips'
    },
    promoEffectiveness: {
      enabled: true,
      fields: ['promoCodeUsed', 'discountAmount', 'upsellSuccess'],
      description: 'Measure promotion effectiveness on POS orders'
    },
    orderMetrics: {
      enabled: true,
      fields: ['averageOrderValue', 'itemCount', 'preparationTime'],
      description: 'Measure transaction sizes and fulfillment speed'
    }
  }
};
