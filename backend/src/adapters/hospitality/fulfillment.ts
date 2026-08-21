/**
 * Hospitality fulfillment adapter (plan Phase 2 fix #2, Phase 24/43).
 *
 * This module is ADAPTER code — hospitality vocabulary lives HERE, not in the
 * generic engine core. The generic contract (engines/fulfillment-contract.ts,
 * engines/layered-state.ts) never knows "preparation", "takeaway", "counter"
 * or "delivered-to-a-guest"; it only reads this adapter's declared state
 * machine and bridge mechanically.
 *
 * Canonical hospitality fulfillment lifecycle:
 *
 *   confirmed → queued → in_progress → ready → handed_off
 *
 * Cross-layer moves (completion / cancellation of the whole transaction) are
 * declared here so the fulfillment layer is the ONLY path that completes a
 * required-fulfillment transaction.
 *
 * TRANSITIONAL LEGACY BRIDGE (Stage 6 removes this): until fulfillment rows
 * exist, transactions.status carries legacy composite values
 * (preparing/ready/delivered). Those maps are declared here and applied
 * mechanically by generic code. Nothing may read fulfillment meaning from
 * transactions.status once fulfillment has its own persistence.
 */

import type {
  AutoHandoffPolicy,
  StateMachineDefinition,
} from '../../engines/types.js';

export const HOSPITALITY_FULFILLMENT_STATES = [
  'queued',
  'in_progress',
  'ready',
  'handed_off',
] as const;

export type HospitalityFulfillmentStatus = (typeof HOSPITALITY_FULFILLMENT_STATES)[number];

/**
 * Machine states = the fulfillment lifecycle PLUS the cross-layer entry/exit
 * points the machine transitions from/to (confirmed, completed, cancelled).
 */
export type HospitalityFulfillmentMachineStatus =
  | 'confirmed'
  | HospitalityFulfillmentStatus
  | 'completed'
  | 'cancelled';

export const hospitalityFulfillmentStateMachine: StateMachineDefinition<HospitalityFulfillmentMachineStatus> = {
  states: ['confirmed', 'queued', 'in_progress', 'ready', 'handed_off', 'completed', 'cancelled'],
  initialState: 'queued',
  // handed_off is NOT terminal: the transaction still completes/cancels from it.
  terminalStates: ['completed', 'cancelled'],
  transitions: [
    // Entry: fulfillment is queued the moment the transaction is committed.
    { from: 'confirmed', to: 'queued', action: 'queue_fulfillment', allowedActors: ['system'], guardDescription: 'Transaction confirmed — fulfillment queued for the work center' },
    // Execution.
    { from: 'confirmed', to: 'in_progress', action: 'start_preparation', allowedActors: ['staff', 'system'], guardDescription: 'Work center accepted the order (legacy: confirmed → preparing)' },
    { from: 'queued', to: 'in_progress', action: 'start_preparation', allowedActors: ['staff', 'system'], guardDescription: 'Work center starts the queued item' },
    { from: 'in_progress', to: 'ready', action: 'mark_ready', allowedActors: ['staff'], guardDescription: 'All items are prepared' },
    { from: 'confirmed', to: 'ready', action: 'mark_ready', allowedActors: ['staff'], guardDescription: 'Direct to ready without preparation tracking' },
    { from: 'queued', to: 'ready', action: 'mark_ready', allowedActors: ['staff'], guardDescription: 'Direct to ready without preparation tracking (e.g. item-level auto-derivation from a fresh row)' },
    // Handoff.
    { from: 'ready', to: 'handed_off', action: 'deliver', allowedActors: ['staff'], guardDescription: 'Handed to the customer or placed at the destination' },
    // Completion (cross-layer: fulfillment done → transaction completed).
    { from: 'handed_off', to: 'completed', action: 'complete', allowedActors: ['staff', 'system'], guardDescription: 'Customer acknowledged receipt / auto-complete' },
    // NOTE: there is NO implicit ready → completed shortcut here. Counter /
    // takeaway orders complete via the EXPLICIT auto-handoff policy below,
    // which the generic core applies — completion at 'ready' is a declared
    // capability, not a hidden machine transition.
    // Cancellation from any fulfillment stage (cross-layer → transaction
    // cancelled). Stage 6 fix: once the confirm trigger creates the row at
    // 'queued', the ORDER sits at 'queued' — so cancellation must be reachable
    // from 'queued' AND 'confirmed' (a confirmed order whose row is the
    // pre-trigger state), not just the mid-flight stages. Actors mirror the
    // transaction machine's confirmed → cancelled (staff/admin).
    { from: 'confirmed', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Staff/admin cancel a confirmed (queued) order — triggers refund + inventory reversal' },
    { from: 'queued', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Staff/admin cancel a queued order — triggers refund + inventory reversal' },
    { from: 'in_progress', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only comp/void in preparation — requires refund + inventory reversal' },
    { from: 'ready', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only comp/void when ready — requires refund + inventory reversal' },
    { from: 'handed_off', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only comp/void after handoff — requires refund + inventory reversal' },
  ],
};

/**
 * EXPLICIT auto-handoff policy: an order that reaches `ready` is deemed
 * handed off (counter/takeaway) — the transaction may complete directly
 * from 'ready' via the machine's own completion action ('complete'). This
 * replaces the former implicit `ready → completed` machine shortcut: the
 * policy is declared here, validated at registration, and applied by the
 * generic core. No hidden transition exists on the machine.
 */
export const HOSPITALITY_AUTO_HANDOFF: AutoHandoffPolicy<HospitalityFulfillmentMachineStatus> = {
  atState: 'ready',
  allowedActors: ['staff', 'system'],
};


