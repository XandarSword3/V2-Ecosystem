/**
 * Engine A production scenario proof (plan Phase 5).
 *
 * Drives the REAL production services — changeInstantTransactionOrderStatus
 * (the single status-change choke point), FulfillmentService, and the
 * mode-aware ResourceConsumptionService with the hospitality BOM resolver —
 * through the canonical customer journey:
 *
 *   POST /orders (creation, with the ONE stock authority) → payment →
 *   confirmation (with PRE-FLIGHT resource allocation) → fulfillment
 *   selection (snapshotted at creation, honored by the trigger) →
 *   fulfillment → resource consumption at handoff → completion.
 *
 * The DB is a faithful simulation of the production Supabase boundary: the
 * confirm UPDATE fires the ensure_fulfillment_on_confirm trigger (creates
 * the fulfillment row with the snapshotted mode + the mode's initial
 * status), and the resource RPCs behave like the real functions. All
 * business logic under test is the real code — only the database is faked.
 *
 * Two invariants are proven, not documented:
 *
 *   1. ONE inventory mutation authority. Stock is deducted exactly once,
 *      at order creation (deduct_inventory_for_order_items, via
 *      deduct_stock_fifo); confirmation performs NO stock deduction — the
 *      legacy confirm-time side effect is unregistered.
 *   2. No confirmed-without-resources window. Resource allocation is
 *      PRE-FLIGHT: it completes before the confirm write, and a failure
 *      aborts confirmation — the customer is never told "confirmed" while
 *      mandatory resources are unavailable.
 *
 * The real-DB counterpart (tests/integration/engine-a-order-lifecycle
 * .integration.test.ts) runs the same journey over HTTP against a live
 * Supabase when RUN_INTEGRATION_TESTS=true.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Order-status's external sinks — the real service logic runs; only the
// socket emits, the fiscal call, and discount reversal are stubbed.
vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
  emitToOrder: vi.fn(),
}));
vi.mock('../../../src/engines/discount-reversal.js', () => ({
  reverseDiscounts: vi.fn(async () => undefined),
}));
vi.mock('../../../src/modules/fiscal/fiscal-document.service.js', () => ({
  fiscalDocumentService: { issueForTransaction: vi.fn(async () => ({ ok: true })) },
}));

import { changeInstantTransactionOrderStatus } from '../../../src/engines/order-status.service.js';
import { hospitalityResourceResolver } from '../../../src/adapters/hospitality/resources.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Faithful DB simulation ────────────────────────────────────────────────

interface DbOp {
  op: 'read' | 'update' | 'insert' | 'rpc' | 'trigger';
  detail: string;
}

/** Initial fulfillment status per (engine_type, mode) — mirrors the
 * engine_fulfillment_capabilities seed (hospitality 'queued', digital
 * 'provisioning'). */
const INITIAL_STATUS_BY_MODE: Record<string, string> = {
  on_premise: 'queued',
  pickup: 'queued',
  local_delivery: 'queued',
  digital_delivery: 'provisioning',
};

const ORDER_ITEMS = [
  { id: 'oi1', quantity: 2, catalog_item_id: 'cat-1' },
  { id: 'oi2', quantity: 1, catalog_item_id: 'cat-2' },
];

const INGREDIENTS: Record<string, Array<{ inventory_item_id: string; quantity_required: number; unit: string }>> = {
  'cat-1': [
    { inventory_item_id: 'inv-1', quantity_required: 0.5, unit: 'kg' },
    { inventory_item_id: 'inv-2', quantity_required: 2, unit: 'piece' },
  ],
  'cat-2': [{ inventory_item_id: 'inv-3', quantity_required: 1, unit: 'piece' }],
};

function createOrderDb(overrides: {
  mode?: string;
  allocateResult?: { success: boolean; allocated?: number; error_message?: string };
  updateError?: boolean;
} = {}) {
  const mode = overrides.mode ?? 'on_premise';
  const ops: DbOp[] = [];
  const state = {
    transaction: {
      id: 't1',
      status: 'pending',
      customer_id: 'cust-1',
      module_id: 'm1',
      tenant_id: 'ten-1',
      property_id: 'prop-1',
      metadata: {
        order_type: 'dine_in',
        order_number: 'ORD-ABC12',
        payment_method: 'card',
        // The fulfillment selection is snapshotted at creation (POST
        // /orders) — the trigger copies it verbatim into the fulfillment
        // row; the confirm pre-flight reads it for the resource mode.
        fulfillment_mode: mode,
        fulfillment_destination_type: 'on_premise_location',
        fulfillment_destination_ref: 'T-1',
      },
    },
    fulfillment: null as null | Record<string, unknown>,
  };

  const isConfirmUpdate = (obj: Record<string, unknown>) => obj.status === 'confirmed';

  const supabase: any = {
    ops,
    rpc: async (name: string, _args: Record<string, unknown>) => {
      ops.push({ op: 'rpc', detail: name });
      switch (name) {
        case 'allocate_resources': {
          const res = overrides.allocateResult ?? { success: true, allocated: 3 };
          return { data: [res], error: null };
        }
        case 'consume_resources':
          return { data: [{ success: true, consumed: 3 }], error: null };
        case 'release_resources':
          return { data: [{ success: true, released: 3 }], error: null };
        case 'transition_fulfillment': {
          const to = _args.p_to_status as string;
          state.fulfillment = { ...(state.fulfillment as Record<string, unknown>), status: to, updated_at: new Date().toISOString() };
          return { data: [{ success: true, status: to }], error: null };
        }
        case 'deduct_inventory_for_order_items':
          // THE stock authority — fires at creation (POST /orders), never
          // at confirmation. Simulated as a no-op; its atomicity is the
          // real RPC's job.
          return { data: [{ success: true, ingredients_deducted: 3 }], error: null };
        default:
          return { data: [{ success: false, error_message: `unknown rpc ${name}` }], error: null };
      }
    },
    from: (table: string) => {
      const builder: any = {
        conditions: [] as Array<[string, unknown]>,
        cols: '',
        updateObj: null as Record<string, unknown> | null,
        select: (cols: string) => {
          builder.cols = cols;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          builder.conditions.push([col, val]);
          return builder;
        },
        // Real supabase-js builders are THENABLE — `.select().eq(...)` can
        // be awaited directly (the resolver does exactly that). Awaiting
        // the chain performs the read.
        then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve(performRead(table)).then(onFulfilled),
        maybeSingle: async () => {
          ops.push({ op: 'read', detail: table });
          return performRead(table);
        },
        single: async () => {
          ops.push({ op: 'read', detail: table });
          if (table === 'transactions' && builder.updateObj) {
            return applyUpdate();
          }
          return performRead(table);
        },
        update: (obj: Record<string, unknown>) => {
          builder.updateObj = obj;
          return builder;
        },
        insert: async (obj: unknown) => {
          ops.push({ op: 'insert', detail: table });
          void obj;
          return { data: null, error: null };
        },
      };

      function performRead(tableName: string): { data: unknown; error: null } {
        if (tableName === 'transactions') return { data: state.transaction, error: null };
        if (tableName === 'fulfillments') return { data: state.fulfillment, error: null };
        if (tableName === 'order_items') return { data: ORDER_ITEMS, error: null };
        if (tableName === 'menu_item_ingredients') {
          const cat = builder.conditions.find(([c]) => c === 'catalog_item_id');
          return { data: cat ? INGREDIENTS[String(cat[1])] ?? [] : [], error: null };
        }
        return { data: null, error: null };
      }

      function applyUpdate() {
        ops.push({ op: 'update', detail: table });
        if (overrides.updateError) {
          return { data: null, error: { message: 'confirm write failed (simulated)' } };
        }
        const obj = builder.updateObj as Record<string, unknown>;
        // Fulfillment moves merge timestamps/metadata without a status
        // change; only transaction-layer moves set status.
        if (obj.status !== undefined) {
          state.transaction = { ...state.transaction, status: obj.status };
        }
        if (obj.metadata !== undefined) {
          state.transaction = {
            ...state.transaction,
            metadata: { ...(state.transaction.metadata as Record<string, unknown>), ...(obj.metadata as Record<string, unknown>) },
          };
        }
        // ensure_fulfillment_on_confirm: the confirm UPDATE creates the
        // fulfillment row ATOMICALLY, copying the snapshotted selection and
        // the mode's declared initial status.
        if (isConfirmUpdate(obj)) {
          const meta = (state.transaction.metadata ?? {}) as Record<string, unknown>;
          state.fulfillment = {
            id: 'f-1',
            transaction_id: state.transaction.id,
            engine_type: 'instant_transaction',
            status: INITIAL_STATUS_BY_MODE[String(meta.fulfillment_mode)] ?? 'queued',
            mode: meta.fulfillment_mode ?? null,
            destination_type: meta.fulfillment_destination_type ?? null,
            destination_ref: meta.fulfillment_destination_ref ?? null,
            tracking_ref: null,
            queued_at: new Date().toISOString(),
            in_progress_at: null,
            ready_at: null,
            handed_off_at: null,
            completed_at: null,
            cancelled_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          ops.push({ op: 'trigger', detail: 'ensure_fulfillment_on_confirm' });
        }
        return { data: state.transaction, error: null };
      }

      return builder;
    },
  };
  return { supabase, state, ops };
}

function confirmParams(status: string) {
  return {
    orderId: 't1',
    moduleId: 'm1',
    moduleSlug: 'kitchen-1',
    moduleEngineTypeRaw: 'instant_transaction',
    requestedStatus: status,
    actor: 'staff' as const,
    userId: 'staff-1',
    tenantId: 'ten-1',
  };
}

// ============================================================
// 1. The canonical production scenario
// ============================================================

describe('Engine A production scenario (plan Phase 5 proof)', () => {
  it('creation → confirm → fulfill → consume → complete, with allocation BEFORE the confirm write', async () => {
    const { supabase, state, ops } = createOrderDb();

    // POST /orders already happened: the transaction exists as 'pending'
    // with the fulfillment selection snapshotted, and the ONE stock
    // authority (deduct_inventory_for_order_items) deducted at creation.
    // Payment recorded — payment_status only, no state-machine move.
    expect(state.transaction.status).toBe('pending');
    expect(state.transaction.metadata.fulfillment_mode).toBe('on_premise');

    // ── Confirmation ──────────────────────────────────────────────────────
    const confirm = await changeInstantTransactionOrderStatus(supabase, confirmParams('confirmed'));
    expect(confirm.ok).toBe(true);
    if (confirm.ok) expect(confirm.order.status).toBe('confirmed');

    // Allocation ran PRE-FLIGHT: the allocate RPC fired before the confirm
    // UPDATE (whose trigger creates the fulfillment row). The customer is
    // only told 'confirmed' after resources are reserved.
    const allocIdx = ops.findIndex((o) => o.op === 'rpc' && o.detail === 'allocate_resources');
    const updateIdx = ops.findIndex((o) => o.op === 'update' && o.detail === 'transactions');
    expect(allocIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThan(allocIdx);
    // The trigger created the fulfillment row with the SNAPSHOTTED mode and
    // the mode's declared initial status.
    expect(ops.some((o) => o.op === 'trigger')).toBe(true);
    expect(state.fulfillment).not.toBeNull();
    expect(state.fulfillment!.status).toBe('queued');
    expect(state.fulfillment!.mode).toBe('on_premise');
    // No stock RPC at confirmation — the creation-time authority is the
    // ONLY stock mutation.
    expect(ops.filter((o) => o.op === 'rpc' && o.detail === 'deduct_inventory_for_order_items')).toHaveLength(0);

    // ── Fulfillment: queued → in_progress → ready → handed_off ────────────
    for (const [requested, expectedFulfillment] of [
      ['in_progress', 'in_progress'],
      ['ready', 'ready'],
      ['served', 'handed_off'], // legacy alias → deliver
    ] as Array<[string, string]>) {
      const res = await changeInstantTransactionOrderStatus(supabase, confirmParams(requested));
      expect(res.ok).toBe(true);
      expect(state.fulfillment!.status).toBe(expectedFulfillment);
    }

    // Consumption fired exactly once — at handoff (ready → handed_off).
    const consumeCount = ops.filter((o) => o.op === 'rpc' && o.detail === 'consume_resources').length;
    expect(consumeCount).toBe(1);

    // ── Completion ────────────────────────────────────────────────────────
    const complete = await changeInstantTransactionOrderStatus(supabase, confirmParams('completed'));
    expect(complete.ok).toBe(true);
    expect(state.fulfillment!.status).toBe('completed');
    expect(state.transaction.status).toBe('completed');
    // The completion move LEAVES the handoff-reaching state — no second
    // consume (exactly-once at the service boundary).
    expect(ops.filter((o) => o.op === 'rpc' && o.detail === 'consume_resources')).toHaveLength(1);
  });

  it('NO WINDOW: if mandatory resource allocation fails, confirmation is refused — the order stays pending and no fulfillment row exists', async () => {
    const { supabase, state, ops } = createOrderDb({
      allocateResult: { success: false, error_message: 'insufficient resources (simulated)' },
    });

    const confirm = await changeInstantTransactionOrderStatus(supabase, confirmParams('confirmed'));

    expect(confirm.ok).toBe(false);
    if (!confirm.ok) expect(confirm.status).toBe(409);
    // The customer was NEVER told 'confirmed': the confirm UPDATE (and its
    // fulfillment trigger) never ran.
    expect(ops.some((o) => o.op === 'update' && o.detail === 'transactions')).toBe(false);
    expect(ops.some((o) => o.op === 'trigger')).toBe(false);
    expect(state.transaction.status).toBe('pending');
    expect(state.fulfillment).toBeNull();
  });

  it('NO WINDOW: an allocation read/validation failure also refuses confirmation (fail closed, internal error)', async () => {
    const { supabase, ops } = createOrderDb();
    // Break the BOM read so the resolver throws fail-closed.
    const originalRead = supabase.from;
    supabase.from = (table: string) => {
      const b = originalRead(table);
      if (table === 'order_items') {
        b.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve({ data: null, error: { message: 'connection reset (simulated)' } }).then(onFulfilled);
      }
      return b;
    };

    const confirm = await changeInstantTransactionOrderStatus(supabase, confirmParams('confirmed'));
    expect(confirm.ok).toBe(false);
    if (!confirm.ok) expect(confirm.status).toBe(500);
    expect(ops.some((o) => o.op === 'update' && o.detail === 'transactions')).toBe(false);
  });

  it('MODE-AWARE: a digital_delivery order confirms with NO allocation (model none) and the trigger seeds its own initial status', async () => {
    const { supabase, state, ops } = createOrderDb({ mode: 'digital_delivery' });

    const confirm = await changeInstantTransactionOrderStatus(supabase, confirmParams('confirmed'));
    expect(confirm.ok).toBe(true);
    // No mandatory resources → no allocate RPC at all.
    expect(ops.some((o) => o.op === 'rpc' && o.detail === 'allocate_resources')).toBe(false);
    expect(ops.some((o) => o.op === 'update' && o.detail === 'transactions')).toBe(true);
    // The trigger seeded the digital machine's OWN initial state.
    expect(state.fulfillment!.status).toBe('provisioning');
    expect(state.fulfillment!.mode).toBe('digital_delivery');
  });

  it('COMPENSATION: when the confirm write fails after a successful pre-flight allocation, the allocation is released', async () => {
    const { supabase, ops } = createOrderDb({ updateError: true });

    const confirm = await changeInstantTransactionOrderStatus(supabase, confirmParams('confirmed'));
    expect(confirm.ok).toBe(false);
    if (!confirm.ok) expect(confirm.status).toBe(500);
    // The pre-flight allocation happened, then the write failed, and the
    // compensation released the reserved rows so nothing lingers.
    expect(ops.some((o) => o.op === 'rpc' && o.detail === 'allocate_resources')).toBe(true);
    expect(ops.some((o) => o.op === 'rpc' && o.detail === 'release_resources')).toBe(true);
  });
});

// ============================================================
// 2. ONE inventory mutation authority (architecture)
// ============================================================

describe('Engine A inventory authority (plan Phase 5 proof)', () => {
  it('the engine registry registers NO confirm-time inventory deduction — creation is the only stock authority', () => {
    const registry = readFileSync(join(__dirname, '../../../src/engines/registry.ts'), 'utf8');
    // Restoration on cancellation is registered...
    expect(registry).toMatch(/addSideEffect\('cancel', restoreInventorySideEffect\)/);
    // ...but deduction is NOT registered on 'confirm' (or any action).
    expect(registry).not.toMatch(/addSideEffect\('confirm'/);
    expect(registry).not.toMatch(/addSideEffect\([^)]*deduct/);
  });

  it('POST /orders calls the single creation-time stock authority', () => {
    const router = readFileSync(join(__dirname, '../../../src/routes/dynamic-module.router.ts'), 'utf8');
    // The creation path calls deduct_inventory_for_order_items and rolls
    // the order back on INSUFFICIENT_STOCK — the one place stock is
    // deducted for an order.
    expect(router).toMatch(/rpc\('deduct_inventory_for_order_items'/);
    expect(router).toMatch(/INSUFFICIENT_STOCK/);
  });

  it('fulfillment-path code never calls a stock-deduction RPC (one stock authority)', () => {
    // Physical stock is mutated ONLY at creation: deduct_inventory_for_order_items
    // in POST /orders AND in the staff New-Order path (createModuleOrder),
    // both at creation time. Confirmation, fulfillment moves, and the KDS
    // item path perform allocate/consume/release on resource_allocations —
    // bookkeeping, never inventory_items.current_stock. This guard fails if
    // a deduct call is wired into either fulfillment-path surface.
    const DEDUCT_RPCS = /deduct_inventory_for_order_items|deduct_inventory_for_order|deduct_stock_fifo/;

    // The order-status choke point (confirm / fulfillment / cancel) must
    // never touch stock.
    const chokePoint = readFileSync(join(__dirname, '../../../src/engines/order-status.service.ts'), 'utf8');
    expect(chokePoint).not.toMatch(DEDUCT_RPCS);

    // The KDS item path (updateModuleOrderItemStatus) must never touch
    // stock — but createModuleOrder (creation) legitimately calls the ONE
    // authority RPC. Slice the item-status function's body and assert it is
    // clean.
    const staffCtrl = readFileSync(join(__dirname, '../../../src/modules/staff/module-staff.controller.ts'), 'utf8');
    const itemStart = staffCtrl.indexOf('export async function updateModuleOrderItemStatus');
    const itemEnd = staffCtrl.indexOf('export async function splitModuleOrder');
    expect(itemStart).toBeGreaterThan(0);
    expect(itemEnd).toBeGreaterThan(itemStart);
    const itemPath = staffCtrl.slice(itemStart, itemEnd);
    expect(itemPath).not.toMatch(DEDUCT_RPCS);

    // And the staff creation path uses the SAME authority RPC — no second
    // stock-mutation function.
    expect(staffCtrl).toMatch(/rpc\('deduct_inventory_for_order_items'/);
    // It also runs the pre-flight allocation (staff orders are created
    // directly as 'confirmed').
    expect(staffCtrl).toMatch(/allocateForConfirmation/);
  });

  it('the KDS item path also drives the resource lifecycle (consumption fires there too)', () => {
    const src = readFileSync(join(__dirname, '../../../src/modules/staff/module-staff.controller.ts'), 'utf8');
    // Item-derived fulfillment moves (mark_ready / deliver) drive the same
    // generic lifecycle driver — consumption at handoff is not skipped when
    // the move comes from item bumps instead of the order-status choke point.
    expect(src).toMatch(/itemPathResourceConsumption/);
    expect(src).toMatch(/handleLifecycleMove/);
    expect(src).toMatch(/derivedFromItems: true/);
  });

  it('the order-status choke point allocates resources BEFORE it writes confirmation', () => {
    const src = readFileSync(join(__dirname, '../../../src/engines/order-status.service.ts'), 'utf8');
    // Pre-flight allocation is invoked before the transactions update in
    // the source, and refusal on failure is explicit.
    expect(src).toMatch(/allocateForConfirmation/);
    expect(src).toMatch(/Refusing to confirm — resource allocation failed/);
    const allocPos = src.indexOf('allocateForConfirmation');
    // `.update({` is the transactions update (unique in this file) — the
    // pre-flight must precede it in source as it does in the call order.
    const updatePos = src.indexOf('.update({');
    expect(allocPos).toBeGreaterThan(0);
    expect(updatePos).toBeGreaterThan(allocPos);
  });
});
