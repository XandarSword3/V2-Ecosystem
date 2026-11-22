/**
 * InventoryService unit tests (modules/inventory/inventory.service.ts)
 *
 * Previously ~0% unit coverage. Core behaviors proven here:
 *   - deductIngredients: FIFO RPC first, direct-update fallback with stock
 *     clamping at 0, inventory_transactions audit row with correct before/
 *     after, per-item error isolation (one failing item never blocks others).
 *   - processDeductions: recipe aggregation (required qty × item qty combined
 *     across items sharing an ingredient) and early exits.
 */

import { createScriptedSupabase } from '../helpers/scripted-supabase';

const db = createScriptedSupabase();

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { inventoryService } from '../../../src/modules/inventory/inventory.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
});

describe('deductIngredients', () => {
  it('short-circuits with empty deductions', async () => {
    await inventoryService.deductIngredients('order-1', 'order', [], db as any);
    expect(db.calls).toEqual([]);
  });

  it('uses the FIFO RPC and tags the reason with reference type and id', async () => {
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });

    await inventoryService.deductIngredients(
      'order-77',
      'order',
      [{ inventory_item_id: 'beef', quantity: 0.5 }],
      db as any,
    );

    expect(db.calls).toHaveLength(1);
    const rpc = db.calls[0];
    expect(rpc.table).toBe('rpc:deduct_stock_fifo');
    expect(rpc.args![0]).toEqual({
      p_item_id: 'beef',
      p_quantity: 0.5,
      p_reason: 'ORDER #order-77',
    });
  });

  it('on RPC failure, falls back to direct stock decrement for that item', async () => {
    db.queue('rpc:deduct_stock_fifo', { data: null, error: { message: 'rpc unavailable' } });
    db.queue('inventory_items:select', { data: { current_stock: 10 }, error: null });
    db.queue('inventory_items:update', { data: null, error: null });
    db.queue('inventory_transactions:insert', { data: null, error: null });

    await inventoryService.deductIngredients(
      'ticket-5',
      'ticket',
      [{ inventory_item_id: 'cola', quantity: 3 }],
      db as any,
    );

    const update = db.calls.find((c) => c.table === 'inventory_items' && c.op === 'update')!;
    expect(update.payload).toMatchObject({ current_stock: 7 }); // 10 - 3
    const eqCall = db.calls.find((c) => c.table === 'inventory_items' && c.op === 'eq')!;
    expect(eqCall.args).toEqual(['id', 'cola']);

    const tx = db.calls.find((c) => c.table === 'inventory_transactions' && c.op === 'insert')!;
    expect(tx.payload).toMatchObject({
      item_id: 'cola',
      transaction_type: 'consumption',
      quantity: 3,
      stock_before: 10,
      stock_after: 7,
      reference_type: 'ticket',
      reference_id: 'ticket-5',
    });
  });

  it('clamps fallback stock at zero instead of going negative', async () => {
    db.queue('rpc:deduct_stock_fifo', { data: null, error: { message: 'rpc unavailable' } });
    db.queue('inventory_items:select', { data: { current_stock: 3 }, error: null });
    db.queue('inventory_items:update', { data: null, error: null });
    db.queue('inventory_transactions:insert', { data: null, error: null });

    await inventoryService.deductIngredients(
      'manual-1',
      'manual',
      [{ inventory_item_id: 'ice', quantity: 999 }],
      db as any,
    );

    const update = db.calls.find((c) => c.table === 'inventory_items' && c.op === 'update')!;
    expect(update.payload).toMatchObject({ current_stock: 0 });
  });

  it('treats a missing current_stock as zero', async () => {
    db.queue('rpc:deduct_stock_fifo', { data: null, error: { message: 'rpc unavailable' } });
    db.queue('inventory_items:select', { data: { current_stock: null }, error: null });
    db.queue('inventory_items:update', { data: null, error: null });
    db.queue('inventory_transactions:insert', { data: null, error: null });

    await inventoryService.deductIngredients(
      'manual-2',
      'manual',
      [{ inventory_item_id: 'lemon', quantity: 2 }],
      db as any,
    );

    const update = db.calls.find((c) => c.table === 'inventory_items' && c.op === 'update')!;
    expect(update.payload).toMatchObject({ current_stock: 0 });
    const tx = db.calls.find((c) => c.table === 'inventory_transactions' && c.op === 'insert')!;
    expect(tx.payload).toMatchObject({ stock_before: 0, stock_after: 0, quantity: 2 });
  });

  it('one item failing does not block the next (error isolation)', async () => {
    // Item 1: RPC fails AND fetch fails → logged, continue
    db.queue('rpc:deduct_stock_fifo', { data: null, error: { message: 'rpc unavailable' } });
    db.queue('inventory_items:select', { data: null, error: { message: 'row gone' } });
    // Item 2: RPC succeeds
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });

    await inventoryService.deductIngredients(
      'order-8',
      'order',
      [
        { inventory_item_id: 'ghost-item', quantity: 1 },
        { inventory_item_id: 'beef', quantity: 2 },
      ],
      db as any,
    );

    const fifoCalls = db.calls.filter((c) => c.table === 'rpc:deduct_stock_fifo');
    expect(fifoCalls).toHaveLength(2); // second item still attempted
    expect(fifoCalls[1].args![0].p_item_id).toBe('beef');
    // No fallback write happened for the failed first item
    expect(db.calls.some((c) => c.table === 'inventory_items' && c.op === 'update')).toBe(false);
  });

  it('fallback update failure skips the transaction-log insert', async () => {
    db.queue('rpc:deduct_stock_fifo', { data: null, error: { message: 'rpc unavailable' } });
    db.queue('inventory_items:select', { data: { current_stock: 5 }, error: null });
    db.queue('inventory_items:update', { data: null, error: { message: 'lock timeout' } });

    await inventoryService.deductIngredients(
      'order-9',
      'order',
      [{ inventory_item_id: 'sugar', quantity: 1 }],
      db as any,
    );

    expect(db.calls.some((c) => c.table === 'inventory_transactions')).toBe(false);
    expect(db.calls.some((c) => c.table === 'rpc:deduct_stock_fifo')).toBe(true);
  });

  it('transaction-log insert failure is a logged warn, not a throw', async () => {
    db.queue('rpc:deduct_stock_fifo', { data: null, error: { message: 'rpc unavailable' } });
    db.queue('inventory_items:select', { data: { current_stock: 5 }, error: null });
    db.queue('inventory_items:update', { data: null, error: null });
    db.queue('inventory_transactions:insert', { data: null, error: { message: 'tx write failed' } });

    await expect(
      inventoryService.deductIngredients(
        'order-10',
        'order',
        [{ inventory_item_id: 'flour', quantity: 2 }],
        db as any,
      ),
    ).resolves.toBeUndefined();
  });
});

describe('processDeductions', () => {
  it('aggregates shared ingredients across items before deducting', async () => {
    // burger (x2) and double-burger (x1) both need buns + beef
    db.queue('menu_item_ingredients:select', {
      data: [
        { catalog_item_id: 'burger', inventory_item_id: 'buns', quantity_required: 1 },
        { catalog_item_id: 'burger', inventory_item_id: 'beef', quantity_required: 0.2 },
        { catalog_item_id: 'double-burger', inventory_item_id: 'beef', quantity_required: 0.4 },
      ],
      error: null,
    });
    // two aggregated deductions → two FIFO RPCs
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });

    await inventoryService.processDeductions(
      'order-11',
      'order',
      [
        { id: 'burger', quantity: 2 },
        { id: 'double-burger', quantity: 1 },
      ],
      'menu_item_ingredients',
      'catalog_item_id',
      db as any,
    );

    const fifoCalls = db.calls.filter((c) => c.table === 'rpc:deduct_stock_fifo');
    expect(fifoCalls).toHaveLength(2);
    const payloads = fifoCalls.map((c) => c.args![0]);
    expect(payloads).toContainEqual({ p_item_id: 'buns', p_quantity: 2, p_reason: 'ORDER #order-11' });
    // 0.2×2 + 0.4×1 = 0.8 — aggregated across BOTH items
    expect(payloads).toContainEqual({ p_item_id: 'beef', p_quantity: 0.8, p_reason: 'ORDER #order-11' });
  });

  it('works with session recipes via session_ingredients + session_id foreign key', async () => {
    db.queue('session_ingredients:select', {
      data: [{ session_id: 'spa-hour', inventory_item_id: 'oils', quantity_required: 0.05 }],
      error: null,
    });
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });

    await inventoryService.processDeductions(
      'ticket-2',
      'ticket',
      [{ id: 'spa-hour', quantity: 4 }],
      'session_ingredients',
      'session_id',
      db as any,
    );

    const recipe = db.calls.find((c) => c.table === 'session_ingredients' && c.op === 'select')!;
    expect((recipe.args![0] as string)).toContain('session_id');
    const rpc = db.calls.find((c) => c.table === 'rpc:deduct_stock_fifo')!;
    expect(rpc.args![0]).toEqual({
      p_item_id: 'oils',
      p_quantity: 0.2, // 0.05 × 4
      p_reason: 'TICKET #ticket-2',
    });
  });

  it('returns early without recipes (no rows)', async () => {
    db.queue('menu_item_ingredients:select', { data: [], error: null });

    await inventoryService.processDeductions(
      'order-12',
      'order',
      [{ id: 'burger', quantity: 1 }],
      'menu_item_ingredients',
      'catalog_item_id',
      db as any,
    );

    expect(db.calls.some((c) => c.table === 'rpc:deduct_stock_fifo')).toBe(false);
  });

  it('returns early on recipe fetch error', async () => {
    db.queue('menu_item_ingredients:select', { data: null, error: { message: 'boom' } });

    await inventoryService.processDeductions(
      'order-13',
      'order',
      [{ id: 'burger', quantity: 1 }],
      'menu_item_ingredients',
      'catalog_item_id',
      db as any,
    );

    expect(db.calls.some((c) => c.table === 'rpc:deduct_stock_fifo')).toBe(false);
  });

  it('skips everything when no items are given', async () => {
    await inventoryService.processDeductions(
      'order-14',
      'order',
      [],
      'menu_item_ingredients',
      'catalog_item_id',
      db as any,
    );
    expect(db.calls).toEqual([]);
  });
});
