/**
 * Layered state validation (plan Phase 3) — generic, adapter-agnostic.
 *
 * Every engine has a TRANSACTION machine (`stateMachine`). Engines whose
 * capability contract declares a fulfillment layer additionally have a
 * FULFILLMENT machine (`capabilities.fulfillment.stateMachine`, supplied by
 * an adapter). This validator:
 *
 *   - tries the transaction machine first, then the fulfillment machine;
 *   - ENFORCES the completion gate: with required fulfillment, the
 *     transaction machine can never move the entity to `completed` — only
 *     the fulfillment machine's terminal/handoff → completed transition may
 *     complete the transaction (capability-driven, not convention);
 *   - executes fulfillment-layer transitions and ALSO fires the transaction
 *     layer's side effects for the action (compensation must run exactly
 *     once regardless of which layer performed the move);
 *   - applies the adapter's TRANSITIONAL legacy-status bridge mechanically
 *     (Stage 6 removes it — nothing here treats the legacy value as
 *     canonical fulfillment state).
 */

import type { FulfillmentDefinition, LegacyStatusBridge } from './types.js';
import type { StateMachine } from './state-machine.js';
import {
  assertTransactionCompletionAllowed,
  COMPLETION_STATE,
} from './fulfillment-contract.js';

export type TransitionLayer = 'transaction' | 'fulfillment';

export interface LayeredCheckResult {
  allowed: boolean;
  error?: string;
  /** Persisted-state view of the target (legacy-bridged while the bridge exists). */
  targetState?: string;
  /** Canonical target state (unbridged) — the fulfillment meaning when layer === 'fulfillment'. */
  canonicalTarget?: string;
  layer?: TransitionLayer;
  /** True when this move was granted by the EXPLICIT auto-handoff policy. */
  autoHandoff?: boolean;
}

export class LayeredStateMachine {
  private readonly bridge: LegacyStatusBridge | undefined;

  constructor(
    private readonly txMachine: StateMachine,
    private readonly fulfillmentMachine: StateMachine | null,
    private readonly fulfillment: FulfillmentDefinition,
  ) {
    this.bridge = fulfillment.legacyStatusBridge;
  }

  /** Canonical fulfillment state → persisted composite (TRANSITIONAL bridge). */
  private bridgeOut(state: string): string {
    return this.bridge?.canonicalToLegacy[state] ?? state;
  }

  /** Persisted composite → canonical fulfillment state (TRANSITIONAL bridge). */
  private bridgeIn(state: string): string {
    return this.bridge?.legacyToCanonical[state] ?? state;
  }

  /** Validate a move across both layers (never executes). */
  canTransition(
    currentState: string,
    action: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
    context: Record<string, unknown> = {},
  ): LayeredCheckResult {
    // 1. Transaction layer.
    const txCheck = this.txMachine.canTransition(currentState, action, actor, context);
    if (txCheck.allowed && txCheck.targetState !== undefined) {
      // Completion gate (capability-driven enforcement): required fulfillment
      // means the transaction machine must never complete the transaction.
      const gateError = assertTransactionCompletionAllowed(this.fulfillment, txCheck.targetState);
      if (gateError) {
        return { allowed: false, error: gateError };
      }
      return {
        allowed: true,
        targetState: this.bridgeOut(txCheck.targetState),
        canonicalTarget: txCheck.targetState,
        layer: 'transaction',
      };
    }

    // 2. Fulfillment layer (canonical current state).
    if (this.fulfillmentMachine) {
      const canonicalCurrent = this.bridgeIn(currentState);
      const fmCheck = this.fulfillmentMachine.canTransition(canonicalCurrent, action, actor, context);
      if (fmCheck.allowed && fmCheck.targetState !== undefined) {
        return {
          allowed: true,
          targetState: this.bridgeOut(fmCheck.targetState),
          canonicalTarget: fmCheck.targetState,
          layer: 'fulfillment',
        };
      }

      // 3. EXPLICIT auto-handoff policy (declared by the adapter, applied
      //    generically): at the policy's state, the transaction may complete
      //    directly without a separate handoff action. The completion action
      //    is DERIVED from the fulfillment machine's own transition to
      //    `completed` — never hardcoded by the core.
      const autoHandoff = this.fulfillment.autoHandoff;
      if (autoHandoff && canonicalCurrent === autoHandoff.atState && action === this.completionAction) {
        if (autoHandoff.allowedActors.includes(actor)) {
          return {
            allowed: true,
            targetState: this.bridgeOut(COMPLETION_STATE),
            canonicalTarget: COMPLETION_STATE,
            layer: 'fulfillment',
            autoHandoff: true,
          };
        }
        return {
          allowed: false,
          error: `Actor '${actor}' cannot complete from auto-handoff state '${canonicalCurrent}'. Allowed: ${autoHandoff.allowedActors.join(', ')}`,
        };
      }
    }

    // Report the transaction machine's error (it knows canonical states and
    // produces the friendlier "available actions" message).
    return { allowed: false, error: txCheck.error ?? `Action '${action}' is not valid from state '${currentState}'` };
  }

  /**
   * The fulfillment machine's own completion action (its transition to
   * `completed`). Derived — the core never hardcodes the action name, so a
   * non-hospitality adapter naming its completion differently still works.
   */
  private get completionAction(): string | undefined {
    if (!this.fulfillmentMachine) return undefined;
    const transition = this.fulfillmentMachine
      .getDefinition()
      .transitions.find(t => t.to === COMPLETION_STATE);
    return transition?.action;
  }

  /**
   * Execute a layered transition. Runs side effects on the executing machine;
   * when the fulfillment layer executed the move, the transaction layer's
   * side effects for the action STILL run (exactly once) so compensation
   * (e.g. inventory restore on cancel) is never skipped.
   */
  async transition(
    currentState: string,
    action: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
    context: Record<string, unknown> = {},
  ): Promise<LayeredCheckResult> {
    const check = this.canTransition(currentState, action, actor, context);
    if (!check.allowed || check.layer === undefined || check.targetState === undefined) {
      return { allowed: false, error: check.error };
    }

    if (check.layer === 'transaction') {
      await this.txMachine.transition(currentState, action, actor, context);
      return check;
    }

    // Fulfillment layer: execute there, then fire the transaction layer's
    // side effects for the same action (exactly once — the fulfillment
    // machine has none of its own registered). An auto-handoff move has no
    // machine transition of its own (the policy IS the move), so only the
    // transaction-layer effects run.
    if (!check.autoHandoff) {
      const canonicalCurrent = this.bridgeIn(currentState);
      await this.fulfillmentMachine!.transition(canonicalCurrent, action, actor, context);
    }
    await this.txMachine.runSideEffects(action, context);
    return check;
  }

  /** Merge available actions from both layers (deduped by action name). */
  getAvailableActions(
    currentState: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
  ): Array<{ action: string; targetState: string; layer: TransitionLayer }> {
    const merged = new Map<string, { action: string; targetState: string; layer: TransitionLayer }>();
    for (const a of this.txMachine.getAvailableActions(currentState, actor)) {
      // The completion gate applies here too: with required fulfillment, the
      // transaction machine must never OFFER completion — even if a future
      // edit re-adds a confirmed → completed transition, the gate hides it.
      if (assertTransactionCompletionAllowed(this.fulfillment, a.targetState)) {
        continue;
      }
      merged.set(a.action, { action: a.action, targetState: this.bridgeOut(a.targetState), layer: 'transaction' });
    }
    if (this.fulfillmentMachine) {
      const canonicalCurrent = this.bridgeIn(currentState);
      for (const a of this.fulfillmentMachine.getAvailableActions(canonicalCurrent, actor)) {
        if (!merged.has(a.action)) {
          merged.set(a.action, { action: a.action, targetState: this.bridgeOut(a.targetState), layer: 'fulfillment' });
        }
      }
      // Auto-handoff completion is offered at the policy state (derived
      // action, actor-gated) — an explicit policy, not a machine shortcut.
      const autoHandoff = this.fulfillment.autoHandoff;
      if (
        autoHandoff &&
        canonicalCurrent === autoHandoff.atState &&
        this.completionAction &&
        autoHandoff.allowedActors.includes(actor) &&
        !merged.has(this.completionAction!)
      ) {
        merged.set(this.completionAction!, {
          action: this.completionAction!,
          targetState: this.bridgeOut(COMPLETION_STATE),
          layer: 'fulfillment',
        });
      }
    }
    return [...merged.values()];
  }
}
