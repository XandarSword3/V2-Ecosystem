/**
 * V2 Ecosystem Engine Framework
 * 
 * The engine framework replaces ad-hoc, per-module business logic with
 * four formal business engines that all modules configure against.
 * 
 * Architecture:
 *   shared/types/engines.ts    → Type contracts (shared frontend/backend)
 *   engines/state-machine.ts   → Generic state machine enforcer
 *   engines/pricing-pipeline.ts → Universal pricing calculator
 *   engines/definitions/       → Per-engine configs (state machine + pricing + interactions)
 *   engines/registry.ts        → Lookup: template_type → engine
 * 
 * Usage (in a controller/service):
 * 
 *   import { getEngineByTemplate, createStateMachineByTemplate } from './engines/index.js';
 *   import { PricingPipeline } from './engines/index.js';
 * 
 *   // Get engine definition for a module
 *   const engine = getEngineByTemplate(module.template_type);
 * 
 *   // Create pricing pipeline
 *   const pipeline = new PricingPipeline({ taxService });
 *   const result = await pipeline.calculate(lineItems, engine.pricing, context);
 * 
 *   // Enforce state transitions
 *   const sm = createStateMachineByTemplate(module.template_type);
 *   const transition = await sm.transition(currentStatus, 'confirm', 'staff');
 */

// State Machine
export { StateMachine, StateMachineError } from './state-machine.js';
export type { GuardFn, SideEffectFn } from './state-machine.js';

// Pricing Pipeline
export { PricingPipeline } from './pricing-pipeline.js';
export type {
  PricingPipelineDeps,
  CouponResolver,
  GiftCardResolver,
  LoyaltyResolver,
} from './pricing-pipeline.js';

// Discount Resolvers (Supabase implementations)
export {
  SupabaseCouponResolver,
  SupabaseGiftCardResolver,
  SupabaseLoyaltyResolver,
  createDiscountResolvers,
} from './discount-resolvers.js';

// Engine Service (high-level API for controllers)
export {
  EngineService,
  getEngineService,
  createEngineService,
  resetEngineService,
} from './engine-service.js';

// Registry
export {
  getEngine,
  getEngineByTemplate,
  createStateMachine,
  createStateMachineByTemplate,
  getAllEngineTypes,
  getAllEngines,
  isValidTemplateType,
  resolveEngineType,
  instantTransactionEngine,
  timeExclusiveReservationEngine,
  sharedCapacityAccessEngine,
  ongoingEntitlementEngine,
} from './registry.js';

// Transaction Manager (saga-pattern atomicity)
export {
  TransactionManager,
  getTransactionManager,
  resetTransactionManager,
} from './transaction-manager.js';
export type {
  TransactionStep,
  TransactionResult,
  EngineOperationContext,
} from './transaction-manager.js';

// Idempotency Guard (duplicate prevention)
export {
  IdempotencyGuard,
  IdempotencyConflictError,
  getIdempotencyGuard,
  resetIdempotencyGuard,
} from './idempotency-guard.js';
export type { IdempotencyResult } from './idempotency-guard.js';

// Financial Ledger (unified financial record)
export {
  FinancialLedgerService,
  LedgerWriteError,
  LedgerInvariantError,
  getFinancialLedgerService,
  resetFinancialLedgerService,
} from './financial-ledger.js';
export type {
  LedgerEntry,
  LedgerBalance,
  LedgerQuery,
  LedgerTransactionType,
} from './financial-ledger.js';

// Observability (structured logging + metrics + audit trail)
export {
  EngineObserver,
  EngineMetrics,
  getEngineObserver,
  getEngineMetrics,
  resetEngineObserver,
} from './observability.js';
export type { EngineEvent, EngineEventType } from './observability.js';

// Feature Flags (rollout control)
export {
  FeatureFlagService,
  getFeatureFlagService,
  resetFeatureFlagService,
} from './feature-flags.js';
export type { EngineFeatureFlag } from './feature-flags.js';
