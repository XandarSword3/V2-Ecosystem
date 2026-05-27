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

import type { EngineType, EngineDefinition } from './types.js';
import { TEMPLATE_TO_ENGINE } from './types.js';
import { StateMachine } from './state-machine.js';
import { deductInventorySideEffect, restoreInventorySideEffect } from './inventory-side-effects.js';

// Import all engine definitions
import { instantTransactionEngine } from './definitions/instant-transaction.js';
import { timeExclusiveReservationEngine } from './definitions/time-exclusive-reservation.js';
import { sharedCapacityAccessEngine } from './definitions/shared-capacity-access.js';
import { ongoingEntitlementEngine } from './definitions/ongoing-entitlement.js';
import { platformEntitlementEngine } from './definitions/platform-entitlement.js';

// ============================================
// Engine Registry
// ============================================

const ENGINE_REGISTRY: Record<EngineType, EngineDefinition> = {
  instant_transaction: instantTransactionEngine,
  time_exclusive_reservation: timeExclusiveReservationEngine,
  shared_capacity_access: sharedCapacityAccessEngine,
  ongoing_entitlement: ongoingEntitlementEngine,
  platform_entitlement: platformEntitlementEngine,
};

/**
 * Get an engine definition by engine type.
 * @throws Error if engine type is unknown.
 */
export function getEngine(engineType: EngineType): EngineDefinition {
  const engine = ENGINE_REGISTRY[engineType];
  if (!engine) {
    throw new Error(`Unknown engine type: '${engineType}'. Valid types: ${Object.keys(ENGINE_REGISTRY).join(', ')}`);
  }
  return engine;
}

/**
 * Get an engine definition by database template_type.
 * This is the primary lookup used by controllers/services.
 * 
 * @param templateType - The database module_template_type value (e.g., 'menu_service')
 * @throws Error if template type has no mapped engine.
 */
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
    // Deduct inventory when order is confirmed (preparation starts)
    sm.addSideEffect('confirm', deductInventorySideEffect);
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
 * Get all registered engine definitions.
 */
export function getAllEngines(): EngineDefinition[] {
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
