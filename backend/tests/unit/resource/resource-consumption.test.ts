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
import { ResourceConsumptionService } from '../../../src/modules/resource/resource-consumption.service.js';
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
      handoff: false,
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

  it('a consuming model must declare kinds; a non-consuming model cannot', () => {
    expect(() =>
      assertValidResourceConsumption(
        { type: 'inventory', kinds: [], allocation: 'on_purchase', consumption: 'on_purchase', reversalOnCancel: true },
        { required: false, options: [], groups: false, tracking: false, handoff: false },
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
});
