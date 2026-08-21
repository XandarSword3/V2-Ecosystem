/**
 * Engine Service
 * 
 * High-level service that provides engine-powered operations to controllers.
 * This is the bridge between the raw engine framework and the existing module controllers.
 * 
 * Instead of each controller implementing its own pricing/state logic,
 * they call EngineService methods which route through the unified engine framework.
 * 
 * Usage (in a controller):
 * 
 *   import { engineService } from '../engines/engine-service.js';
 *   
 *   // Calculate pricing for any engine
 *   const pricing = await engineService.calculatePricing('instant_transaction', lineItems, context);
 *   
 *   // Validate + execute state transition for any engine
 *   const result = await engineService.transitionState('instant_transaction', currentStatus, 'confirm', 'staff');
 *   
 *   // Get available actions for UI display
 *   const actions = engineService.getAvailableActions('shared_capacity_access', 'valid', 'staff');
 */

import type {
  EngineType,
  FulfillmentMode,
  PricingLineItem,
  PricingContext,
  PricingResult,
  EngineDefinition,
} from './types.js';
import { TEMPLATE_TO_ENGINE } from './types.js';
import { getEngine, getEngineByTemplate, createStateMachine } from './registry.js';
import { PricingPipeline, type PricingPipelineDeps } from './pricing-pipeline.js';
import { StateMachine, StateMachineError } from './state-machine.js';
import { LayeredStateMachine } from './layered-state.js';
import { createDiscountResolvers } from './discount-resolvers.js';
import { getFinancialLedgerService, type LedgerTransactionType } from './financial-ledger.js';
import { getTransactionManager, type TransactionStep, type EngineOperationContext } from './transaction-manager.js';
import { TaxService } from '../services/tax.service.js';
import { logger } from '../utils/logger.js';

// ============================================
// Engine Service
// ============================================

export class EngineService {
  private pricingPipeline: PricingPipeline;
  private stateMachines: Map<EngineType, StateMachine> = new Map();
  // Keyed by engine type, or `${engineType}::${mode}` when mode-scoped.
  private fulfillmentMachines: Map<string, StateMachine[]> = new Map();

  constructor(deps?: Partial<PricingPipelineDeps>) {
    // Create pricing pipeline with default or injected dependencies
    const taxService = new TaxService();
    const resolvers = createDiscountResolvers();

    this.pricingPipeline = new PricingPipeline({
      taxService: deps?.taxService || taxService,
      couponResolver: deps?.couponResolver || resolvers.couponResolver,
      giftCardResolver: deps?.giftCardResolver || resolvers.giftCardResolver,
      loyaltyResolver: deps?.loyaltyResolver || resolvers.loyaltyResolver,
    });
  }

  // ============================================
  // Engine Lookup
  // ============================================

  /**
   * Get the engine definition for a database template_type.
   */
  getEngineForTemplate(templateType: string): EngineDefinition {
    return getEngineByTemplate(templateType);
  }

  /**
   * Get the engine type for a database template_type.
   */
  resolveEngineType(templateType: string): EngineType {
    const engineType = TEMPLATE_TO_ENGINE[templateType];
    if (!engineType) {
      throw new Error(`Unknown template type: '${templateType}'`);
    }
    return engineType;
  }

  // ============================================
  // Pricing Operations
  // ============================================

  /**
   * Calculate complete pricing using the unified pipeline.
   * 
   * @param templateType - Engine type (e.g., 'instant_transaction')
   * @param lineItems - Items to price
   * @param context - Runtime context (moduleId, customer, discounts)
   * @returns Complete pricing breakdown
   */
  async calculatePricing(
    templateType: string,
    lineItems: PricingLineItem[],
    context: PricingContext,
  ): Promise<PricingResult> {
    const engine = getEngineByTemplate(templateType);

    logger.info(`[ENGINE SERVICE] Calculating pricing for engine '${engine.type}'`, {
      templateType,
      moduleId: context.moduleId,
      lineItemCount: lineItems.length,
    });

    const result = await this.pricingPipeline.calculate(
      lineItems,
      engine.pricing,
      context,
    );

    logger.info(`[ENGINE SERVICE] Pricing calculated`, {
      subtotal: result.subtotal,
      totalAmount: result.totalAmount,
      discountCount: result.discounts.length,
    });

    return result;
  }

  // ============================================
  // State Machine Operations
  // ============================================

  /**
   * Get or create the state machine for an engine type.
   */
  private getStateMachine(engineType: EngineType): StateMachine {
    let sm = this.stateMachines.get(engineType);
    if (!sm) {
      sm = createStateMachine(engineType);
      this.stateMachines.set(engineType, sm);
    }
    return sm;
  }

  /**
   * Get or create the FULFILLMENT-layer state machines declared by the
   * engine's capability contract (plan Phase 2/3, per-mode bindings). When a
   * MODE is given, ONLY that mode's binding machine is returned — the
   * binding is the runtime authority, so a digital_delivery row can never be
   * validated against the hospitality machine (or vice versa), even if the
   * two adapters ever share a state name. Without a mode (transaction-layer
   * surfaces) every bound machine is used. Empty when the engine has none.
   */
  private getFulfillmentMachines(engineType: EngineType, mode?: FulfillmentMode): StateMachine[] {
    const key = mode ? `${engineType}::${mode}` : engineType;
    const cached = this.fulfillmentMachines.get(key);
    if (cached) return cached;
    const bindings = getEngine(engineType).capabilities?.fulfillment?.modeMachines ?? [];
    let machines: StateMachine[];
    if (mode) {
      const binding = bindings.find(b => b.modes.includes(mode));
      // A mode the engine does not offer resolves to NO fulfillment layer —
      // fail closed (the transaction machine still works).
      machines = binding ? [new StateMachine(binding.machine)] : [];
    } else {
      machines = bindings.map(binding => new StateMachine(binding.machine));
    }
    this.fulfillmentMachines.set(key, machines);
    return machines;
  }

  /**
   * Build the layered validator for an engine: transaction machine + the
   * fulfillment machine(s) for the requested mode. When a MODE is given, the
   * fulfillment definition handed to the validator is FILTERED to that mode's
   * binding, so even the auto-handoff policy is scoped to the selected mode
   * — the binding is the runtime authority, never an engine-wide guess. The
   * completion gate is applied generically inside LayeredStateMachine.
   */
  private buildLayered(engineType: EngineType, mode?: FulfillmentMode): LayeredStateMachine {
    const sm = this.getStateMachine(engineType);
    const definition = getEngine(engineType);
    const fulfillment = definition.capabilities.fulfillment;
    if (mode) {
      const binding = (fulfillment.modeMachines ?? []).find(b => b.modes.includes(mode));
      if (!binding) {
        // Mode not offered by this engine — no fulfillment layer for the move.
        return new LayeredStateMachine(sm, [], { ...fulfillment, modeMachines: [] });
      }
      return new LayeredStateMachine(sm, this.getFulfillmentMachines(engineType, mode), {
        ...fulfillment,
        modeMachines: [binding],
      });
    }
    return new LayeredStateMachine(sm, this.getFulfillmentMachines(engineType), fulfillment);
  }

  /**
   * Attempt a state transition using the engine's state machine.
   * Returns a result indicating success/failure without throwing.
   * 
   * @param templateType - Database template_type
   * @param currentState - Current status of the entity
   * @param action - The action to perform (e.g., 'confirm', 'cancel', 'check_in')
   * @param actor - Who is performing the action
   * @param context - Additional context for guards
   * @returns Object with allowed, targetState, error — never throws
   */
  async transitionState(
    templateType: string,
    currentState: string,
    action: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
    context: Record<string, unknown> = {},
    /**
     * The fulfillment MODE of the entity being moved (the row's mode). When
     * given, only THAT mode's binding machine validates fulfillment-layer
     * moves — a digital_delivery row can never be moved with a hospitality
     * action. Omit for transaction-layer surfaces (engine-wide view).
     */
    fulfillmentMode?: FulfillmentMode,
  ): Promise<{
    allowed: boolean;
    targetState: string;
    error?: string;
    /** Canonical target state — the fulfillment meaning when layer === 'fulfillment' (Stage 6 consumes it). */
    canonicalState?: string;
    /** Which layer performed the move. */
    layer?: 'transaction' | 'fulfillment';
  }> {
    const engineType = this.resolveEngineType(templateType);
    const layered = this.buildLayered(engineType, fulfillmentMode);

    logger.info(`[ENGINE SERVICE] State transition attempt`, {
      engineType,
      currentState,
      action,
      actor,
    });

    const check = layered.canTransition(currentState, action, actor, context);
    if (!check.allowed) {
      logger.info(`[ENGINE SERVICE] State transition rejected`, {
        engineType,
        currentState,
        action,
        error: check.error,
      });
      return { allowed: false, targetState: currentState, error: check.error };
    }

    try {
      const result = await layered.transition(currentState, action, actor, context);
      if (!result.allowed || result.targetState === undefined) {
        return { allowed: false, targetState: currentState, error: result.error };
      }
      logger.info(`[ENGINE SERVICE] State transition succeeded`, {
        engineType,
        previousState: currentState,
        newState: result.targetState,
        canonicalState: result.canonicalTarget,
        action,
        layer: result.layer,
      });
      return {
        allowed: true,
        targetState: result.targetState,
        // Canonical fulfillment meaning (Stage 6 consumes this; the legacy
        // composite in targetState is transitional).
        canonicalState: result.canonicalTarget,
        layer: result.layer,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(`[ENGINE SERVICE] State transition error`, { engineType, error });
      return { allowed: false, targetState: currentState, error };
    }
  }

  /**
   * Check if a state transition is valid (without executing it).
   */
  canTransition(
    templateType: string,
    currentState: string,
    action: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
    context: Record<string, unknown> = {},
    fulfillmentMode?: FulfillmentMode,
  ): { allowed: boolean; error?: string; targetState?: string } {
    const engineType = this.resolveEngineType(templateType);
    const check = this.buildLayered(engineType, fulfillmentMode).canTransition(currentState, action, actor, context);
    if (!check.allowed) return { allowed: false, error: check.error };
    return { allowed: true, targetState: check.targetState };
  }

  /**
   * Get all valid actions from a given state for a given actor.
   * Useful for UI rendering (show/hide buttons based on available actions).
   */
  getAvailableActions(
    templateType: string,
    currentState: string,
    actor: 'system' | 'staff' | 'customer' | 'admin',
    fulfillmentMode?: FulfillmentMode,
  ): Array<{ action: string; targetState: string }> {
    const engineType = this.resolveEngineType(templateType);
    return this.buildLayered(engineType, fulfillmentMode).getAvailableActions(currentState, actor);
  }

  /**
   * Get the initial state for a new entity of the given engine type.
   */
  getInitialState(templateType: string): string {
    const engineType = this.resolveEngineType(templateType);
    const sm = this.getStateMachine(engineType);
    return sm.getInitialState();
  }

  // ============================================
  // Financial Ledger Operations (MISSING-05)
  // ============================================

  /**
   * Record a financial transaction to the engine ledger.
   * Called after every successful engine-processed transaction.
   * This is how FinancialLedgerService gets callsites — every module
   * that creates or refunds a transaction calls this.
   */
  async recordToLedger(
    pricingResult: PricingResult,
    context: {
      tenantId: string;
      moduleId: string;
      propertyId?: string;
      templateType: string;
      entityId: string;
      entityType: string;
      transactionType: LedgerTransactionType;
      actorType: 'system' | 'staff' | 'customer' | 'admin';
      actorId?: string;
      entityState?: string;
      paymentMethod?: string;
      paymentReference?: string;
      idempotencyKey?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    const engineType = this.resolveEngineType(context.templateType);
    const ledger = getFinancialLedgerService();
    return ledger.recordFromPricing(pricingResult, {
      ...context,
      engineType,
    });
  }

  /**
   * Record a refund to the engine ledger.
   */
  async recordRefundToLedger(
    entityId: string,
    context: {
      tenantId: string;
      moduleId: string;
      templateType: string;
      entityType: string;
      /** ISO 4217 currency of the refund — required (DOMAIN.md F2). */
      currency: string;
      refundAmount: number;
      reason: string;
      actorType: 'system' | 'staff' | 'customer' | 'admin';
      actorId?: string;
      idempotencyKey?: string;
    },
  ): Promise<string> {
    const engineType = this.resolveEngineType(context.templateType);
    const ledger = getFinancialLedgerService();
    return ledger.recordRefund(entityId, { ...context, engineType });
  }

  /**
   * Execute a multi-step engine operation atomically (Saga pattern).
   * All steps succeed or all are compensated.
   * This is how TransactionManager gets callsites.
   */
  async executeAtomicOperation<T = unknown>(
    steps: TransactionStep[],
    context: EngineOperationContext,
  ): Promise<T> {
    const tm = getTransactionManager();
    const result = await tm.executeTransaction<T>(steps, context);
    if (!result.success) {
      throw new Error(
        `Engine operation failed at step '${result.failedStep}': ${result.error}`,
      );
    }
    return result.value as T;
  }

  /**
   * Check if a state is terminal (no further transitions possible).
   */
  isTerminalState(templateType: string, state: string): boolean {
    const engineType = this.resolveEngineType(templateType);
    const sm = this.getStateMachine(engineType);
    return sm.isTerminal(state);
  }

  /**
   * Get all states for an engine type.
   */
  getStates(templateType: string): string[] {
    const engineType = this.resolveEngineType(templateType);
    const sm = this.getStateMachine(engineType);
    return sm.getStates();
  }
}

// ============================================
// Singleton & Factory
// ============================================

let _engineService: EngineService | null = null;

/**
 * Get the singleton engine service instance.
 * For testing, use createEngineService() with custom deps.
 */
export function getEngineService(): EngineService {
  if (!_engineService) {
    _engineService = new EngineService();
  }
  return _engineService;
}

/**
 * Create an engine service with custom dependencies (for testing).
 */
export function createEngineService(deps?: Partial<PricingPipelineDeps>): EngineService {
  return new EngineService(deps);
}

/**
 * Reset the singleton (for testing).
 */
export function resetEngineService(): void {
  _engineService = null;
}
