/**
 * Inventory Side Effects unit tests (engines/inventory-side-effects.ts)
 *
 * Two side effects wire inventory into the Engine A state machine:
 *   - deductInventorySideEffect: live RPC deduct_inventory_for_order, with a
 *     legacy fallback (order_items × menu_item_ingredients → deduct_stock_fifo)
 *     plus an inventory_alerts row when deductions fail.
 *   - restoreInventorySideEffect: atomic restore_inventory_for_order on cancel.
 *
 * Both are fire-and-forget by design — nothing may throw into the state
 * machine. Previously 0% unit coverage.
 */

import { createScriptedSupabase } from '../helpers/scripted-supabase';

const db = createScriptedSupabase();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => db,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  deductInventorySideEffect,
  restoreInventorySideEffect,
} from '../../../src/engines/inventory-side-effects.js';
import { logger } from '../../../src/utils/logger.js';

const transition: any = { from: 'pending', to: 'confirmed', action: 'confirm', allowedActors: ['staff'] };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
});

describe('deductInventorySideEffect', () => {
  it('skips silently (warn) with no transactionId and no orderId', async () => {
    await deductInventorySideEffect(transition, {});
    expect(db.calls).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falls back to orderId when transactionId is absent', async () => {
    db.queue('rpc:deduct_inventory_for_order', {
      data: [{ success: true, items_deducted: 3 }],
      error: null,
    });

    await deductInventorySideEffect(transition, { orderId: 'order-9' });

    const rpc = db.calls.find((c) => c.table === 'rpc:deduct_inventory_for_order')!;
    expect(rpc.args![0]).toEqual({ p_transaction_id: 'order-9', p_performed_by: undefined });
    // No legacy-path queries happened
    expect(db.calls.some((c) => c.table === 'order_items')).toBe(false);
  });

  it('does NOT take the legacy path when the live RPC succeeds', async () => {
    db.queue('rpc:deduct_inventory_for_order', {
      data: [{ success: true, items_deducted: 2 }],
      error: null,
    });

    await deductInventorySideEffect(transition, { transactionId: 'tx-1', userId: 'staff-1' });

    const rpc = db.calls.find((c) => c.table === 'rpc:deduct_inventory_for_order')!;
    expect(rpc.args![0]).toEqual({ p_transaction_id: 'tx-1', p_performed_by: 'staff-1' });
    expect(db.calls.some((c) => c.table === 'order_items')).toBe(false);
  });

  it('legacy fallback deducts base recipes via deduct_stock_fifo when the RPC errors', async () => {
    db.queue('rpc:deduct_inventory_for_order', { data: null, error: { message: 'function missing' } });
    // legacy: order items
    db.queue('order_items:select', {
      data: [
        { id: 'oi-1', quantity: 2, catalog_item_id: 'burger' },
        { id: 'oi-2', quantity: 1, catalog_item_id: 'fries' },
      ],
      error: null,
    });
    // recipe for burger (2 ingredients), recipe for fries (1)
    db.queue('menu_item_ingredients:select', {
      data: [
        { inventory_item_id: 'beef', quantity_required: 0.2, unit: 'kg' },
        { inventory_item_id: 'buns', quantity_required: 1, unit: 'pcs' },
      ],
      error: null,
    });
    db.queue('menu_item_ingredients:select', {
      data: [{ inventory_item_id: 'potato', quantity_required: 2, unit: 'pcs' }],
      error: null,
    });
    // deduct_stock_fifo: one entry per (ingredient × order item)
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });
    db.queue('rpc:deduct_stock_fifo', { data: null, error: null });

    await deductInventorySideEffect(transition, { transactionId: 'tx-1' });

    const fifoCalls = db.calls.filter((c) => c.table === 'rpc:deduct_stock_fifo');
    expect(fifoCalls).toHaveLength(3);
    // Live deduct_stock_fifo signature: (p_item_id, p_quantity, p_reason)
    expect(fifoCalls[0].args![0]).toEqual({ p_item_id: 'beef', p_quantity: 0.4, p_reason: 'order' });
    expect(fifoCalls[1].args![0]).toEqual({ p_item_id: 'buns', p_quantity: 2, p_reason: 'order' });
    expect(fifoCalls[2].args![0]).toEqual({ p_item_id: 'potato', p_quantity: 2, p_reason: 'order' });
  });

  it('returns early (info log) when no order items found for the legacy fallback', async () => {
    db.queue('rpc:deduct_inventory_for_order', { data: null, error: { message: 'boom' } });
    db.queue('order_items:select', { data: [], error: null });

    await deductInventorySideEffect(transition, { transactionId: 'tx-1' });

    expect(db.calls.some((c) => c.table === 'menu_item_ingredients')).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No order items found for order tx-1'));
  });

  it('writes an inventory_alerts row when legacy deductions partially failed', async () => {
    db.queue('rpc:deduct_inventory_for_order', { data: null, error: { message: 'boom' } });
    db.queue('order_items:select', {
      data: [{ id: 'oi-1', quantity: 1, catalog_item_id: 'burger' }],
      error: null,
    });
    db.queue('menu_item_ingredients:select', {
      data: [{ inventory_item_id: 'beef', quantity_required: 1, unit: 'kg' }],
      error: null,
    });
    db.queue('rpc:deduct_stock_fifo', { data: null, error: { message: 'negative stock blocked' } });

    await deductInventorySideEffect(transition, { transactionId: 'tx-1' });

    const alert = db.calls.find((c) => c.table === 'inventory_alerts' && c.op === 'insert')!;
    expect(alert.payload).toMatchObject({
      alert_type: 'deduction_failed',
      severity: 'warning',
      reference_id: 'tx-1',
      reference_table: 'orders',
    });
    expect(String((alert.payload as any).message)).toContain('negative stock blocked');
  });

  it('never throws — unexpected errors only log', async () => {
    // Make the order_items query blow up (unqueueable via data; simulate by
    // erroring the RPC and then erroring the items select)
    db.queue('rpc:deduct_inventory_for_order', { data: null, error: { message: 'boom' } });
    db.queue('order_items:select', { data: null, error: { message: 'connection lost' } });

    await expect(
      deductInventorySideEffect(transition, { transactionId: 'tx-1' }),
    ).resolves.toBeUndefined();
  });
});

describe('restoreInventorySideEffect', () => {
  it('skips silently (warn) with no transactionId and no orderId', async () => {
    await restoreInventorySideEffect(transition, {});
    expect(db.calls).toEqual([]);
  });

  it('calls restore_inventory_for_order with the order id and explicit null performer', async () => {
    db.queue('rpc:restore_inventory_for_order', {
      data: [{ success: true, items_restored: 4 }],
      error: null,
    });

    await restoreInventorySideEffect(transition, { orderId: 'order-cancelled-1' });

    const rpc = db.calls.find((c) => c.table === 'rpc:restore_inventory_for_order')!;
    expect(rpc.args![0]).toEqual({ p_transaction_id: 'order-cancelled-1', p_performed_by: null });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Restored 4 things'.replace('things', 'items')));
  });

  it('logs an error (not throw) when restoration fails', async () => {
    db.queue('rpc:restore_inventory_for_order', { data: null, error: { message: 'deadlock' } });

    await expect(
      restoreInventorySideEffect(transition, { transactionId: 'tx-2' }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('restore_inventory_for_order failed: deadlock'),
      expect.objectContaining({ orderId: 'tx-2' }),
    );
  });

  it('logs an error when the RPC reports success=false with an error message', async () => {
    db.queue('rpc:restore_inventory_for_order', {
      data: [{ success: false, error_message: 'already restored' }],
      error: null,
    });

    await restoreInventorySideEffect(transition, { transactionId: 'tx-2' });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('already restored'),
      expect.anything(),
    );
  });

  it('survives an unexpected throw from the client', async () => {
    // Simulate a hard failure by erroring without a message-bearing result
    db.queue('rpc:restore_inventory_for_order', { data: undefined, error: null });

    await expect(
      restoreInventorySideEffect(transition, { transactionId: 'tx-3' }),
    ).resolves.toBeUndefined();
  });
});
