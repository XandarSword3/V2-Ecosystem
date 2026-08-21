/**
 * Fulfillment states — the FULFILLMENT layer of the instant-transaction
 * engine (DOMAIN.md — plan Phase 3).
 *
 * The engine's `stateMachine` is the TRANSACTION layer:
 *   pending → confirmed → completed / cancelled
 *
 * This module is the FULFILLMENT layer — the hospitality adapter-shaped
 * lifecycle:
 *   confirmed → queued → in_progress → ready → handed_off
 *
 * Cross-layer transitions are included here (completion/cancellation move the
 * whole transaction), because the fulfillment machine validates the moves the
 * operational surface actually performs.
 *
 * STORAGE BRIDGE: until the fulfillment table exists (Stage 6), fulfillment
 * state is persisted on transactions.status using the LEGACY composite values
 * that the whole operational surface (KDS, staff, analytics, fiscal,
 * frontend) already understands. The maps below are the ONE place that
 * bridge lives:
 *
 *   canonical fulfillment   → legacy transactions.status
 *   queued / in_progress    → 'preparing'
 *   ready                   → 'ready'
 *   handed_off              → 'delivered'
 *
 * Stage 6 removes the bridge: fulfillment rows carry the canonical states and
 * transactions.status reverts to the pure transaction layer.
 */
import type { StateMachineDefinition } from './types.js';

export const INSTANT_TRANSACTION_FULFILLMENT_STATES = [
  'queued',
  'in_progress',
  'ready',
  'handed_off',
] as const;

/**
 * The canonical fulfillment state machine for the instant-transaction engine.
 * It references cross-layer states (confirmed/completed/cancelled) so every
 * operational transition validates against exactly one machine.
 */
export const instantTransactionFulfillmentStateMachine: StateMachineDefinition = {
  states: [
    'confirmed', // cross-layer source: fulfillment starts once committed
    'queued',
    'in_progress',
    'ready',
    'handed_off',
    'completed', // cross-layer target
    'cancelled', // cross-layer target
  ],
  initialState: 'queued',
  // handed_off is NOT terminal: the transaction still completes/cancels from it.
  terminalStates: ['completed', 'cancelled'],
  transitions: [
    // Entry: fulfillment is queued the moment the transaction is committed.
    { from: 'confirmed', to: 'queued', action: 'queue_fulfillment', allowedActors: ['system'], guardDescription: 'Transaction confirmed — fulfillment queued for the work center' },
    // Preparation.
    { from: 'confirmed', to: 'in_progress', action: 'start_preparation', allowedActors: ['staff', 'system'], guardDescription: 'Work center accepted the order (legacy: confirmed → preparing)' },
    { from: 'queued', to: 'in_progress', action: 'start_preparation', allowedActors: ['staff', 'system'], guardDescription: 'Work center starts the queued item' },
    { from: 'in_progress', to: 'ready', action: 'mark_ready', allowedActors: ['staff'], guardDescription: 'All items are prepared' },
    { from: 'confirmed', to: 'ready', action: 'mark_ready', allowedActors: ['staff'], guardDescription: 'Direct to ready without preparation tracking' },
    // Handoff.
    { from: 'ready', to: 'handed_off', action: 'deliver', allowedActors: ['staff'], guardDescription: 'Handed to the customer or placed at the destination' },
    // Completion (cross-layer: fulfillment done → transaction completed).
    { from: 'handed_off', to: 'completed', action: 'complete', allowedActors: ['staff', 'system'], guardDescription: 'Customer acknowledged receipt / auto-complete' },
    { from: 'ready', to: 'completed', action: 'complete', allowedActors: ['staff', 'system'], guardDescription: 'Counter/takeaway orders complete at handoff without a separate delivered step' },
    // Cancellation from any fulfillment stage (cross-layer → transaction cancelled).
    { from: 'in_progress', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only comp/void in preparation — requires refund + inventory reversal' },
    { from: 'ready', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only comp/void when ready — requires refund + inventory reversal' },
    { from: 'handed_off', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin-only comp/void after handoff — requires refund + inventory reversal' },
  ],
};

/**
 * Legacy composite value on transactions.status → canonical fulfillment state.
 * Only used as an INPUT bridge (current state lookup) until Stage 6.
 */
export const LEGACY_TO_CANONICAL_FULFILLMENT: Readonly<Record<string, string>> = {
  preparing: 'in_progress',
  delivered: 'handed_off',
  ready: 'ready',
};

/**
 * Canonical fulfillment state → legacy composite value on transactions.status.
 * Only used as an OUTPUT bridge (status write) until Stage 6.
 */
export const CANONICAL_TO_LEGACY_FULFILLMENT: Readonly<Record<string, string>> = {
  queued: 'preparing',
  in_progress: 'preparing',
  ready: 'ready',
  handed_off: 'delivered',
};

/** Map a possibly-legacy state name to its canonical fulfillment state. */
export function canonicalizeFulfillmentState(state: string): string {
  return LEGACY_TO_CANONICAL_FULFILLMENT[state] ?? state;
}

/** Map a canonical fulfillment state to its legacy composite value. */
export function legacyFulfillmentState(state: string): string {
  return CANONICAL_TO_LEGACY_FULFILLMENT[state] ?? state;
}
