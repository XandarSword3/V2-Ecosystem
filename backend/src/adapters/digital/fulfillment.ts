/**
 * Digital fulfillment adapter (plan Phase 4 completion — second vertical).
 *
 * The SECOND fulfillment adapter in the codebase, proving the generic
 * fulfillment contract (engines/fulfillment-contract.ts,
 * engines/layered-state.ts) is adapter-agnostic: a non-hospitality machine
 * plugs in with ZERO changes to the generic core. The core reads only the
 * declared capability contract; it never knows "kitchen", "preparation",
 * "provisioning" or "digital account" — that vocabulary lives HERE.
 *
 * Canonical digital fulfillment lifecycle:
 *
 *   confirmed → provisioning → provisioned → delivered → completed
 *
 * Handoff for digital goods is delivery TO the customer's digital account —
 * there is no physical handoff step, so this adapter declares no auto-handoff
 * policy (the machine's own `delivered → completed` transition is explicit).
 *
 * Cross-layer moves (completion / cancellation of the whole transaction) are
 * declared here so the fulfillment layer is the ONLY path that completes a
 * required-fulfillment transaction.
 */

import type { StateMachineDefinition } from '../../engines/types.js';

export const DIGITAL_FULFILLMENT_STATES = [
  'provisioning',
  'provisioned',
  'delivered',
] as const;

export type DigitalFulfillmentStatus = (typeof DIGITAL_FULFILLMENT_STATES)[number];

/**
 * Machine states = the fulfillment lifecycle PLUS the cross-layer entry/exit
 * points the machine transitions from/to (confirmed, completed, cancelled).
 */
export type DigitalFulfillmentMachineStatus =
  | 'confirmed'
  | DigitalFulfillmentStatus
  | 'completed'
  | 'cancelled';

export const digitalFulfillmentStateMachine: StateMachineDefinition<DigitalFulfillmentMachineStatus> = {
  states: ['confirmed', 'provisioning', 'provisioned', 'delivered', 'completed', 'cancelled'],
  initialState: 'provisioning',
  terminalStates: ['completed', 'cancelled'],
  transitions: [
    // Entry: provisioning starts the moment the transaction is committed.
    { from: 'confirmed', to: 'provisioning', action: 'provision', allowedActors: ['system'], guardDescription: 'Transaction confirmed — digital asset provisioning begins' },
    { from: 'provisioning', to: 'provisioned', action: 'finish_provisioning', allowedActors: ['system'], guardDescription: 'Digital asset generated and available for delivery' },
    { from: 'provisioned', to: 'delivered', action: 'deliver_digital', allowedActors: ['system'], guardDescription: 'Delivered to the customer digital account' },
    // Completion (cross-layer: fulfillment done → transaction completed).
    { from: 'delivered', to: 'completed', action: 'complete', allowedActors: ['system', 'staff'], guardDescription: 'Delivery acknowledged — transaction completes' },
    // Cancellation from any fulfillment stage (cross-layer → transaction
    // cancelled). Actors mirror the transaction machine's cancellation.
    { from: 'confirmed', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Staff/admin cancel a confirmed (provisioning) order' },
    { from: 'provisioning', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Staff/admin cancel while provisioning' },
    { from: 'provisioned', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only cancellation once provisioned' },
    { from: 'delivered', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only cancellation after delivery' },
  ],
};
