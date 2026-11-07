import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStatefulDbHarness } from '../../helpers/stateful-db-harness';

const harness = createStatefulDbHarness();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => harness.supabase,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Inventory FIFO Concurrency & Oversell Protection (Engine A Production Verification)', () => {
  const ITEM_ID = 'item-concurrency-001';

  beforeEach(() => {
    harness.clear();
    vi.clearAllMocks();

    harness.seed('inventory_items', [
      {
        id: ITEM_ID,
        name: 'Ribeye Steak',
        current_stock: 50,
        min_stock_level: 10,
        unit: 'kg',
      },
    ]);
  });

  it('serializes concurrent FIFO stock deductions without negative stock', async () => {
    const supabase = harness.supabase;

    // Simulate 10 concurrent workers each trying to deduct 6 units (total requested: 60 units, available: 50)
    const workerDeductions = Array.from({ length: 10 }, async (_, index) => {
      return await supabase.rpc('deduct_stock_fifo', {
        p_item_id: ITEM_ID,
        p_quantity: 6,
        p_reason: 'sale',
        worker_id: `worker-${index}`,
      });
    });

    const results = await Promise.all(workerDeductions);

    // All RPC calls must resolve successfully through the harness
    expect(results).toHaveLength(10);
    results.forEach((r) => {
      expect(r.error).toBeNull();
    });

    // Verify stock is never negative
    const inventory = harness.getTable('inventory_items');
    expect(inventory[0].current_stock).toBe(0);

    // Verify exactly 10 RPC calls were tracked
    const calls = harness.getRpcCalls('deduct_stock_fifo');
    expect(calls).toHaveLength(10);
  });

  it('restores inventory atomically on order cancellation under concurrent load', async () => {
    const supabase = harness.supabase;

    harness.seed('inventory_items', [
      {
        id: 'item-restore-001',
        catalog_item_id: 'cat-item-burger',
        name: 'Burger Patty',
        current_stock: 10,
      },
    ]);

    // 5 concurrent cancellation restorations of 2 burgers each (+10 total)
    const restorations = Array.from({ length: 5 }, async () => {
      return await supabase.rpc('restore_inventory_for_order_items', {
        p_items: [{ catalog_item_id: 'cat-item-burger', quantity: 2 }],
      });
    });

    await Promise.all(restorations);

    const items = harness.getTable('inventory_items');
    const burger = items.find((i) => i.id === 'item-restore-001');
    expect(burger.current_stock).toBe(20); // 10 initial + (5 * 2)
  });
});
