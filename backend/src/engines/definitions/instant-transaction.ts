/**
 * Engine A: Instant Transaction
 *
 * Economic Pattern: one-time commercial transaction with downstream fulfillment.
 * Commercial Entity: Order
 *
 * GENERIC CORE — the definition declares capabilities and wires the FIRST
 * implementation (the hospitality adapter) into them. "Kitchen", "table",
 * "preparation" and "takeaway" live in adapters/hospitality — never here.
 *
 * LAYERED STATE MODEL (plan Phase 3):
 *   - `stateMachine` = TRANSACTION layer: pending → confirmed → completed /
 *     cancelled. NOTE: with required fulfillment, there is NO direct
 *     confirmed → completed transition — completion is capability-gated and
 *     must originate from the fulfillment layer (the layered validator
 *     enforces this even if a future edit adds such a transition).
 *   - `capabilities.fulfillment` = FULFILLMENT layer (hospitality adapter):
 *     confirmed → queued → in_progress → ready → handed_off.
 */

import type {
  EngineDefinition,
  StateMachineDefinition,
  PricingConfig,
  InteractionContract,
  TransactionState,
} from '../types.js';
import {
  hospitalityFulfillmentStateMachine,
  HOSPITALITY_AUTO_HANDOFF,
  type HospitalityFulfillmentMachineStatus,
} from '../../adapters/hospitality/fulfillment.js';
import {
  digitalFulfillmentStateMachine,
  type DigitalFulfillmentMachineStatus,
} from '../../adapters/digital/fulfillment.js';
import {
  shipmentFulfillmentStateMachine,
} from '../../adapters/shipment/fulfillment.js';
import {
  serviceFulfillmentStateMachine,
} from '../../adapters/service/fulfillment.js';

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
    // NO confirmed → completed here: fulfillment is required, so completion
    // is capability-gated and originates from the fulfillment layer
    // (handed_off → completed in the hospitality adapter machine).
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
    // as the work-center (KDS) notification.
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

/**
 * Engine A's fulfillment status type: the union of every fulfillment adapter
 * it binds. The compiler enforces that each mode binding's machine uses THIS
 * engine's fulfillment-state type (no string erasure through the registry).
 */
export type InstantTransactionFulfillmentStatus =
  | HospitalityFulfillmentMachineStatus
  | DigitalFulfillmentMachineStatus;

export const instantTransactionEngine: EngineDefinition<TransactionState, InstantTransactionFulfillmentStatus> = {
  type: 'instant_transaction',
  name: 'Instant Transaction',
  description: 'One-time commercial transaction with downstream fulfillment: commitment → execution → handoff → completion.',
  commercialEntity: 'order',
  stateMachine: instantTransactionStateMachine,
  pricing: instantTransactionPricing,
  interactions: instantTransactionInteractions,
  capabilities: {
    transactionModel: {
      supportsDraft: false, // draft lives in the cart workspace (plan Phase 13 / CartState)
      autoComplete: true,
      states: ['pending', 'confirmed', 'completed', 'cancelled'],
    },
    commitment: {
      type: 'inventory',
      reservation: false,
      commitmentTrigger: 'on_purchase',
      reversalOnCancel: true,
    },
    resources: {
      // Engine A consumes inventory via the hospitality BOM (order items →
      // recipe ingredients) — the DEFAULT model for the hospitality modes.
      // Mode bindings may override (digital_delivery consumes nothing); the
      // generic service resolves the model per (engine, mode), never
      // engine-wide (plan Phase 5 — mode-aware).
      type: 'inventory',
      kinds: ['inventory_item'],
      allocation: 'on_purchase',
      consumption: 'on_fulfillment_handoff',
      reversalOnCancel: true,
    },
    fulfillment: {
      required: true,
      options: [
        { mode: 'on_premise', destinations: ['on_premise_location', 'room'] },
        { mode: 'pickup', destinations: ['pickup_location'] },
        { mode: 'local_delivery', destinations: ['address'] },
        { mode: 'digital_delivery', destinations: ['digital_account'] },
        { mode: 'shipment', destinations: ['address'] },
        { mode: 'service_execution', destinations: ['service_location'] },
        // Digital delivery is a FULFILLMENT MODE of Engine A — not a new
        // engine. The same capability contract hosts a radically different
        // adapter (provisioning → delivered) with zero new engine semantics.
        { mode: 'digital_delivery', destinations: ['digital_account'] },
      ],
      groups: false,
      tracking: false,
      // Per-mode machine routing: hospitality modes → the hospitality
      // adapter's machine; digital_delivery → the digital adapter's machine.
      // Handoff and RESOURCE semantics are per MODE, never engine-wide:
      // hospitality models a separate handoff step (handed_off state) and
      // consumes inventory at handoff; digital delivery has no handoff step
      // (delivery to the digital account IS the handoff) and consumes no
      // physical inventory.
      modeMachines: [
        {
          modes: ['on_premise', 'pickup', 'local_delivery'],
          handoff: true,
          machine: hospitalityFulfillmentStateMachine,
          autoHandoff: HOSPITALITY_AUTO_HANDOFF,
        },
        {
          modes: ['digital_delivery'],
          handoff: false,
          // Digital goods consume no physical inventory, and this mode has
          // no handoff step — the engine-wide inventory model would be
          // WRONG for it (too restrictive). The override resolves to 'none'.
          resources: { type: 'none' },
          machine: digitalFulfillmentStateMachine,
        },
        {
          modes: ['shipment'],
          handoff: true,
          machine: shipmentFulfillmentStateMachine,
        },
        {
          modes: ['service_execution'],
          handoff: true,
          machine: serviceFulfillmentStateMachine,
        },
        // 'none' mode: no fulfillment machine — order stays in pending/confirmed
        // until manually completed or cancelled.
      ],
    },
    execution: {
      enabled: true,
      workCenters: true,
      operators: true,
      // Generic execution declaration only — the WORK-CENTER STATES are
      // adapter-owned (the hospitality binding's fulfillment machine
      // declares queued/in_progress/ready/handed_off per mode). The generic
      // Engine A definition never carries vertical states.
      states: [],
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
