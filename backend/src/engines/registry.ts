/**
 * Engine Registry
 * 
 * Central registry that maps template_type → engine definition.
 * This is the SINGLE source of truth for engine lookup.
 * 
 * Usage:
 *   const engine = getEngine('instant_transaction');
 *   const engineFromTemplate = getEngineByTemplate('menu_service');
 *   const stateMachine = createStateMachine('instant_transaction');
 */

import type {
  EngineType,
  EngineDefinition,
  TransactionState,
  TimeExclusiveReservationStatus,
  SharedCapacityAccessStatus,
  OngoingEntitlementStatus,
  PlatformEntitlementStatus,
} from './types.js';
import { TEMPLATE_TO_ENGINE, ENGINE_TEMPLATES, type TemplateKey } from './types.js';
import { StateMachine } from './state-machine.js';
import { assertValidFulfillmentCapabilities } from './fulfillment-contract.js';
import { assertValidResourceConsumption } from './resource-contract.js';
import { deductInventorySideEffect, restoreInventorySideEffect } from './inventory-side-effects.js';
import type { InstantTransactionFulfillmentStatus } from './definitions/instant-transaction.js';

// Import all engine definitions
import { instantTransactionEngine } from './definitions/instant-transaction.js';
import { timeExclusiveReservationEngine } from './definitions/time-exclusive-reservation.js';
import { sharedCapacityAccessEngine } from './definitions/shared-capacity-access.js';
import { ongoingEntitlementEngine } from './definitions/ongoing-entitlement.js';
import { platformEntitlementEngine } from './definitions/platform-entitlement.js';

// ============================================
// Engine Registry
// ============================================

/**
 * The registry preserves each engine's generic parameters — an engine's
 * fulfillment-status type is NOT erased to `string` by lookup. This is the
 * compile-time guarantee that an engine's declared fulfillment machine uses
 * the engine's own fulfillment-state type all the way through the registry.
 */
export interface EngineRegistry {
  // Engine A has a real fulfillment layer — its fulfillment-status generic
  // (the union of its bound adapters' machines) is preserved through every
  // lookup. Engines B–E declare no fulfillment machine, so their second
  // generic is the honest default (string).
  instant_transaction: EngineDefinition<TransactionState, InstantTransactionFulfillmentStatus>;
  time_exclusive_reservation: EngineDefinition<TimeExclusiveReservationStatus>;
  shared_capacity_access: EngineDefinition<SharedCapacityAccessStatus>;
  ongoing_entitlement: EngineDefinition<OngoingEntitlementStatus>;
  platform_entitlement: EngineDefinition<PlatformEntitlementStatus>;
}

const ENGINE_REGISTRY: EngineRegistry = {
  instant_transaction: instantTransactionEngine,
  time_exclusive_reservation: timeExclusiveReservationEngine,
  shared_capacity_access: sharedCapacityAccessEngine,
  ongoing_entitlement: ongoingEntitlementEngine,
  platform_entitlement: platformEntitlementEngine,
};

/**
 * Validate every registered definition against the capability contract.
 * Runs ONCE at module load — an impossible configuration (required
 * fulfillment without a machine, illegal mode/destination pairing, or an
 * inconsistent commitment model) fails startup, not runtime.
 */
function validateRegistry(): void {
  for (const engine of Object.values(ENGINE_REGISTRY)) {
    assertValidFulfillmentCapabilities(engine.capabilities.fulfillment);
    // Generic resource-consumption contract (plan Phase 5): an impossible
    // resource model (consumption on a handoff that never happens, kinds
    // declared but no timing, …) fails STARTUP, not runtime.
    assertValidResourceConsumption(
      engine.capabilities.resources,
      engine.capabilities.fulfillment,
      engine.capabilities.execution,
    );
    const commitment = engine.capabilities.commitment;
    if (commitment.type !== 'none' && !commitment.commitmentTrigger) {
      throw new Error(
        `Engine '${engine.type}' declares commitment type '${commitment.type}' without a commitmentTrigger — impossible configuration`,
      );
    }
  }
}
validateRegistry();

/**
 * Get an engine definition by engine type — the generic parameters survive
 * the lookup, so `getEngine('instant_transaction')` returns the definition
 * typed with `HospitalityFulfillmentMachineStatus`, not `string`.
 * @throws Error if engine type is unknown.
 */
export function getEngine<K extends keyof EngineRegistry>(engineType: K): EngineRegistry[K] {
  const engine = ENGINE_REGISTRY[engineType];
  if (!engine) {
    throw new Error(`Unknown engine type: '${engineType}'. Valid types: ${Object.keys(ENGINE_REGISTRY).join(', ')}`);
  }
  return engine;
}

/**
 * Get an engine definition by database template_type.
 * This is the primary lookup used by controllers/services.
 * Literal template keys resolve to the engine's full definition type
 * (fulfillment generic preserved); dynamic strings widen to EngineDefinition.
 * 
 * @param templateType - The database module_template_type value (e.g., 'menu_service')
 * @throws Error if template type has no mapped engine.
 */
export function getEngineByTemplate<K extends TemplateKey>(templateType: K): EngineRegistry[typeof ENGINE_TEMPLATES[K]];
export function getEngineByTemplate(templateType: string): EngineDefinition;
export function getEngineByTemplate(templateType: string): EngineDefinition {
  const engineType = TEMPLATE_TO_ENGINE[templateType];
  if (!engineType) {
    throw new Error(
      `Unknown template type: '${templateType}'. Valid templates: ${Object.keys(TEMPLATE_TO_ENGINE).join(', ')}`,
    );
  }
  return getEngine(engineType);
}

/**
 * Create and return a StateMachine instance for the given engine type.
 * Each call creates a new instance (caller can add guards/effects).
 */
export function createStateMachine(engineType: EngineType): StateMachine {
  const engine = getEngine(engineType);
  const sm = new StateMachine(engine.stateMachine);
  
  // Register engine-specific side effects
  if (engineType === 'instant_transaction') {
    // Inventory is now deducted at order-creation time (POST /orders, via
    // deduct_inventory_for_order_items) rather than on 'confirm' — deducting
    // here too would double-deduct once the confirm transition is actually
    // wired up to persist a status change. deductInventorySideEffect is kept
    // as a module export in case a future engine needs confirm-time
    // deduction; it's just no longer registered here.
    // Restore inventory if order is cancelled
    sm.addSideEffect('cancel', restoreInventorySideEffect);
  }
  
  return sm;
}

/**
 * Create a StateMachine from a database template_type.
 */
export function createStateMachineByTemplate(templateType: string): StateMachine {
  const engineType = resolveEngineType(templateType);
  if (!engineType) {
    throw new Error(`Unknown template type: '${templateType}'`);
  }
  return createStateMachine(engineType);
}

/**
 * Get all registered engine types.
 */
export function getAllEngineTypes(): EngineType[] {
  return Object.keys(ENGINE_REGISTRY) as EngineType[];
}

/**
 * Get all registered engine definitions — each keeps its own generic
 * parameters (no erasure to `EngineDefinition<string, string>`).
 */
export function getAllEngines(): EngineRegistry[keyof EngineRegistry][] {
  return Object.values(ENGINE_REGISTRY);
}

/**
 * Check if a template type is valid/registered.
 */
export function isValidTemplateType(templateType: string): boolean {
  return templateType in TEMPLATE_TO_ENGINE;
}

/**
 * Resolve engine type from template type (without throwing).
 */
export function resolveEngineType(templateType: string): EngineType | undefined {
  return TEMPLATE_TO_ENGINE[templateType];
}

// Re-export individual engines for direct access
export { instantTransactionEngine } from './definitions/instant-transaction.js';
export { timeExclusiveReservationEngine } from './definitions/time-exclusive-reservation.js';
export { sharedCapacityAccessEngine } from './definitions/shared-capacity-access.js';
export { ongoingEntitlementEngine } from './definitions/ongoing-entitlement.js';
export { platformEntitlementEngine } from './definitions/platform-entitlement.js';