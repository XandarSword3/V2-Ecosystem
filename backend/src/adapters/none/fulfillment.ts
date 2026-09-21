/**
 * "None" fulfillment adapter (defect D6 fix).
 *
 * The DEGENERATE third vertical: orders whose fulfillment selection is
 * `none` (pure point-of-sale / instantly-consumed transactions with no
 * destination). Before this adapter existed, `none` was deliberately exempt
 * from the "every required mode must bind a machine" contract rule — but the
 * completion gate then made such orders UNCOMPLETABLE: with required
 * fulfillment, completion may only originate from the fulfillment layer, and
 * `none` had no machine to originate it from. Orders parked on confirmed
 * forever with only `cancel` available.
 *
 * The machine models the intended semantics from the engine definition's own
 * comment ("no fulfillment work — order stays in pending/confirmed until
 * manually completed or cancelled"): the row is created at `queued`, which
 * for this mode means "nothing to do" (there is no fulfillment work to
 * start), and staff/admin may complete or cancel it.
 *
 * NOTE on the entry state: `queued` is deliberately reused (not a dedicated
 * `'none'` status) because `fulfillments.status` carries a CHECK allowlist
 * whose deployed definition predates this mode; `queued` is legal everywhere
 * and semantically accurate ("nothing queued" — a no-op placeholder).
 *
 * Cross-layer moves (completion / cancellation) are declared here so the
 * fulfillment layer remains the ONLY path that completes a
 * required-fulfillment transaction.
 */

import type { StateMachineDefinition } from '../../engines/types.js';

/**
 * Machine states = the entry state the fulfillment row is created in
 * (`queued` — nothing to do) PLUS the cross-layer exit points (completed,
 * cancelled).
 */
export type NoneFulfillmentMachineStatus = 'queued' | 'completed' | 'cancelled';

export const noneFulfillmentStateMachine: StateMachineDefinition<NoneFulfillmentMachineStatus> = {
  states: ['queued', 'completed', 'cancelled'],
  initialState: 'queued',
  terminalStates: ['completed', 'cancelled'],
  transitions: [
    // Completion (cross-layer: there is no fulfillment work — completing the
    // transaction IS the whole lifecycle).
    { from: 'queued', to: 'completed', action: 'complete', allowedActors: ['staff', 'admin', 'system'], guardDescription: 'No fulfillment work — staff/admin complete the transaction directly' },
    // Cancellation (cross-layer → transaction cancelled). Actors mirror the
    // transaction machine's confirmed-cancel (staff/admin; customers cancel
    // pre-confirmation through the transaction machine's pending-cancel).
    { from: 'queued', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Staff/admin cancel a confirmed no-fulfillment order' },
  ],
};
