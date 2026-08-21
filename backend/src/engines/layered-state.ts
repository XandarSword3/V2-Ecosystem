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
 *     once regardless of which layer performed the move).
 *
 * No legacy bridge exists here (Stage 6): canonical fulfillment state lives
 * in its own persistence (fulfillments rows) and is passed in directly.
 */

import type { FulfillmentDefinition } from './types.js';
import type { StateMachine } from './state-machine.js';
import {
  assertTransactionCompletionAllowed,
  COMPLETION_STATE,
} from './fulfillment-contract.js';

export type TransitionLayer = 'transaction' | 'fulfillment';

export interface LayeredCheckResult {
  allowed: boolean;
  error?: string;
  /** Canonical target state (the fulfillment meaning when layer === 'fulfillment'). */
  targetState?: string;
  /** Canonical target state (same as targetState — no bridge exists). */
  canonicalTarget?: string;
  layer?: TransitionLayer;
  /** True when this move was granted by the EXPLICIT auto-handoff policy. */
  autoHandoff?: boolean;
}

export class LayeredStateMachine {
  constructor(
    private readonly txMachine: StateMachine,
    private readonly fulfillmentMachine: StateMachine | null,
    private readonly fulfillment: FulfillmentDefinition,
  ) {}

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
        targetState: txCheck.targetState,
        canonicalTarget: txCheck.targetState,
        layer: 'transaction',
      };
    }

    // 2. Fulfillment layer (current state is canonical — no bridge).
    if (this.fulfillmentMachine) {
      const fmCheck = this.fulfillmentMachine.canTransition(currentState, action, actor, context);
      if (fmCheck.allowed && fmCheck.targetState !== undefined) {
        return {
          allowed: true,
          targetState: fmCheck.targetState,
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
      if (autoHandoff && currentState === autoHandoff.atState && action === this.completionAction) {
        if (autoHandoff.allowedActors.includes(actor)) {
          return {
            allowed: true,
            targetState: COMPLETION_STATE,
            canonicalTarget: COMPLETION_STATE,
            layer: 'fulfillment',
            autoHandoff: true,
          };
        }
        return {
          allowed: false,
          error: `Actor '${actor}' cannot complete from auto-handoff state '${currentState}'. Allowed: ${autoHandoff.allowedActors.join(', ')}`,
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
      await this.fulfillmentMachine!.transition(currentState, action, actor, context);
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
      merged.set(a.action, { action: a.action, targetState: a.targetState, layer: 'transaction' });
    }
    if (this.fulfillmentMachine) {
      for (const a of this.fulfillmentMachine.getAvailableActions(currentState, actor)) {
        if (!merged.has(a.action)) {
          merged.set(a.action, { action: a.action, targetState: a.targetState, layer: 'fulfillment' });
        }
      }
      // Auto-handoff completion is offered at the policy state (derived
      // action, actor-gated) — an explicit policy, not a machine shortcut.
      const autoHandoff = this.fulfillment.autoHandoff;
      if (
        autoHandoff &&
        currentState === autoHandoff.atState &&
        this.completionAction &&
        autoHandoff.allowedActors.includes(actor) &&
        !merged.has(this.completionAction!)
      ) {
        merged.set(this.completionAction!, {
          action: this.completionAction!,
          targetState: COMPLETION_STATE,
          layer: 'fulfillment',
        });
      }
    }
    return [...merged.values()];
  }
}
