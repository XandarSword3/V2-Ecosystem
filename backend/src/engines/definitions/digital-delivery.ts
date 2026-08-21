/**
 * Engine F: Digital Delivery
 *
 * Economic Pattern: one-time purchase of a digital good delivered to the
 * customer's digital account.
 * Commercial Entity: Digital Order
 *
 * The SECOND fulfillment vertical (plan Phase 4 completion): proves a
 * non-hospitality fulfillment adapter plugs into the generic contract at
 * RUNTIME — through the registry, the layered validator, and the fulfillment
 * persistence service — without modifying Engine A core. The digital machine
 * lives in adapters/digital — never here.
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  TransactionState,
} from '../types.js';
import {
  digitalFulfillmentStateMachine,
  type DigitalFulfillmentMachineStatus,
} from '../../adapters/digital/fulfillment.js';

// ============================================
// Transaction-layer state machine
// ============================================

export const digitalDeliveryStateMachine: StateMachineDefinition<TransactionState> = {
  states: ['pending', 'confirmed', 'completed', 'cancelled'],
  initialState: 'pending',
  terminalStates: ['completed', 'cancelled'],
  transitions: [
    {
      from: 'pending',
      to: 'confirmed',
      action: 'confirm',
      allowedActors: ['staff', 'system'],
      guardDescription: 'Payment validated',
    },
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
      guardDescription: 'Staff/admin can cancel confirmed orders',
    },
  ],
};

// ============================================
// Pricing Configuration
// ============================================

export const digitalDeliveryPricing: PricingConfig = {
  applyTax: true,
  applyFees: false,
  supportsCoupons: true,
  supportsGiftCards: true,
  supportsLoyaltyRedemption: false,
  earnsLoyaltyPoints: false,
  deductsInventory: false,
  rounding: 'round',
  decimalPlaces: 2,
};

// ============================================
// Interaction Contracts
// ============================================

export const digitalDeliveryInteractions: InteractionContract[] = [
  {
    name: 'provision_digital_on_confirm',
    applicableEngines: ['digital_delivery'],
    trigger: 'on_purchase',
    guardDescription: 'Digital asset provisioning is triggered on confirmation',
    idempotent: true,
    failureMode: 'log_and_continue',
  },
];

// ============================================
// Complete Engine Definition
// ============================================

export const digitalDeliveryEngine: EngineDefinition<TransactionState, DigitalFulfillmentMachineStatus> = {
  type: 'digital_delivery',
  name: 'Digital Delivery',
  description: 'One-time purchase of a digital good delivered to the customer digital account.',
  commercialEntity: 'digital_order',
  stateMachine: digitalDeliveryStateMachine,
  pricing: digitalDeliveryPricing,
  interactions: digitalDeliveryInteractions,
  capabilities: {
    transactionModel: {
      supportsDraft: false,
      autoComplete: true,
      states: ['pending', 'confirmed', 'completed', 'cancelled'],
    },
    commitment: {
      type: 'none',
    },
    resources: {
      type: 'none',
    },
    fulfillment: {
      required: true,
      options: [
        { mode: 'digital_delivery', destinations: ['digital_account'] },
      ],
      groups: false,
      tracking: false,
      handoff: false,
      stateMachine: digitalFulfillmentStateMachine,
    },
    execution: {
      enabled: false,
      workCenters: false,
      operators: false,
      states: [],
      notificationTrigger: 'on_purchase',
    },
    economics: {
      multiTender: false,
      refunds: true,
      voids: false,
      ledger: true,
      loyalty: 'none',
      coupons: true,
      giftCards: true,
      pos: false,
      currencyRequired: true,
    },
    customer: {
      guests: true,
      accounts: true,
      staffAssisted: true,
      reviews: true,
      serviceRecovery: false,
    },
    fiscal: {
      documents: ['invoice', 'receipt', 'credit_note'],
      eInvoicing: false,
      controlledNumbering: false,
    },
    returns: {
      refund: 'full',
      physicalReturn: false,
      exchange: false,
      replacement: false,
      cancellation: true,
    },
  },
};
