/**
 * Generic resource-consumption system (plan Phase 5) — ADVERSARIAL.
 *
 * Proves the generic resource/consumption boundary:
 *   1. the engine registry declares resource models and impossible
 *      configurations fail STARTUP (consumption on a handoff that never
 *      happens, kinds without timing, undeclared kinds rejected);
 *   2. the hospitality adapter resolves the BOM (order items → recipe
 *      ingredients) into typed generic requirements — with its vocabulary
 *      INSIDE the adapter, never the generic core;
 *   3. ResourceConsumptionService validates resolved requirements against the
 *      engine's declared model (fail-closed) before any write;
 *   4. allocate / consume / release persist through RPCs and the service
 *      NEVER writes fulfillment meaning to transactions.status;
 *   5. a non-hospitality resource resolver (capacity) plugs into the SAME
 *      generic service without modifying it;
 *   6. the generic resource layer carries no vertical vocabulary.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  assertValidResourceConsumption,
  assertValidResourceRequirements,
  ResourceContractError,
} from '../../../src/engines/resource-contract.js';
import { getAllEngines, getEngine } from '../../../src/engines/registry.js';
import {
  ResourceConsumptionService,
  isFulfillmentStartMove,
} from '../../../src/modules/resource/resource-consumption.service.js';
import { hospitalityResourceResolver } from '../../../src/adapters/hospitality/resources.js';
import type { FulfillmentDefinition, ResourceRequirement } from '../../../src/engines/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. Capability declarations
// ============================================================

describe('Generic resource consumption contract (plan Phase 5)', () => {
  it('every registered engine declares a resource model', () => {
    for (const engine of getAllEngines()) {
      expect(engine.capabilities.resources, `engine ${engine.type} declares resources`).toBeDefined();
    }
  });

  it('Engine A consumes inventory via the hospitality BOM; non-commerce engines consume nothing', () => {
    const instant = getEngine('instant_transaction');
    expect(instant.capabilities.resources.type).toBe('inventory');
    expect(instant.capabilities.resources.kinds).toContain('inventory_item');
    // Consumption is tied to fulfillment handoff — and the engine HAS a
    // required fulfillment layer with machines (validated at startup).
    expect(instant.capabilities.resources.consumption).toBe('on_fulfillment_handoff');
    expect(instant.capabilities.resources.reversalOnCancel).toBe(true);

    // Digital delivery is a fulfillment MODE of Engine A, not an engine —
    // the non-consuming reference engine is platform_entitlement.
    const platform = getEngine('platform_entitlement');
    expect(platform.capabilities.resources.type).toBe('none');
  });

  it('MODE-AWARE: digital delivery overrides to no consumption; hospitality modes use the engine default', () => {
    const instant = getEngine('instant_transaction');
    const fulfillment = instant.capabilities.fulfillment;
    const digital = fulfillment.modeMachines!.find(b => b.modes.includes('digital_delivery'))!;
    const hospitality = fulfillment.modeMachines!.find(b => b.modes.includes('on_premise'))!;
    // The digital binding overrides the engine-wide inventory model to 'none' —
    // the engine-wide setting would be too restrictive for a mode with no
    // handoff step and no physical inventory.
    expect(digital.resources).toEqual({ type: 'none' });
    // Hospitality modes declare no override → the engine-level model is the
    // default, resolved per (engine, mode) by the service.
    expect(hospitality.resources).toBeUndefined();
  });

  it('capacity engines consume capacity slots', () => {
    const timeExclusive = getEngine('time_exclusive_reservation');
    expect(timeExclusive.capabilities.resources.type).toBe('capacity');
    expect(timeExclusive.capabilities.resources.kinds).toEqual(['capacity_slot']);
  });

  it('rejects consumption on a handoff the engine never performs (impossible config)', () => {
    const noFulfillment: FulfillmentDefinition = {
      required: false,
      options: [],
      groups: false,
      tracking: false,
    };
    expect(() =>
      assertValidResourceConsumption(
        {
          type: 'inventory',
          kinds: ['inventory_item'],
          allocation: 'on_purchase',
          consumption: 'on_fulfillment_handoff',
          reversalOnCancel: true,
        },
        noFulfillment,
      ),
    ).toThrow(ResourceContractError);

    // ...but consumption on purchase is fine without a fulfillment layer.
    expect(() =>
      assertValidResourceConsumption(
        {
          type: 'inventory',
          kinds: ['inventory_item'],
          allocation: 'on_purchase',
          consumption: 'on_purchase',
          reversalOnCancel: true,
        },
        noFulfillment,
      ),
    ).not.toThrow();
  });

  it('on_fulfillment_start allocation is legal ONLY with a fulfillment machine (declaration side)', () => {
    // The declaration is validated at registration — it must be able to
    // determine when fulfillment starts.
    const noFulfillment: FulfillmentDefinition = {
      required: false,
      options: [],
      groups: false,
      tracking: false,
    };
    expect(() =>
      assertValidResourceConsumption(
        {
          type: 'inventory',
          kinds: ['inventory_item'],
          allocation: 'on_fulfillment_start',
          consumption: 'on_fulfillment_handoff',
          reversalOnCancel: true,
        },
        noFulfillment,
      ),
    ).toThrow(ResourceContractError);

    // ...and valid when the engine has a fulfillment machine to derive the
    // start state from.
    const withMachine: FulfillmentDefinition = {
      required: true,
      options: [{ mode: 'on_premise', destinations: ['on_premise_location'] }],
      modeMachines: [
        {
          modes: ['on_premise'],
          handoff: true,
          machine: {
            states: ['queued', 'in_progress', 'ready', 'handed_off', 'completed'],
            initialState: 'queued',
            terminalStates: ['completed'],
            transitions: [
              { from: 'queued', to: 'in_progress', action: 'start_preparation' },
              { from: 'in_progress', to: 'ready', action: 'mark_ready' },
              { from: 'ready', to: 'handed_off', action: 'deliver' },
              { from: 'handed_off', to: 'completed', action: 'complete' },
            ],
          },
        },
      ],
      groups: false,
      tracking: false,
    };
    expect(() =>
      assertValidResourceConsumption(
        {
          type: 'inventory',
          kinds: ['inventory_item'],
          allocation: 'on_fulfillment_start',
          consumption: 'on_fulfillment_handoff',
          reversalOnCancel: true,
        },
        withMachine,
      ),
    ).not.toThrow();
  });

  it('MODE-AWARE: a mode binding cannot consume on a handoff its mode never performs', () => {
    // Digital-style binding: handoff: false (no handoff step) yet the override
    // claims handoff-time consumption — impossible, rejected at registration.
    expect(() =>
      assertValidResourceConsumption(
        { type: 'inventory', kinds: ['inventory_item'], allocation: 'on_purchase', consumption: 'on_fulfillment_handoff', reversalOnCancel: true },
        {
          required: true,
          options: [{ mode: 'digital_delivery', destinations: ['digital_account'] }],
          groups: false,
          tracking: false,
          modeMachines: [{
            modes: ['digital_delivery'],
            handoff: false,
            resources: { type: 'inventory', kinds: ['inventory_item'], allocation: 'on_purchase', consumption: 'on_fulfillment_handoff', reversalOnCancel: true },
            machine: { states: ['provisioning', 'delivered', 'completed'], initialState: 'provisioning', terminalStates: ['completed'], transitions: [] },
          }],
        },
      ),
    ).toThrow(/no handoff step/);

    // ...while a handoff: true binding (hospitality-style) CAN consume at handoff.
    expect(() =>
      assertValidResourceConsumption(
        { type: 'inventory', kinds: ['inventory_item'], allocation: 'on_purchase', consumption: 'on_fulfillment_handoff', reversalOnCancel: true },
        {
          required: true,
          options: [{ mode: 'pickup', destinations: ['pickup_location'] }],
          groups: false,
          tracking: false,
          modeMachines: [{
            modes: ['pickup'],
            handoff: true,
            resources: { type: 'inventory', kinds: ['inventory_item'], allocation: 'on_purchase', consumption: 'on_fulfillment_handoff', reversalOnCancel: true },
            machine: { states: ['queued', 'handed_off', 'completed'], initialState: 'queued', terminalStates: ['completed'], transitions: [] },
          }],
        },
      ),
    ).not.toThrow();
  });

  it('a consuming model must declare kinds; a non-consuming model cannot', () => {
    expect(() =>
      assertValidResourceConsumption(
        { type: 'inventory', kinds: [], allocation: 'on_purchase', consumption: 'on_purchase', reversalOnCancel: true },
        { required: false, options: [], groups: false, tracking: false },
      ),
    ).toThrow(ResourceContractError);
  });

  it('rejects a requirement whose kind the engine does not declare (fail closed)', () => {
    const instant = getEngine('instant_transaction');
    expect(() =>
      assertValidResourceRequirements(instant.capabilities.resources, [
        { kind: 'capacity_slot', ref: 'slot-1', quantity: 1 },
      ]),
    ).toThrow(/not declared/);

    // Declared kind + positive quantity passes.
    expect(() =>
      assertValidResourceRequirements(instant.capabilities.resources, [
        { kind: 'inventory_item', ref: 'item-1', quantity: 2 },
      ]),
    ).not.toThrow();

    // Zero/negative quantity is rejected.
    expect(() =>
      assertValidResourceRequirements(instant.capabilities.resources, [
        { kind: 'inventory_item', ref: 'item-1', quantity: 0 },
      ]),
    ).toThrow(/positive/);
  });

  it('requirements for a non-consuming engine are a contract violation', () => {
    const platform = getEngine('platform_entitlement');
    expect(() =>
      assertValidResourceRequirements(platform.capabilities.resources, [
        { kind: 'inventory_item', ref: 'item-1', quantity: 1 },
      ]),
    ).toThrow(/no resource consumption/);
  });
});

// ============================================================
// 2. Hospitality BOM resolver (adapter owns the vocabulary)
// ============================================================

describe('Hospitality resource adapter (BOM resolution)', () => {
  function bomMock() {
    const calls: Array<{ table: string; eq: [string, unknown] }> = [];
    const supabase: any = {
      calls,
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, val: unknown) => {
            calls.push({ table, eq: [col, val] });
            if (table === 'order_items') {
              return Promise.resolve({
                data: [
                  { id: 'oi1', quantity: 2, catalog_item_id: 'cat-1' },
                  { id: 'oi2', quantity: 1, catalog_item_id: 'cat-2' },
                ],
                error: null,
              });
            }
            if (table === 'menu_item_ingredients') {
              // cat-1 → 2 ingredients; cat-2 → 1 ingredient.
              if (val === 'cat-1') {
                return Promise.resolve({
                  data: [
                    { inventory_item_id: 'inv-1', quantity_required: 0.5, unit: 'kg' },
                    { inventory_item_id: 'inv-2', quantity_required: 2, unit: 'piece' },
                  ],
                  error: null,
                });
              }
              return Promise.resolve({
                data: [{ inventory_item_id: 'inv-3', quantity_required: 1, unit: 'piece' }],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          },
        }),
      }),
    };
    return supabase;
  }

  it('resolves order items → recipe ingredients → typed inventory requirements', async () => {
    const supabase = bomMock();
    const requirements = await hospitalityResourceResolver.resolveRequirements(supabase, 't1');
    expect(requirements).toEqual([
      { kind: 'inventory_item', ref: 'inv-1', quantity: 1, unit: 'kg' }, // 0.5 × 2
      { kind: 'inventory_item', ref: 'inv-2', quantity: 4, unit: 'piece' }, // 2 × 2
      { kind: 'inventory_item', ref: 'inv-3', quantity: 1, unit: 'piece' }, // 1 × 1
    ]);
  });

  it('returns [] for an order with no items', async () => {
    const supabase: any = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    };
    const requirements = await hospitalityResourceResolver.resolveRequirements(supabase, 't1');
    expect(requirements).toEqual([]);
  });

  it('FAILS CLOSED on a read error — never silently returns []', async () => {
    const supabase: any = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: { message: 'connection reset (simulated)' } }),
        }),
      }),
    };
    await expect(hospitalityResourceResolver.resolveRequirements(supabase, 't1')).rejects.toThrow(/connection reset/);
  });
});

// ============================================================
// 3. Generic service — validation + persistence
// ============================================================

describe('ResourceConsumptionService (generic)', () => {
  interface RpcCall { name: string; args: Record<string, unknown> }

  function createSupabaseMock() {
    const rpc: RpcCall[] = [];
    const supabase: any = {
      rpcCalls: rpc,
      from: () => ({
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpc.push({ name, args });
        if (name === 'allocate_resources') return { data: [{ success: true, allocated: 2 }], error: null };
        if (name === 'consume_resources') return { data: [{ success: true, consumed: 2 }], error: null };
        if (name === 'release_resources') return { data: [{ success: true, released: 2 }], error: null };
        return { data: [{ success: false, error_message: `unknown rpc ${name}` }], error: null };
      },
    };
    return supabase;
  }

  it('validate() rejects an undeclared kind before any RPC', () => {
    const service = new ResourceConsumptionService();
    expect(() =>
      service.validate('instant_transaction', [{ kind: 'staff_time', ref: 'staff-1', quantity: 1 }]),
    ).toThrow(/not declared/);
  });

  it('allocate() validates then persists via RPC', async () => {
    const service = new ResourceConsumptionService();
    const supabase = createSupabaseMock();
    const requirements: ResourceRequirement[] = [
      { kind: 'inventory_item', ref: 'inv-1', quantity: 2 },
    ];
    const result = await service.allocate(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      requirements,
    });
    expect(result.ok).toBe(true);
    expect(result.allocated).toBe(2);
    const call = supabase.rpcCalls.find(c => c.name === 'allocate_resources');
    expect(call).toBeDefined();
    expect(call!.args.p_transaction_id).toBe('t1');
    expect(call!.args.p_engine_type).toBe('instant_transaction');
    expect(call!.args.p_requirements).toEqual(requirements);
  });

  it('allocate() fails closed on an undeclared kind — RPC never called', async () => {
    const service = new ResourceConsumptionService();
    const supabase = createSupabaseMock();
    const result = await service.allocate(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      requirements: [{ kind: 'capacity_slot', ref: 'slot-1', quantity: 1 }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not declared/);
    expect(supabase.rpcCalls.some(c => c.name === 'allocate_resources')).toBe(false);
  });

  it('consume() and release() persist through the engine validator + RPC', async () => {
    const service = new ResourceConsumptionService();
    const supabase = createSupabaseMock();

    const consume = await service.consume(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      action: 'deliver',
      actor: 'staff',
      currentState: 'ready',
    });
    expect(consume.ok).toBe(true);
    expect(consume.consumed).toBe(2);
    expect(supabase.rpcCalls.some(c => c.name === 'consume_resources')).toBe(true);

    const release = await service.release(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      action: 'cancel',
      actor: 'staff',
      currentState: 'queued',
    });
    expect(release.ok).toBe(true);
    expect(release.released).toBe(2);
    expect(supabase.rpcCalls.some(c => c.name === 'release_resources')).toBe(true);
  });

  it('MODE-AWARE: validate() resolves the model per (engine, mode)', () => {
    const service = new ResourceConsumptionService();
    const req: ResourceRequirement[] = [{ kind: 'inventory_item', ref: 'inv-1', quantity: 1 }];
    // Hospitality mode → engine default (inventory) accepts.
    expect(() => service.validate('instant_transaction', req, 'on_premise')).not.toThrow();
    // Mode-less → engine default accepts.
    expect(() => service.validate('instant_transaction', req)).not.toThrow();
    // Digital mode → its binding overrides to 'none': the SAME requirements
    // are now a contract violation (the engine-wide setting must never force
    // a mode into resource behavior it cannot satisfy).
    expect(() => service.validate('instant_transaction', req, 'digital_delivery')).toThrow(/no resource consumption/);
  });

  it('MODE-AWARE: allocate() for a digital-delivery mode fails closed — RPC never called', async () => {
    const service = new ResourceConsumptionService();
    const supabase = createSupabaseMock();
    const result = await service.allocate(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'digital_delivery',
      requirements: [{ kind: 'inventory_item', ref: 'inv-1', quantity: 1 }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no resource consumption/);
    expect(supabase.rpcCalls.some(c => c.name === 'allocate_resources')).toBe(false);
  });

  it('MODE-AWARE: consume() validates mode-scoped — a digital row cannot consume with a hospitality action', async () => {
    const service = new ResourceConsumptionService();
    const supabase = createSupabaseMock();
    // Digital row at 'provisioning'; 'start_preparation' is a hospitality
    // action — the digital binding (mode-scoped transition validation)
    // rejects it before any consume RPC.
    const result = await service.consume(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'digital_delivery',
      action: 'start_preparation',
      actor: 'staff',
      currentState: 'provisioning',
    });
    expect(result.ok).toBe(false);
    expect(supabase.rpcCalls.some(c => c.name === 'consume_resources')).toBe(false);
  });

  it('MODE-AWARE: resolveForTransaction validates against the mode model', async () => {
    const service = new ResourceConsumptionService({
      async resolveRequirements() {
        return [{ kind: 'inventory_item', ref: 'inv-1', quantity: 1 }];
      },
    });
    const supabase = createSupabaseMock();
    // Digital mode: the same resolved requirements are rejected (model 'none').
    await expect(
      service.resolveForTransaction(supabase, 't1', 'instant_transaction', 'digital_delivery'),
    ).rejects.toThrow(/no resource consumption/);
    // Hospitality mode: accepted against the engine default.
    const ok = await service.resolveForTransaction(supabase, 't1', 'instant_transaction', 'on_premise');
    expect(ok).toEqual([{ kind: 'inventory_item', ref: 'inv-1', quantity: 1 }]);
  });

  // ── Lifecycle driver (plan Phase 5 — wired at the order-status choke point) ──

  function lifecycleMock() {
    const rpc: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase: any = {
      rpcCalls: rpc,
      from: (table: string) => ({
        select: () => ({
          eq: async () => {
            if (table === 'order_items') {
              return { data: [{ id: 'oi1', quantity: 1, catalog_item_id: 'cat-1' }], error: null };
            }
            if (table === 'menu_item_ingredients') {
              return { data: [{ inventory_item_id: 'inv-1', quantity_required: 1, unit: 'piece' }], error: null };
            }
            return { data: [], error: null };
          },
        }),
      }),
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpc.push({ name, args });
        if (name === 'allocate_resources') return { data: [{ success: true, allocated: 1 }], error: null };
        if (name === 'consume_resources') return { data: [{ success: true, consumed: 1 }], error: null };
        if (name === 'release_resources') return { data: [{ success: true, released: 1 }], error: null };
        return { data: [{ success: false, error_message: `unknown rpc ${name}` }], error: null };
      },
    };
    return supabase;
  }

  it('LIFECYCLE: confirm allocates, handoff consumes, complete does NOT consume twice', async () => {
    const service = new ResourceConsumptionService(hospitalityResourceResolver);
    const supabase = lifecycleMock();

    // Economic confirmation → allocate (layer transaction, target confirmed).
    const confirm = await service.handleLifecycleMove(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'on_premise',
      action: 'confirm',
      actor: 'system',
      currentState: 'pending',
      targetState: 'confirmed',
      layer: 'transaction',
      propertyId: 'p1',
      tenantId: 't1',
      context: { orderId: 't1' },
    });
    expect(confirm).toMatchObject({ ok: true, op: 'allocated' });

    // Fulfillment handoff (deliver → handed_off) → consume.
    const deliver = await service.handleLifecycleMove(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'on_premise',
      action: 'deliver',
      actor: 'staff',
      currentState: 'ready',
      targetState: 'handed_off',
      layer: 'fulfillment',
      propertyId: 'p1',
      tenantId: 't1',
    });
    expect(deliver).toMatchObject({ ok: true, op: 'consumed' });

    // Completion LEAVES the handoff-reaching state — consumption must NOT
    // fire again (exactly-once at the service boundary; the idempotent RPC
    // is the DB backstop).
    const complete = await service.handleLifecycleMove(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'on_premise',
      action: 'complete',
      actor: 'staff',
      currentState: 'handed_off',
      targetState: 'completed',
      layer: 'fulfillment',
      propertyId: 'p1',
      tenantId: 't1',
    });
    expect(complete).toMatchObject({ ok: true, op: 'none' });

    const names = supabase.rpcCalls.map((c: any) => c.name);
    expect(names).toEqual(['allocate_resources', 'consume_resources']);
  });

  it('LIFECYCLE: cancellation releases allocations exactly once (compensation)', async () => {
    const service = new ResourceConsumptionService(hospitalityResourceResolver);
    const supabase = lifecycleMock();

    const cancel = await service.handleLifecycleMove(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'pickup',
      action: 'cancel',
      actor: 'admin',
      currentState: 'confirmed',
      targetState: 'cancelled',
      layer: 'transaction',
      propertyId: 'p1',
      tenantId: 't1',
    });
    expect(cancel).toMatchObject({ ok: true, op: 'released' });
    expect(supabase.rpcCalls.map((c: any) => c.name)).toEqual(['release_resources']);
  });

  it('FULFILLMENT-START: the start move is the first move that leaves the machine initial state (pure decision)', () => {
    // Hospitality machine: initialState 'queued'. "Fulfillment start" is
    // queued → in_progress — exactly once, never again, never a transaction
    // move, never without a machine to derive the start state from.
    expect(isFulfillmentStartMove('queued', 'queued', 'in_progress')).toBe(true);
    expect(isFulfillmentStartMove('queued', 'in_progress', 'ready')).toBe(false);
    expect(isFulfillmentStartMove('queued', 'ready', 'handed_off')).toBe(false);
    expect(isFulfillmentStartMove('queued', 'queued', 'queued')).toBe(false);
    // No machine (no initial state) → never a start move.
    expect(isFulfillmentStartMove(undefined, 'queued', 'in_progress')).toBe(false);
  });

  it('the lifecycle driver implements EVERY allocation trigger the contract declares (no declared-capability gaps)', () => {
    // Regression guard for the Phase 5 closure: the resource model declares
    // three legal allocation triggers — on_purchase, on_confirm,
    // on_fulfillment_start — and the driver must implement all three. This
    // catches the gap where on_fulfillment_start was legal and validated at
    // registration but no runtime path ever allocated.
    const src = readFileSync(join(__dirname, '../../../src/modules/resource/resource-consumption.service.ts'), 'utf8');
    expect(src).toMatch(/model\.allocation === 'on_fulfillment_start'/);
    expect(src).toMatch(/isFulfillmentStartMove\(/);
    expect(src).toMatch(/model\.allocation === 'on_purchase' \|\| model\.allocation === 'on_confirm'/);
    // The declaration side validates on_fulfillment_start requires a
    // fulfillment machine (the start state must be derivable).
    const contract = readFileSync(join(__dirname, '../../../src/engines/resource-contract.ts'), 'utf8');
    expect(contract).toMatch(/on_fulfillment_start/);
    expect(contract).toMatch(/fulfillment machine OR an execution model/);
  });

  it('LIFECYCLE: a digital-delivery mode drives no resource RPCs at all (model none)', async () => {
    const service = new ResourceConsumptionService(hospitalityResourceResolver);
    const supabase = lifecycleMock();

    const result = await service.handleLifecycleMove(supabase, {
      transactionId: 't1',
      engineType: 'instant_transaction',
      mode: 'digital_delivery',
      action: 'confirm',
      actor: 'system',
      currentState: 'pending',
      targetState: 'confirmed',
      layer: 'transaction',
      propertyId: 'p1',
      tenantId: 't1',
    });
    expect(result).toEqual({ ok: true, op: 'none' });
    expect(supabase.rpcCalls.length).toBe(0);
  });
});

// ============================================================
// 4. Non-hospitality resolver plugs into the SAME generic service
// ============================================================

describe('A non-hospitality resource resolver plugs into the generic service', () => {
  it('a capacity resolver feeds the same service without modifying it', async () => {
    const capacityResolver = {
      async resolveRequirements(): Promise<ResourceRequirement[]> {
        return [{ kind: 'capacity_slot', ref: 'pool-session-42', quantity: 1, unit: 'guest' }];
      },
    };
    const service = new ResourceConsumptionService(capacityResolver);
    const supabase: any = {
      from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
      rpc: async (name: string) => ({ data: [{ success: true, allocated: 1 }], error: null }),
    };

    // The capacity requirement resolves against the CAPACITY engine's model
    // (time_exclusive_reservation declares kind capacity_slot).
    const requirements = await service.resolveForTransaction(supabase, 't1', 'time_exclusive_reservation');
    expect(requirements).toEqual([{ kind: 'capacity_slot', ref: 'pool-session-42', quantity: 1, unit: 'guest' }]);

    const result = await service.allocate(supabase, {
      transactionId: 't1',
      engineType: 'time_exclusive_reservation',
      requirements,
    });
    expect(result.ok).toBe(true);
  });

  it('the same capacity requirement is REJECTED for an inventory engine', async () => {
    const service = new ResourceConsumptionService();
    expect(() =>
      service.validate('instant_transaction', [{ kind: 'capacity_slot', ref: 's', quantity: 1 }]),
    ).toThrow(/not declared/);
  });
});

// ============================================================
// 5. Boundary: hospitality BOM vocabulary lives only in the adapter
// ============================================================

describe('Resource boundary (plan Phase 5)', () => {
  it('the hospitality BOM vocabulary lives only in the adapter, never the generic core', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(here, '..', '..', '..', 'src');
    // The generic resource layer must not name hospitality tables.
    const generic = [
      join(srcDir, 'engines', 'resource-contract.ts'),
      join(srcDir, 'modules', 'resource', 'resource-consumption.service.ts'),
    ];
    for (const file of generic) {
      const content = readFileSync(file, 'utf8');
      expect(content, `${file} must not mention the hospitality BOM table`).not.toMatch(/menu_item_ingredients/);
      expect(content, `${file} must not mention recipes`).not.toMatch(/\brecipe\b/);
      expect(content, `${file} must not mention order_items`).not.toMatch(/order_items/);
    }
    // The adapter OWNS that vocabulary.
    const adapter = readFileSync(join(srcDir, 'adapters', 'hospitality', 'resources.ts'), 'utf8');
    expect(adapter).toMatch(/menu_item_ingredients/);
  });

  it('the latest resource migration records events only for rows actually transitioned', () => {
    const migrationsDir = join(__dirname, '../../../../supabase/migrations');
    // Latest definition is the law (20260821210000 supersedes the Phase-5
    // bodies): event inserts are driven by a PRE-update snapshot of the rows
    // this call actually transitions.
    const latest = readFileSync(join(migrationsDir, '20260821210000_engine_a_resource_events_idempotent.sql'), 'utf8');
    const consumeFn = latest.split('CREATE OR REPLACE FUNCTION "public"."consume_resources"')[1]
      ?.split('CREATE OR REPLACE FUNCTION "public"."release_resources"')[0] ?? '';
    const releaseFn = latest.split('CREATE OR REPLACE FUNCTION "public"."release_resources"')[1] ?? '';
    expect(consumeFn).toMatch(/FROM _consumed_rows/);
    expect(releaseFn).toMatch(/FROM _released_rows/);
    // The Phase-5 bug — re-selecting by the FINAL status after the UPDATE
    // (duplicated events on repeat calls, and release recording the new
    // status as from_status) — must be gone from the latest bodies. The old
    // event inserts re-selected rows with a single-line WHERE on the final
    // status; the new snapshots select only the pre-update rows.
    expect(consumeFn).not.toMatch(/FROM resource_allocations\s*WHERE transaction_id = p_transaction_id AND engine_type = p_engine_type AND status = 'consumed'/);
    expect(releaseFn).not.toMatch(/FROM resource_allocations\s*WHERE transaction_id = p_transaction_id AND engine_type = p_engine_type AND status = 'released'/);
    // release records the TRUE pre-release status.
    expect(releaseFn).toMatch(/SELECT id, from_status, 'released'/);
  });
});
