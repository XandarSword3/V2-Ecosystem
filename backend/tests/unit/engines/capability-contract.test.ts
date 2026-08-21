/**
 * Capability contract + layered state separation (plan Phase 2/3).
 *
 * Proves:
 *   - every engine declares its capabilities (declarative, not ad-hoc);
 *   - Engine A's core state machine is the GENERIC transaction layer
 *     (pending/confirmed/completed/cancelled) — no hospitality states in it;
 *   - the fulfillment layer is adapter-shaped and separate;
 *   - engine-service validates against BOTH layers, bridging the legacy
 *     composite statuses (preparing/ready/delivered) until Stage 6;
 *   - the generic core carries no vertical vocabulary (menu/kitchen/table…).
 */
import { describe, it, expect } from 'vitest';
import { getAllEngines, getEngineByTemplate } from '../../../src/engines/registry.js';
import { EngineService } from '../../../src/engines/engine-service.js';
import {
  CANONICAL_TO_LEGACY_FULFILLMENT,
  LEGACY_TO_CANONICAL_FULFILLMENT,
  canonicalizeFulfillmentState,
  legacyFulfillmentState,
  instantTransactionFulfillmentStateMachine,
} from '../../../src/engines/fulfillment-states.js';

const FORBIDDEN_CORE_VOCABULARY = ['restaurant', 'kitchen', 'menu', 'table', 'snack', 'chalet', 'room service', 'waiter', 'burger', 'recipe'];

describe('Capability contract (plan Phase 2)', () => {
  it('every registered engine declares capabilities', () => {
    for (const engine of getAllEngines()) {
      expect(engine.capabilities, `${engine.type} must declare capabilities`).toBeDefined();
      expect(engine.capabilities.transactionModel.states.length).toBeGreaterThan(0);
      expect(engine.capabilities.economics.currencyRequired).toBe(true);
    }
  });

  it('the generic Engine A core carries no vertical vocabulary', () => {
    const engine = getEngineByTemplate('instant_transaction');
    const text = `${engine.name} ${engine.description}`.toLowerCase();
    for (const word of FORBIDDEN_CORE_VOCABULARY) {
      expect(text, `core must not mention '${word}'`).not.toContain(word);
    }
  });

  it('Engine A declares a hospitality fulfillment layer with canonical states', () => {
    const engine = getEngineByTemplate('instant_transaction');
    const states = engine.capabilities.fulfillment.stateMachine!.states;
    expect(states).toContain('queued');
    expect(states).toContain('in_progress');
    expect(states).toContain('ready');
    expect(states).toContain('handed_off');
    expect(engine.capabilities.fulfillment.handoff).toBe(true);
    expect(engine.capabilities.execution.notificationTrigger).toBe('on_confirm');
    expect(engine.capabilities.commitment.type).toBe('inventory');
  });
});

describe('Layered state separation (plan Phase 3)', () => {
  it('the transaction machine is generic — no fulfillment states inside', () => {
    const engine = getEngineByTemplate('instant_transaction');
    expect(engine.stateMachine.states).toEqual(['pending', 'confirmed', 'completed', 'cancelled']);
    expect(engine.stateMachine.states).not.toContain('preparing');
    expect(engine.stateMachine.states).not.toContain('delivered');
    expect(engine.stateMachine.states).not.toContain('in_progress');
  });

  it('the bridge maps legacy composites to canonical fulfillment states and back', () => {
    expect(canonicalizeFulfillmentState('preparing')).toBe('in_progress');
    expect(canonicalizeFulfillmentState('delivered')).toBe('handed_off');
    expect(canonicalizeFulfillmentState('ready')).toBe('ready');
    expect(canonicalizeFulfillmentState('confirmed')).toBe('confirmed');
    expect(legacyFulfillmentState('in_progress')).toBe('preparing');
    expect(legacyFulfillmentState('handed_off')).toBe('delivered');
    expect(legacyFulfillmentState('queued')).toBe('preparing');
    expect(legacyFulfillmentState('completed')).toBe('completed');
    expect(LEGACY_TO_CANONICAL_FULFILLMENT.delivered).toBe('handed_off');
    expect(CANONICAL_TO_LEGACY_FULFILLMENT.handed_off).toBe('delivered');
  });

  it('the fulfillment machine validates its own canonical lifecycle', () => {
    expect(instantTransactionFulfillmentStateMachine.initialState).toBe('queued');
    expect(instantTransactionFulfillmentStateMachine.terminalStates).toEqual(['completed', 'cancelled']);
  });
});

describe('EngineService — layered transitions', () => {
  const service = new EngineService();

  it('transaction-layer moves work unchanged (pending → confirmed)', async () => {
    const r = await service.transitionState('instant_transaction', 'pending', 'confirm', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('confirmed');
  });

  it('fulfillment-layer moves work and bridge to legacy composites', async () => {
    let r = await service.transitionState('instant_transaction', 'confirmed', 'start_preparation', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('preparing'); // legacy bridge

    r = await service.transitionState('instant_transaction', 'preparing', 'mark_ready', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('ready');

    r = await service.transitionState('instant_transaction', 'ready', 'deliver', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('delivered');

    r = await service.transitionState('instant_transaction', 'delivered', 'complete', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('completed');
  });

  it('takeaway shortcut: ready → completed', async () => {
    const r = await service.transitionState('instant_transaction', 'ready', 'complete', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('completed');
  });

  it('cancellation respects the layers (admin-only from preparation)', async () => {
    const staff = await service.transitionState('instant_transaction', 'preparing', 'cancel', 'staff');
    expect(staff.allowed).toBe(false);
    const admin = await service.transitionState('instant_transaction', 'preparing', 'cancel', 'admin');
    expect(admin.allowed).toBe(true);
    expect(admin.targetState).toBe('cancelled');
  });

  it('legacy template names resolve through the same layered machine', async () => {
    const r = await service.transitionState('menu_service', 'confirmed', 'start_preparation', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('preparing');
  });

  it('getAvailableActions merges both layers from any current state', () => {
    const fromConfirmed = service.getAvailableActions('instant_transaction', 'confirmed', 'staff');
    const actions = fromConfirmed.map(a => a.action);
    expect(actions).toContain('complete');
    expect(actions).toContain('cancel');
    expect(actions).toContain('start_preparation');
    expect(actions).toContain('mark_ready');

    const fromPreparing = service.getAvailableActions('instant_transaction', 'preparing', 'staff');
    expect(fromPreparing.map(a => a.action)).toContain('mark_ready');
    expect(fromPreparing.map(a => a.action)).not.toContain('cancel'); // admin-only
  });
});
