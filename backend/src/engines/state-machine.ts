/**
 * State Machine Framework
 * 
 * A generic, reusable state machine enforcer.
 * No ad-hoc if/throw guards — ALL state transitions go through this.
 * 
 * Usage:
 *   const machine = new StateMachine(orderStateMachineDefinition);
 *   const result = machine.transition('pending', 'confirmed', 'confirm', 'staff');
 *   if (!result.success) throw new Error(result.error);
 */

import type {
  StateMachineDefinition,
  StateTransition,
  TransitionResult,
} from './types.js';

// ============================================
// State Machine Error
// ============================================

export class StateMachineError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly currentState: string;
  public readonly attemptedAction: string;
  public readonly attemptedTarget?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    currentState: string,
    attemptedAction: string,
    attemptedTarget?: string,
  ) {
    super(message);
    this.name = 'StateMachineError';
    this.code = code;
    this.statusCode = statusCode;
    this.currentState = currentState;
    this.attemptedAction = attemptedAction;
    this.attemptedTarget = attemptedTarget;
  }
}

// ============================================
// Guard Function Type
// ============================================

/**
 * A guard function receives the transition context and returns
 * true if the transition is allowed, or a string error message if not.
 */
export type GuardFn<TContext = Record<string, unknown>> = (
  transition: StateTransition,
  context: TContext,
) => true | string;

// ============================================
// Side Effect Type
// ============================================

/**
 * A side effect to execute after a successful transition.
 * Side effects are fire-and-forget — they don't block the transition.
 */
export type SideEffectFn<TContext = Record<string, unknown>> = (
  transition: StateTransition,
  context: TContext,
) => Promise<void>;

// ============================================
// State Machine
// ============================================

export class StateMachine<TStatus extends string = string> {
  private readonly definition: StateMachineDefinition<TStatus>;
  private readonly guards: Map<string, GuardFn[]> = new Map();
  private readonly sideEffects: Map<string, SideEffectFn[]> = new Map();

  constructor(definition: StateMachineDefinition<TStatus>) {
    this.validateDefinition(definition);
    this.definition = definition;
  }

  // ---- Configuration ----

  /**
   * Register a guard function for a specific action.
   * Guards are evaluated in order. If any guard returns an error string, the transition is blocked.
   */
  addGuard(action: string, guard: GuardFn): this {
    const existing = this.guards.get(action) || [];
    existing.push(guard);
    this.guards.set(action, existing);
    return this;
  }

  /**
   * Register a side effect for a specific action.
   * Side effects run after the transition succeeds. Failures are logged but don't roll back.
   */
  addSideEffect(action: string, effect: SideEffectFn): this {
    const existing = this.sideEffects.get(action) || [];
    existing.push(effect);
    this.sideEffects.set(action, existing);
    return this;
  }

  // ---- Core Operations ----

  /**
   * Get the initial state for this engine.
   */
  getInitialState(): TStatus {
    return this.definition.initialState;
  }

  /**
   * Check if a state is terminal (no transitions out).
   */
  isTerminal(state: TStatus): boolean {
    return this.definition.terminalStates.includes(state);
  }

  /**
   * Get all valid actions from a given state.
   */
  getAvailableActions(
    currentState: TStatus,
    actor: 'system' | 'staff' | 'customer' | 'admin',
  ): Array<{ action: string; targetState: TStatus }> {
    return this.definition.transitions
      .filter(t => t.from === currentState && t.allowedActors.includes(actor))
      .map(t => ({ action: t.action, targetState: t.to }));
  }

  /**
   * Find the transition definition for a given action from a given state.
   */
  findTransition(
    currentState: TStatus,
    action: string,
  ): StateTransition<TStatus> | undefined {
    return this.definition.transitions.find(
      t => t.from === currentState && t.action === action,
    );
  }

  /**
   * Validate whether a transition is allowed (without executing it).
   */
  canTransition(
    currentState: TStatus,
    action: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
    context: Record<string, unknown> = {},
  ): { allowed: boolean; error?: string; targetState?: TStatus } {
    // 1. Validate current state
    if (!this.definition.states.includes(currentState)) {
      return { allowed: false, error: `Invalid state: '${currentState}'` };
    }

    // 2. Check terminal
    if (this.isTerminal(currentState)) {
      return { allowed: false, error: `State '${currentState}' is terminal — no transitions allowed` };
    }

    // 3. Find matching transition
    const transition = this.findTransition(currentState, action);
    if (!transition) {
      const available = this.getAvailableActions(currentState, actor);
      const actionList = available.length > 0
        ? available.map(a => `'${a.action}'`).join(', ')
        : 'none';
      return {
        allowed: false,
        error: `Action '${action}' is not valid from state '${currentState}'. Available actions: ${actionList}`,
      };
    }

    // 4. Check actor permission
    if (!transition.allowedActors.includes(actor)) {
      return {
        allowed: false,
        error: `Actor '${actor}' cannot perform '${action}'. Allowed: ${transition.allowedActors.join(', ')}`,
      };
    }

    // 5. Evaluate guards
    const guards = this.guards.get(action) || [];
    for (const guard of guards) {
      const result = guard(transition, context);
      if (result !== true) {
        return { allowed: false, error: result };
      }
    }

    return { allowed: true, targetState: transition.to };
  }

  /**
   * Execute a state transition.
   * 
   * @returns TransitionResult indicating success/failure.
   * @throws StateMachineError if the transition is invalid.
   */
  async transition(
    currentState: TStatus,
    action: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
    context: Record<string, unknown> = {},
  ): Promise<TransitionResult<TStatus>> {
    const check = this.canTransition(currentState, action, actor, context);

    if (!check.allowed) {
      throw new StateMachineError(
        check.error!,
        'INVALID_STATE_TRANSITION',
        409,
        currentState,
        action,
        check.targetState,
      );
    }

    const targetState = check.targetState!;
    const transition = this.findTransition(currentState, action)!;

    // Execute side effects (non-blocking)
    const effects = this.sideEffects.get(action) || [];
    for (const effect of effects) {
      try {
        await effect(transition, context);
      } catch (err) {
        // Side effects are fire-and-forget — log but don't block
        console.error(`Side effect failed for action '${action}':`, err);
      }
    }

    return {
      success: true,
      previousState: currentState,
      newState: targetState,
      action,
      timestamp: new Date(),
    };
  }

  /**
   * Get the full state machine definition (for introspection/documentation).
   */
  getDefinition(): StateMachineDefinition<TStatus> {
    return { ...this.definition };
  }

  /**
   * Get all states.
   */
  getStates(): TStatus[] {
    return [...this.definition.states];
  }

  // ---- Internal Validation ----

  private validateDefinition(def: StateMachineDefinition<TStatus>): void {
    if (!def.states.length) {
      throw new Error('State machine must have at least one state');
    }

    if (!def.states.includes(def.initialState)) {
      throw new Error(`Initial state '${def.initialState}' is not in the states list`);
    }

    for (const terminal of def.terminalStates) {
      if (!def.states.includes(terminal)) {
        throw new Error(`Terminal state '${terminal}' is not in the states list`);
      }
    }

    for (const t of def.transitions) {
      if (!def.states.includes(t.from)) {
        throw new Error(`Transition from '${t.from}' references unknown state`);
      }
      if (!def.states.includes(t.to)) {
        throw new Error(`Transition to '${t.to}' references unknown state`);
      }
      // Terminal states should not have outgoing transitions
      if (def.terminalStates.includes(t.from)) {
        throw new Error(`Terminal state '${t.from}' cannot have outgoing transitions`);
      }
    }
  }
}
