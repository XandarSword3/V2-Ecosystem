/**
 * Capability contract + layered state separation (plan Phase 2/3) — ADVERSARIAL.
 *
 * Proves the corrected boundary, enforced by runtime code and the compiler:
 *   1. required fulfillment gates transaction completion (no premature
 *      confirmed → completed, even if the machine naively declares it);
 *   2. fulfillment handoff drives transaction completion correctly;
 *   3. cancellation from fulfillment states fires the transaction-layer
 *      compensation EXACTLY ONCE;
 *   4. a non-hospitality fulfillment adapter plugs into the generic contract
 *      without modifying the core;
 *   5. the generic core carries no vertical vocabulary (mechanics scanned);
 *   6. impossible commitment configurations fail COMPILATION (discriminated
 *      union) — proven with @ts-expect-error;
 *   7. invalid fulfillment mode/destination combinations are rejected;
 *   8. the legacy status bridge is adapter-declared and transitional.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getAllEngines,
  getEngine,
  getEngineByTemplate,
  type EngineRegistry,
} from '../../../src/engines/registry.js';
import { EngineService } from '../../../src/engines/engine-service.js';
import { LayeredStateMachine } from '../../../src/engines/layered-state.js';
import {
  COMPLETION_STATE,
  LEGAL_FULFILLMENT_COMBINATIONS,
  assertTransactionCompletionAllowed,
  assertValidFulfillmentCapabilities,
  assertValidFulfillmentSelection,
  resolveFulfillmentMachine,
  FulfillmentContractError,
} from '../../../src/engines/fulfillment-contract.js';
import { StateMachine } from '../../../src/engines/state-machine.js';
import {
  hospitalityFulfillmentStateMachine,
  HOSPITALITY_FULFILLMENT_STATES,
  type HospitalityFulfillmentMachineStatus,
} from '../../../src/adapters/hospitality/fulfillment.js';
import type { DigitalFulfillmentMachineStatus } from '../../../src/adapters/digital/fulfillment.js';
import type {
  CommitmentModel,
  EngineDefinition,
  FulfillmentDefinition,
  StateMachineDefinition,
  TransactionState,
} from '../../../src/engines/types.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Machine-STATE vocabulary that must live only in adapters. Mode/destination
// TYPE values (digital_delivery, digital_account) are generic contract values
// — they belong in the core's legal-combination registry — so they are NOT
// forbidden here; only the adapter's lifecycle states are.
const FORBIDDEN_CORE_VOCABULARY = [
  'restaurant', 'kitchen', 'menu', 'table', 'snack', 'chalet', 'waiter',
  'burger', 'recipe', 'preparation', 'takeaway', 'counter', 'delivered',
  'provisioning', 'provisioned',
];

// ============================================================
// Mock DB for the exactly-once compensation test
// ============================================================

const rpcMock = vi.fn();
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => ({ rpc: rpcMock }),
}));

// ============================================================
// 1. Capability declarations
// ============================================================

describe('Capability contract (plan Phase 2)', () => {
  it('every registered engine declares capabilities', () => {
    for (const engine of getAllEngines()) {
      expect(engine.capabilities, `${engine.type} must declare capabilities`).toBeDefined();
      expect(engine.capabilities.transactionModel.states.length).toBeGreaterThan(0);
      expect(engine.capabilities.economics.currencyRequired).toBe(true);
    }
  });

  it('Engine A declares the fulfillment layer via explicit options + per-mode machine bindings', () => {
    const engine = getEngineByTemplate('instant_transaction');
    const f = engine.capabilities.fulfillment;
    expect(f.required).toBe(true);
    expect(f.handoff).toBe(true);
    // Explicit mode → destination combinations (no flat lists) — digital
    // delivery is a MODE of Engine A, not a sixth engine.
    expect(f.options).toEqual([
      { mode: 'on_premise', destinations: ['on_premise_location', 'room'] },
      { mode: 'pickup', destinations: ['pickup_location'] },
      { mode: 'local_delivery', destinations: ['address'] },
      { mode: 'digital_delivery', destinations: ['digital_account'] },
    ]);
    // Per-mode machine routing: hospitality modes → hospitality machine,
    // digital_delivery → the digital adapter's machine.
    expect(f.modeMachines!.length).toBe(2);
    const hospitality = f.modeMachines!.find(b => b.modes.includes('on_premise'))!;
    expect(hospitality.machine.states).toContain('queued');
    const digital = f.modeMachines!.find(b => b.modes.includes('digital_delivery'))!;
    expect(digital.machine.states).toContain('provisioning');
    expect(engine.capabilities.execution.notificationTrigger).toBe('on_confirm');
    expect(engine.capabilities.commitment.type).toBe('inventory');
  });

  it('the transaction machine is generic — no fulfillment states, no direct completion', () => {
    const engine = getEngineByTemplate('instant_transaction');
    expect(engine.stateMachine.states).toEqual(['pending', 'confirmed', 'completed', 'cancelled']);
    const hasDirectCompletion = engine.stateMachine.transitions.some(
      t => t.from === 'confirmed' && t.to === 'completed',
    );
    expect(hasDirectCompletion).toBe(false);
  });

  it('the generic description carries no vertical vocabulary', () => {
    const engine = getEngineByTemplate('instant_transaction');
    const text = `${engine.name} ${engine.description}`.toLowerCase();
    for (const word of FORBIDDEN_CORE_VOCABULARY) {
      expect(text, `core must not mention '${word}'`).not.toContain(word);
    }
  });
});

// ============================================================
// 2. Completion gating (requirement 1) — runtime enforcement
// ============================================================

describe('Completion gate — capability-driven enforcement', () => {
  // A "naive" engine that WRONGLY declares confirmed → completed on its
  // transaction machine while also requiring fulfillment. The gate must
  // reject it even though the machine allows it.
  const naiveTxMachine: StateMachineDefinition = {
    states: ['pending', 'confirmed', 'completed', 'cancelled'],
    initialState: 'pending',
    terminalStates: ['completed', 'cancelled'],
    transitions: [
      { from: 'pending', to: 'confirmed', action: 'confirm', allowedActors: ['staff', 'system'] },
      { from: 'confirmed', to: 'completed', action: 'complete', allowedActors: ['staff', 'system'] },
      { from: 'pending', to: 'cancelled', action: 'cancel', allowedActors: ['customer', 'staff', 'admin'] },
      { from: 'confirmed', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'] },
    ],
  };
  const digitalMachine: StateMachineDefinition = {
    states: ['confirmed', 'provisioning', 'provisioned', 'delivered', 'accessed', 'completed', 'cancelled'],
    initialState: 'provisioning',
    terminalStates: ['completed', 'cancelled'],
    transitions: [
      { from: 'confirmed', to: 'provisioning', action: 'provision', allowedActors: ['system'] },
      { from: 'provisioning', to: 'provisioned', action: 'finish_provisioning', allowedActors: ['system'] },
      { from: 'provisioned', to: 'delivered', action: 'deliver_digital', allowedActors: ['system'] },
      { from: 'delivered', to: 'completed', action: 'complete', allowedActors: ['system'] },
      { from: 'delivered', to: 'accessed', action: 'open', allowedActors: ['customer'] },
      { from: 'provisioning', to: 'cancelled', action: 'cancel', allowedActors: ['admin'] },
    ],
  };
  const digitalFulfillment: FulfillmentDefinition = {
    required: true,
    options: [{ mode: 'digital_delivery', destinations: ['digital_account'] }],
    groups: false,
    tracking: false,
    handoff: false,
    modeMachines: [{ modes: ['digital_delivery'], machine: digitalMachine }],
  };

  it('blocks transaction-layer completion when fulfillment is required — even if the machine declares it', () => {
    const layered = new LayeredStateMachine(
      new StateMachine(naiveTxMachine),
      [new StateMachine(digitalMachine)],
      digitalFulfillment,
    );
    const check = layered.canTransition('confirmed', 'complete', 'staff');
    expect(check.allowed).toBe(false);
    expect(check.error).toMatch(/fulfillment/i);
    // The pure gate agrees.
    expect(assertTransactionCompletionAllowed(digitalFulfillment, COMPLETION_STATE)).toMatch(/fulfillment/i);
    expect(assertTransactionCompletionAllowed(digitalFulfillment, 'cancelled')).toBeNull(); // cancellation unaffected
  });

  it('allows direct completion when fulfillment is NOT required', () => {
    const noFulfillment: FulfillmentDefinition = {
      required: false,
      options: [],
      groups: false,
      tracking: false,
      handoff: false,
    };
    const layered = new LayeredStateMachine(new StateMachine(naiveTxMachine), [], noFulfillment);
    expect(layered.canTransition('confirmed', 'complete', 'staff').allowed).toBe(true);
    expect(assertTransactionCompletionAllowed(noFulfillment, COMPLETION_STATE)).toBeNull();
  });

  it('Engine A (hospitality) rejects confirmed → completed through the real service', async () => {
    const service = new EngineService();
    const r = await service.transitionState('instant_transaction', 'confirmed', 'complete', 'staff');
    expect(r.allowed).toBe(false);
    expect(r.error).toMatch(/complete/i);
    // 'complete' is not even offered to staff from 'confirmed'.
    const actions = service.getAvailableActions('instant_transaction', 'confirmed', 'staff');
    expect(actions.map(a => a.action)).not.toContain('complete');
  });
});

// ============================================================
// 3. Handoff drives transaction completion (requirement 1/8)
// ============================================================

describe('Fulfillment handoff drives transaction completion', () => {
  it('the full hospitality journey completes only through the fulfillment layer', async () => {
    const service = new EngineService();
    let r = await service.transitionState('instant_transaction', 'pending', 'confirm', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('confirmed');
    expect(r.layer).toBe('transaction');

    r = await service.transitionState('instant_transaction', 'confirmed', 'start_preparation', 'staff');
    expect(r.allowed).toBe(true);
    // Stage 6: target IS the canonical state — no legacy composite.
    expect(r.targetState).toBe('in_progress');
    expect(r.canonicalState).toBe('in_progress');
    expect(r.layer).toBe('fulfillment');

    r = await service.transitionState('instant_transaction', 'in_progress', 'mark_ready', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.canonicalState).toBe('ready');

    r = await service.transitionState('instant_transaction', 'ready', 'deliver', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.canonicalState).toBe('handed_off');

    // Only now may the transaction complete.
    r = await service.transitionState('instant_transaction', 'handed_off', 'complete', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('completed');
    expect(r.canonicalState).toBe('completed');
  });
});

// ============================================================
// 4. Exactly-once compensation (requirement 8)
// ============================================================

describe('Cancellation compensation — exactly once', () => {
  beforeEach(() => rpcMock.mockReset());

  it('cancel from a fulfillment state fires the transaction-layer restore exactly once', async () => {
    rpcMock.mockResolvedValue({ data: [{ success: true, items_restored: 3 }], error: null });
    const service = new EngineService();

    const r = await service.transitionState('instant_transaction', 'in_progress', 'cancel', 'admin', {
      orderId: 'order-1',
      userId: 'user-1',
    });
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('cancelled');
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('restore_inventory_for_order', expect.objectContaining({
      p_transaction_id: 'order-1',
    }));
  });

  it('cancel from the transaction layer (confirmed) also compensates exactly once', async () => {
    rpcMock.mockResolvedValue({ data: [{ success: true, items_restored: 0 }], error: null });
    const service = new EngineService();
    const r = await service.transitionState('instant_transaction', 'confirmed', 'cancel', 'staff', {
      orderId: 'order-2',
    });
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('cancelled');
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it('a REJECTED cancel never fires compensation', async () => {
    const service = new EngineService();
    const r = await service.transitionState('instant_transaction', 'in_progress', 'cancel', 'staff', {
      orderId: 'order-3',
    });
    expect(r.allowed).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

// ============================================================
// 5. Non-hospitality adapter plug-in (requirement 8)
// ============================================================

describe('A non-hospitality fulfillment adapter rides on Engine A as a MODE', () => {
  // The digital delivery ADAPTER (adapters/digital/fulfillment.ts) plugs into
  // the generic contract — but through ENGINE A's capability contract, as
  // one more fulfillment mode. No sixth engine exists: digital_delivery is a
  // mode/destination option of instant_transaction with its own machine
  // binding. The registry is untouched by the adapter.
  const engine = getEngine('instant_transaction');
  const digitalFulfillment = engine.capabilities.fulfillment;
  const digitalMachine = resolveFulfillmentMachine(digitalFulfillment, 'digital_delivery')!;

  it('runs a complete digital-delivery lifecycle through Engine A\'s layered validator', async () => {
    const layered = new LayeredStateMachine(
      new StateMachine(engine.stateMachine),
      digitalFulfillment.modeMachines!.map(b => new StateMachine(b.machine)),
      digitalFulfillment,
    );

    expect(layered.canTransition('pending', 'confirm', 'system').allowed).toBe(true);
    // Provisioning happens without touching the transaction layer.
    expect(layered.canTransition('confirmed', 'provision', 'system').allowed).toBe(true);
    expect(layered.canTransition('provisioning', 'finish_provisioning', 'system').allowed).toBe(true);
    expect(layered.canTransition('provisioned', 'deliver_digital', 'system').allowed).toBe(true);
    // Completion only after digital delivery.
    expect(layered.canTransition('delivered', 'complete', 'system').allowed).toBe(true);
    // …and never before it.
    expect(layered.canTransition('confirmed', 'complete', 'system').allowed).toBe(false);
  });

  it('digital delivery is a MODE of Engine A — not a sixth engine type', () => {
    // Compile-time: the registry preserves Engine A's fulfillment-status
    // generic — the UNION of its bound adapters' machines (hospitality +
    // digital), never a widened string.
    const engineTyped: EngineDefinition<
      TransactionState,
      HospitalityFulfillmentMachineStatus | DigitalFulfillmentMachineStatus
    > = engine;
    expect(engineTyped.type).toBe('instant_transaction');
    // The option exists on Engine A's capability contract…
    expect(engineTyped.capabilities.fulfillment.options).toContainEqual({
      mode: 'digital_delivery',
      destinations: ['digital_account'],
    });
    // …routed to the digital adapter's machine by the binding.
    expect(digitalMachine.states).toContain('provisioning');
    expect(digitalMachine.states).toContain('delivered');
    expect(digitalMachine.states).not.toContain('queued');
    // And the engine registry holds exactly the canonical FIVE engines —
    // digital_delivery is a mode, never an engine key.
    expect(getAllEngines().map(e => e.type)).not.toContain('digital_delivery');
  });
});

// ============================================================
// 6. Generic core vocabulary guard (requirement 8)
// ============================================================

describe('Generic core vocabulary guard', () => {
  it('the generic mechanics contain no vertical vocabulary', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const enginesDir = join(here, '..', '..', '..', 'src', 'engines');
    const files = [
      'fulfillment-contract.ts',
      'layered-state.ts',
      'state-machine.ts',
      'engine-service.ts',
      // Plan Phase 5: the generic resource layer is scanned too — the
      // hospitality BOM (menu_item_ingredients / recipe) must live only in
      // adapters/hospitality/resources.ts.
      'resource-contract.ts',
    ];
    const pattern = new RegExp(`\\b(${FORBIDDEN_CORE_VOCABULARY.join('|')})\\b`, 'i');
    for (const file of files) {
      const content = readFileSync(join(enginesDir, file), 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        expect(pattern.test(lines[i]), `${file}:${i + 1} introduces vertical vocabulary: "${lines[i].trim()}"`).toBe(false);
      }
    }
  });

  it('the hospitality fulfillment vocabulary lives only in the adapter namespace', () => {
    expect(HOSPITALITY_FULFILLMENT_STATES).toEqual(['queued', 'in_progress', 'ready', 'handed_off']);
    expect(hospitalityFulfillmentStateMachine.states).toContain('handed_off');
  });
});

// ============================================================
// 7. Impossible configurations fail compilation (requirement 4/8)
// ============================================================

describe('Impossible configurations are rejected', () => {
  it('a "none" commitment cannot declare a commitmentTrigger (discriminated union)', () => {
    // @ts-expect-error — type: 'none' cannot carry commitmentTrigger
    const impossible: CommitmentModel = { type: 'none', commitmentTrigger: 'on_purchase' };
    expect(impossible).toBeDefined();
  });

  it('a committed model cannot omit the trigger', () => {
    // @ts-expect-error — type: 'inventory' requires commitmentTrigger
    const incomplete: CommitmentModel = { type: 'inventory', reservation: true, reversalOnCancel: true };
    expect(incomplete).toBeDefined();
  });

  it('invalid mode/destination combinations are rejected at registration validation', () => {
    expect(() =>
      assertValidFulfillmentCapabilities({
        required: true,
        options: [{ mode: 'pickup', destinations: ['address'] }], // pickup cannot serve an address
        groups: false,
        tracking: false,
        handoff: true,
      }),
    ).toThrow(FulfillmentContractError);

    // required without a state machine → the transaction could never complete.
    expect(() =>
      assertValidFulfillmentCapabilities({
        required: true,
        options: [{ mode: 'pickup', destinations: ['pickup_location'] }],
        groups: false,
        tracking: false,
        handoff: true,
      }),
    ).toThrow(FulfillmentContractError);

    // Unknown mode.
    expect(() =>
      assertValidFulfillmentCapabilities({
        required: false,
        options: [{ mode: 'teleport' as never, destinations: ['none'] }],
        groups: false,
        tracking: false,
        handoff: false,
      }),
    ).toThrow(FulfillmentContractError);
  });

  it('the legal registry covers every future mode the plan names', () => {
    for (const mode of ['pickup', 'on_premise', 'local_delivery', 'shipment', 'digital_delivery', 'service_execution']) {
      expect(LEGAL_FULFILLMENT_COMBINATIONS[mode as keyof typeof LEGAL_FULFILLMENT_COMBINATIONS].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 9. Registry preserves the fulfillment generic (fix #1)
// ============================================================

describe('Registry preserves TFulfillmentStatus (no string erasure)', () => {
  it('getEngine("instant_transaction") preserves the union of its bound fulfillment machines', () => {
    // Compile-time proof: assigning the machine to the engine's fulfillment
    // union (hospitality | digital) only compiles if the registry kept the
    // generic. If it had been erased to string, this assignment would fail
    // typecheck.
    const machine: StateMachineDefinition<
      HospitalityFulfillmentMachineStatus | DigitalFulfillmentMachineStatus
    > | undefined = resolveFulfillmentMachine(
      getEngine('instant_transaction').capabilities.fulfillment,
      'on_premise',
    );
    expect(machine).toBeDefined();
    // The hospitality machine carries the canonical lifecycle states.
    for (const s of HOSPITALITY_FULFILLMENT_STATES) {
      expect(machine!.states).toContain(s);
    }
  });

  it('getEngineByTemplate("menu_service") preserves the same generic through the alias', () => {
    const machine: StateMachineDefinition<
      HospitalityFulfillmentMachineStatus | DigitalFulfillmentMachineStatus
    > | undefined = resolveFulfillmentMachine(
      getEngineByTemplate('menu_service').capabilities.fulfillment,
      'local_delivery',
    );
    expect(machine).toBeDefined();
    expect(machine!.states).toContain('handed_off');
  });

  it('getEngine returns exactly the registry record type — not a widened definition', () => {
    // If the registry erased generics, this exact-type check would fail.
    const typed: EngineRegistry['instant_transaction'] = getEngine('instant_transaction');
    expect(typed.type).toBe('instant_transaction');
    expect(typed.capabilities.fulfillment.modeMachines!.length).toBe(2);
    expect(resolveFulfillmentMachine(typed.capabilities.fulfillment, 'digital_delivery')).toBeDefined();
  });

  it('a string-erased fulfillment machine cannot satisfy the registry type (compile-time)', () => {
    // @ts-expect-error — StateMachineDefinition<string> is NOT assignable to
    // StateMachineDefinition<HospitalityFulfillmentMachineStatus |
    // DigitalFulfillmentMachineStatus>; only the preserved generic satisfies
    // the registry slot.
    const erased: EngineRegistry['instant_transaction'] = {
      type: 'instant_transaction',
      name: 'x',
      description: 'x',
      commercialEntity: 'x',
      stateMachine: { states: ['pending'], initialState: 'pending', terminalStates: [], transitions: [] },
      pricing: { applyTax: false, applyFees: false, supportsCoupons: false, supportsGiftCards: false, supportsLoyaltyRedemption: false, earnsLoyaltyPoints: false, deductsInventory: false, rounding: 'round', decimalPlaces: 2 },
      interactions: [],
      capabilities: {
        transactionModel: { supportsDraft: false, autoComplete: true, states: ['pending'] },
        commitment: { type: 'none' },
        fulfillment: {
          required: true,
          options: [],
          groups: false,
          tracking: false,
          handoff: true,
          modeMachines: [{ modes: ['digital_delivery'], machine: { states: ['string-state'], initialState: 'string-state', terminalStates: [], transitions: [] } }],
        },
        execution: { enabled: true, workCenters: true, operators: true, states: [], notificationTrigger: 'on_confirm' },
        economics: { multiTender: false, refunds: false, voids: false, ledger: true, loyalty: 'none', coupons: false, giftCards: false, pos: false, currencyRequired: true },
        customer: { guests: true, accounts: false, staffAssisted: true, reviews: true, serviceRecovery: true },
        fiscal: { documents: [], eInvoicing: false, controlledNumbering: false },
        returns: { refund: 'none', physicalReturn: false, exchange: false, replacement: false, cancellation: true },
      },
    };
  });

  it('the registry record type is exactly the canonical FIVE registered engines', () => {
    // Runtime proof the interface keys match the registered engines — and
    // that digital_delivery is NOT among them (it is a fulfillment mode of
    // Engine A, not an engine).
    const record: Record<string, unknown> = {};
    for (const engine of getAllEngines()) {
      record[engine.type] = engine;
    }
    expect(Object.keys(record).sort()).toEqual([
      'instant_transaction',
      'ongoing_entitlement',
      'platform_entitlement',
      'shared_capacity_access',
      'time_exclusive_reservation',
    ]);
  });
});

// ============================================================
// 10. Completion gate applies to getAvailableActions (fix #2)
// ============================================================

describe('Completion gate applies to available actions', () => {
  // A "naive" transaction machine that WRONGLY declares confirmed → completed
  // while fulfillment is required. The gate must hide completion from the
  // offered actions even though the machine declares it.
  const naiveTxMachine: StateMachineDefinition = {
    states: ['pending', 'confirmed', 'completed', 'cancelled'],
    initialState: 'pending',
    terminalStates: ['completed', 'cancelled'],
    transitions: [
      { from: 'pending', to: 'confirmed', action: 'confirm', allowedActors: ['staff', 'system'] },
      { from: 'confirmed', to: 'completed', action: 'complete', allowedActors: ['staff', 'system'] },
      { from: 'pending', to: 'cancelled', action: 'cancel', allowedActors: ['customer', 'staff', 'admin'] },
      { from: 'confirmed', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'] },
    ],
  };
  const fulfillmentMachine: StateMachineDefinition = {
    states: ['confirmed', 'provisioning', 'provisioned', 'completed', 'cancelled'],
    initialState: 'provisioning',
    terminalStates: ['completed', 'cancelled'],
    transitions: [
      { from: 'confirmed', to: 'provisioning', action: 'provision', allowedActors: ['system'] },
      { from: 'provisioning', to: 'provisioned', action: 'finish_provisioning', allowedActors: ['system'] },
      { from: 'provisioned', to: 'completed', action: 'complete', allowedActors: ['system'] },
      { from: 'provisioning', to: 'cancelled', action: 'cancel', allowedActors: ['admin'] },
    ],
  };
  const requiredFulfillment: FulfillmentDefinition = {
    required: true,
    options: [{ mode: 'digital_delivery', destinations: ['digital_account'] }],
    groups: false,
    tracking: false,
    handoff: false,
    modeMachines: [{ modes: ['digital_delivery'], machine: fulfillmentMachine }],
  };

  it('never OFFERS transaction-layer completion when fulfillment is required', () => {
    const layered = new LayeredStateMachine(
      new StateMachine(naiveTxMachine),
      [new StateMachine(fulfillmentMachine)],
      requiredFulfillment,
    );
    const actions = layered.getAvailableActions('confirmed', 'staff');
    expect(actions.map(a => a.action)).not.toContain('complete');
    // …but the fulfillment layer's own completion IS offered from its handoff state.
    const fmActions = layered.getAvailableActions('provisioned', 'system');
    expect(fmActions.map(a => a.action)).toContain('complete');
  });

  it('offers transaction-layer completion when fulfillment is NOT required', () => {
    const noFulfillment: FulfillmentDefinition = {
      required: false,
      options: [],
      groups: false,
      tracking: false,
      handoff: false,
    };
    const layered = new LayeredStateMachine(
      new StateMachine(naiveTxMachine),
      [],
      noFulfillment,
    );
    const actions = layered.getAvailableActions('confirmed', 'staff');
    expect(actions.map(a => a.action)).toContain('complete');
  });

  it('the real Engine A does not offer completion from confirmed', () => {
    const service = new EngineService();
    const actions = service.getAvailableActions('instant_transaction', 'confirmed', 'staff');
    expect(actions.map(a => a.action)).not.toContain('complete');
  });
});

// ============================================================
// 11. Explicit auto-handoff policy (fix #3)
// ============================================================

describe('Explicit auto-handoff policy replaces the implicit shortcut', () => {
  it('the hospitality machine has NO ready → completed transition', () => {
    const shortcut = hospitalityFulfillmentStateMachine.transitions.find(
      t => t.from === 'ready' && t.to === 'completed',
    );
    expect(shortcut).toBeUndefined();
  });

  it('completion from ready works through the layered validator via the policy', async () => {
    const service = new EngineService();
    const r = await service.transitionState('instant_transaction', 'ready', 'complete', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('completed');
    expect(r.layer).toBe('fulfillment');
  });

  it('the policy is actor-gated (customer cannot auto-complete)', async () => {
    const service = new EngineService();
    const r = await service.transitionState('instant_transaction', 'ready', 'complete', 'customer');
    expect(r.allowed).toBe(false);
  });

  it('completion from ready is offered in available actions', () => {
    const service = new EngineService();
    const actions = service.getAvailableActions('instant_transaction', 'ready', 'staff');
    expect(actions.map(a => a.action)).toContain('complete');
  });

  it('an impossible auto-handoff declaration fails registration validation', () => {
    expect(() =>
      assertValidFulfillmentCapabilities({
        required: true,
        options: [{ mode: 'pickup', destinations: ['pickup_location'] }],
        groups: false,
        tracking: false,
        handoff: true,
        // state: 'ready' is not in the machine's states below
        modeMachines: [{
          modes: ['pickup'],
          autoHandoff: { atState: 'ready', allowedActors: ['staff'] },
          machine: {
            states: ['queued', 'in_progress', 'handed_off', 'completed', 'cancelled'],
            initialState: 'queued',
            terminalStates: ['completed', 'cancelled'],
            transitions: [{ from: 'handed_off', to: 'completed', action: 'complete', allowedActors: ['staff'] }],
          },
        }],
      }),
    ).toThrow(FulfillmentContractError);

    // auto-handoff with no completion transition to derive the action from
    expect(() =>
      assertValidFulfillmentCapabilities({
        required: true,
        options: [{ mode: 'pickup', destinations: ['pickup_location'] }],
        groups: false,
        tracking: false,
        handoff: true,
        modeMachines: [{
          modes: ['pickup'],
          autoHandoff: { atState: 'ready', allowedActors: ['staff'] },
          machine: {
            states: ['queued', 'ready', 'handed_off', 'cancelled'],
            initialState: 'queued',
            terminalStates: ['cancelled'],
            transitions: [{ from: 'ready', to: 'handed_off', action: 'deliver', allowedActors: ['staff'] }],
          },
        }],
      }),
    ).toThrow(FulfillmentContractError);
  });

  it('a mode claimed by two machine bindings is ambiguous — rejected', () => {
    expect(() =>
      assertValidFulfillmentCapabilities({
        required: true,
        options: [{ mode: 'pickup', destinations: ['pickup_location'] }],
        groups: false,
        tracking: false,
        handoff: true,
        modeMachines: [
          { modes: ['pickup'], machine: hospitalityFulfillmentStateMachine },
          { modes: ['pickup'], machine: hospitalityFulfillmentStateMachine },
        ],
      }),
    ).toThrow(/ambiguous/);
  });

  it('a required mode with no machine binding is rejected (could never complete)', () => {
    expect(() =>
      assertValidFulfillmentCapabilities({
        required: true,
        options: [{ mode: 'pickup', destinations: ['pickup_location'] }],
        groups: false,
        tracking: false,
        handoff: true,
        // no modeMachines at all
      }),
    ).toThrow(/no fulfillment machine binding/);
  });
});

// ============================================================
// 8. Stage 6 — no legacy bridge exists anywhere
// ============================================================

describe('Stage 6: the legacy fulfillment bridge is gone', () => {
  it('the engine definition declares no legacyStatusBridge', () => {
    const engine = getEngine('instant_transaction');
    expect(engine.capabilities.fulfillment.legacyStatusBridge).toBeUndefined();
  });

  it('the generic layered validator is bridge-free (no bridgeIn/bridgeOut)', () => {
    // The validator's public surface exposes only canonical state — no
    // legacy composite is ever produced or consumed. (Compile-time proof:
    // the type has no legacy field; runtime proof: transitionState returns
    // canonical targetState directly.)
    const service = new EngineService();
    const r = service.canTransition('instant_transaction', 'in_progress', 'mark_ready', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('ready'); // canonical, not a legacy composite
  });

  it('generic engines without fulfillment are unaffected (B–E pass through)', () => {
    const service = new EngineService();
    // Engine B: booking lifecycle is entirely on the transaction machine.
    const r = service.canTransition('multi_day_booking', 'confirmed', 'check_in', 'staff');
    expect(r.allowed).toBe(true);
    expect(r.targetState).toBe('checked_in');
  });
});

// ============================================================
// 9. Stage 6 fix — typed mode/destination selection validation
// ============================================================

describe('Fulfillment selection validation (Stage 6 fix)', () => {
  const engine = getEngine('instant_transaction');

  it('accepts every declared mode/destination pair (declaration is the authority)', () => {
    for (const option of engine.capabilities.fulfillment.options) {
      for (const destination of option.destinations) {
        expect(() =>
          assertValidFulfillmentSelection(engine.capabilities.fulfillment, option.mode, destination)
        ).not.toThrow();
      }
    }
  });

  it('rejects a mode the engine does not offer (even if globally registered)', () => {
    // 'shipment' is in the global LEGAL_FULFILLMENT_COMBINATIONS registry but
    // instant_transaction does not declare it — the engine's options win.
    expect(() =>
      assertValidFulfillmentSelection(engine.capabilities.fulfillment, 'shipment', null)
    ).toThrow(/not offered by this engine/);
  });

  it('rejects a destination illegal for the selected mode on this engine', () => {
    // 'address' is legal for local_delivery but not for on_premise.
    expect(() =>
      assertValidFulfillmentSelection(engine.capabilities.fulfillment, 'on_premise', 'address')
    ).toThrow(/not valid for mode 'on_premise'/);
  });

  it('REJECTS a null mode — selection is mandatory before confirmation', () => {
    // The invariant: NULL mode never means "not decided yet". A selection
    // without a mode is a contract violation.
    expect(() =>
      assertValidFulfillmentSelection(engine.capabilities.fulfillment, null, null)
    ).toThrow(/mode is mandatory/);
    expect(() =>
      assertValidFulfillmentSelection(engine.capabilities.fulfillment, null, 'address')
    ).toThrow(/mode is mandatory/);
  });

  it('the empty options case rejects every mode', () => {
    const noOptions = { ...engine.capabilities.fulfillment, options: [] };
    expect(() => assertValidFulfillmentSelection(noOptions, 'pickup', null)).toThrow(/not offered/);
    expect(() => assertValidFulfillmentSelection(noOptions, null, null)).toThrow(/mode is mandatory/);
  });
});
