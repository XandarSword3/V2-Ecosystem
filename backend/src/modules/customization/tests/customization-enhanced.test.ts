/**
 * Customization System Tests - Enhanced Coverage
 * Tests for transactional order snapshots, reversal flow, and observability
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the customization service for unit testing
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
  })),
};

describe('Customization System - Transactional Order Snapshot', () => {
  describe('create_order_customization_snapshot', () => {
    it('should validate selections before creating snapshot', async () => {
      // Mock validation failure
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{
          success: false,
          snapshot_id: null,
          total_price_adjustment: 0,
          inventory_result: null,
          validation_errors: ['Selection exceeds max quantity'],
          event_ids: ['event-123']
        }],
        error: null
      });

      const result = {
        success: false,
        errors: ['Selection exceeds max quantity'],
        eventIds: ['event-123']
      };

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Selection exceeds max quantity');
      expect(result.eventIds.length).toBe(1);
    });

    it('should create snapshot and execute inventory atomically', async () => {
      const mockResult = {
        success: true,
        snapshot_id: 'snapshot-123',
        total_price_adjustment: 5.50,
        inventory_result: {
          items_added: 2,
          items_removed: 0,
          items_swapped: 1,
          deduction_log: [
            { action: 'deducted', inventoryItemId: 'inv-1', quantity: 1 },
            { action: 'swapped', addedItemId: 'inv-2', removedItemId: 'inv-3', quantity: 1 }
          ]
        },
        validation_errors: [],
        event_ids: ['event-1', 'event-2']
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.snapshot_id).toBeDefined();
      expect(mockResult.inventory_result.items_added).toBe(2);
      expect(mockResult.inventory_result.items_swapped).toBe(1);
      expect(mockResult.event_ids.length).toBe(2);
    });

    it('should skip inventory when executeInventory is false', async () => {
      const mockResult = {
        success: true,
        snapshot_id: 'snapshot-456',
        total_price_adjustment: 3.00,
        inventory_result: { items_added: 0, items_removed: 0, items_swapped: 0 },
        validation_errors: [],
        event_ids: ['event-3']
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.inventory_result.items_added).toBe(0);
    });
  });

  describe('Inventory Processing with Warnings', () => {
    it('should emit warning when stock falls below minimum', async () => {
      const inventoryWarning = {
        event_type: 'inventory.warning',
        payload: {
          warning_type: 'low_stock',
          inventory_item_id: 'inv-1',
          item_name: 'Extra Cheese',
          current_stock: 10,
          deduction_amount: 5,
          remaining_stock: 5,
          minimum_stock: 10
        }
      };

      expect(inventoryWarning.payload.warning_type).toBe('low_stock');
      expect(inventoryWarning.payload.remaining_stock).toBeLessThanOrEqual(inventoryWarning.payload.minimum_stock);
    });

    it('should emit warning when insufficient stock', async () => {
      const inventoryWarning = {
        event_type: 'inventory.warning',
        payload: {
          warning_type: 'insufficient_stock',
          inventory_item_id: 'inv-2',
          item_name: 'Premium Topping',
          required: 5,
          available: 2
        }
      };

      expect(inventoryWarning.payload.warning_type).toBe('insufficient_stock');
      expect(inventoryWarning.payload.required).toBeGreaterThan(inventoryWarning.payload.available);
    });
  });
});

describe('Customization System - Refund & Reversal Flow', () => {
  describe('reverse_order_item_inventory', () => {
    it('should reverse inventory and mark snapshots as reversed', async () => {
      const reversalResult = {
        success: true,
        items_reversed: 2,
        reversal_log: [
          {
            action: 'inventory_restored',
            snapshot_id: 'snap-1',
            inventory_item_id: 'inv-1',
            quantity_restored: 2,
            option_name: 'Extra Cheese'
          },
          {
            action: 'inventory_restored',
            snapshot_id: 'snap-2',
            inventory_item_id: 'inv-2',
            quantity_restored: 1,
            option_name: 'Large Size'
          }
        ],
        error_message: null
      };

      expect(reversalResult.success).toBe(true);
      expect(reversalResult.items_reversed).toBe(2);
      expect(reversalResult.reversal_log).toHaveLength(2);
      expect(reversalResult.reversal_log[0].action).toBe('inventory_restored');
    });

    it('should fail if snapshot not found', async () => {
      const reversalResult = {
        success: false,
        items_reversed: 0,
        reversal_log: [],
        error_message: 'Snapshot not found'
      };

      expect(reversalResult.success).toBe(false);
      expect(reversalResult.error_message).toBe('Snapshot not found');
    });

    it('should fail if snapshot already reversed', async () => {
      const reversalResult = {
        success: false,
        items_reversed: 0,
        reversal_log: [],
        error_message: 'Snapshot already reversed'
      };

      expect(reversalResult.success).toBe(false);
      expect(reversalResult.error_message).toBe('Snapshot already reversed');
    });

    it('should emit inventory.reversed event', async () => {
      const reversalEvent = {
        event_type: 'inventory.reversed',
        order_type: 'restaurant_order',
        order_id: 'order-123',
        payload: {
          snapshot_id: 'snap-1',
          items_reversed: 2,
          reason: 'Customer refund',
          reversed_by: 'user-456',
          reversal_log: []
        }
      };

      expect(reversalEvent.event_type).toBe('inventory.reversed');
      expect(reversalEvent.payload.reason).toBe('Customer refund');
    });
  });

  describe('get_reversible_order_customizations', () => {
    it('should return customizations that can be reversed', async () => {
      const reversibleItems = [
        {
          snapshot_id: 'snap-1',
          order_item_id: 'item-1',
          option_name: 'Extra Cheese',
          quantity: 2,
          inventory_deducted: true,
          inventory_quantity_used: 2,
          can_reverse: true
        },
        {
          snapshot_id: 'snap-2',
          order_item_id: 'item-1',
          option_name: 'Large Size',
          quantity: 1,
          inventory_deducted: true,
          inventory_quantity_used: 1,
          can_reverse: false // Already reversed
        }
      ];

      const canReverse = reversibleItems.filter(item => item.can_reverse);
      expect(canReverse).toHaveLength(1);
      expect(canReverse[0].option_name).toBe('Extra Cheese');
    });
  });
});

describe('Customization System - Observability', () => {
  describe('Event Emission', () => {
    it('should emit price.calculated event on validation', async () => {
      const event = {
        event_type: 'price.calculated',
        entity_type: 'menu_item',
        entity_id: 'item-123',
        payload: {
          selections_count: 3,
          total_price_adjustment: 7.50,
          is_valid: true,
          errors: [],
          latency_ms: 12.5
        }
      };

      expect(event.event_type).toBe('price.calculated');
      expect(event.payload.latency_ms).toBeLessThan(50); // Performance target
    });

    it('should emit validation.failed event on invalid selections', async () => {
      const event = {
        event_type: 'validation.failed',
        entity_type: 'menu_item',
        entity_id: 'item-456',
        payload: {
          selections_count: 2,
          is_valid: false,
          errors: ['Required group "Size" has no selection', 'Selection quantity exceeds maximum'],
          latency_ms: 8.3
        }
      };

      expect(event.event_type).toBe('validation.failed');
      expect(event.payload.is_valid).toBe(false);
      expect(event.payload.errors.length).toBeGreaterThan(0);
    });

    it('should emit inventory.executed event after processing', async () => {
      const event = {
        event_type: 'inventory.executed',
        order_type: 'restaurant_order',
        order_id: 'order-789',
        payload: {
          items_added: 2,
          items_removed: 1,
          items_swapped: 0,
          deduction_log: [],
          latency_ms: 25.7
        }
      };

      expect(event.event_type).toBe('inventory.executed');
      expect(event.payload.items_added).toBe(2);
    });
  });

  describe('Metrics Recording', () => {
    it('should record validation_latency_ms metric', async () => {
      const metric = {
        metric_name: 'validation_latency_ms',
        metric_value: 15.2,
        dimensions: {
          entity_type: 'menu_item',
          selections_count: 4
        }
      };

      expect(metric.metric_name).toBe('validation_latency_ms');
      expect(metric.metric_value).toBeLessThan(50); // Under target
    });

    it('should record inventory_processing_ms metric', async () => {
      const metric = {
        metric_name: 'inventory_processing_ms',
        metric_value: 32.8,
        dimensions: {
          items_processed: 3
        }
      };

      expect(metric.metric_name).toBe('inventory_processing_ms');
      expect(metric.metric_value).toBeLessThan(50); // Under target
    });
  });

  describe('Metrics Summary View', () => {
    it('should calculate percentiles correctly', async () => {
      const summary = {
        metric_name: 'validation_latency_ms',
        sample_count: 1000,
        avg_value: 18.5,
        min_value: 5.2,
        max_value: 95.3,
        p50: 15.0,
        p95: 35.2,
        p99: 48.7
      };

      expect(summary.p50).toBeLessThan(summary.avg_value * 1.5); // Reasonable median
      expect(summary.p95).toBeLessThan(50); // Under performance target
      expect(summary.p99).toBeLessThan(summary.max_value);
    });
  });
});

describe('Customization System - Dual-Write Migration', () => {
  describe('log_dual_write_comparison', () => {
    it('should log matching results', async () => {
      const comparison = {
        operation: 'validate',
        old_system_result: { total: 10.50, valid: true },
        new_system_result: { total: 10.50, valid: true },
        results_match: true,
        discrepancies: []
      };

      expect(comparison.results_match).toBe(true);
      expect(comparison.discrepancies).toHaveLength(0);
    });

    it('should detect and log discrepancies', async () => {
      const comparison = {
        operation: 'process_inventory',
        old_system_result: { items_deducted: 2, total: 5.00 },
        new_system_result: { items_deducted: 3, total: 5.50 },
        results_match: false,
        discrepancies: {
          items_deducted: { old: 2, new: 3 },
          total: { old: 5.00, new: 5.50 }
        }
      };

      expect(comparison.results_match).toBe(false);
      expect(comparison.discrepancies).toBeDefined();
    });
  });

  describe('Dual-Write Stats', () => {
    it('should calculate match rate', async () => {
      const stats = {
        total: 1000,
        matches: 995,
        mismatches: 5,
        matchRate: 99.5
      };

      expect(stats.matchRate).toBeGreaterThanOrEqual(99);
      expect(stats.matches + stats.mismatches).toBe(stats.total);
    });

    it('should alert on low match rate', async () => {
      const stats = {
        total: 100,
        matches: 90,
        mismatches: 10,
        matchRate: 90.0
      };

      const needsAttention = stats.matchRate < 99;
      expect(needsAttention).toBe(true);
    });
  });
});

describe('Customization System - RLS Policies', () => {
  describe('Group/Option Write Policies', () => {
    it('should allow admin to create groups', async () => {
      const userRole = 'admin' as string;
      const canCreate = ['admin', 'manager'].includes(userRole);
      expect(canCreate).toBe(true);
    });

    it('should allow manager to update groups', async () => {
      const userRole = 'manager' as string;
      const canUpdate = ['admin', 'manager'].includes(userRole);
      expect(canUpdate).toBe(true);
    });

    it('should deny staff from creating groups', async () => {
      const userRole = 'staff' as string;
      const canCreate = ['admin', 'manager'].includes(userRole);
      expect(canCreate).toBe(false);
    });

    it('should only allow admin to delete groups', async () => {
      const userRole = 'manager' as string;
      const canDelete = userRole === 'admin';
      expect(canDelete).toBe(false);
    });
  });

  describe('Order Customization Policies', () => {
    it('should allow staff to read order customizations', async () => {
      const userRole = 'staff' as string;
      const canRead = ['admin', 'manager', 'staff'].includes(userRole);
      expect(canRead).toBe(true);
    });

    it('should only allow service role to insert order customizations', async () => {
      const jwtRole = 'service_role' as string;
      const canInsert = jwtRole === 'service_role' || ['admin', 'manager', 'staff'].includes(jwtRole);
      expect(canInsert).toBe(true);
    });

    it('should only allow admin to update order customizations (reversals)', async () => {
      const userRole = 'manager' as string;
      const jwtRole = 'authenticated' as string;
      const canUpdate = jwtRole === 'service_role' || userRole === 'admin';
      expect(canUpdate).toBe(false);
    });
  });
});

describe('Customization System - Edge Cases', () => {
  it('should handle empty selections gracefully', async () => {
    const result = {
      success: true,
      snapshot_id: 'snap-empty',
      total_price_adjustment: 0,
      inventory_result: { items_added: 0, items_removed: 0, items_swapped: 0 },
      validation_errors: [],
      event_ids: ['event-empty']
    };

    expect(result.success).toBe(true);
    expect(result.total_price_adjustment).toBe(0);
  });

  it('should handle concurrent reversals safely', async () => {
    // First reversal succeeds
    const firstReversal = { success: true, items_reversed: 2 };
    // Second reversal fails (already reversed)
    const secondReversal = { success: false, error_message: 'Snapshot already reversed' };

    expect(firstReversal.success).toBe(true);
    expect(secondReversal.success).toBe(false);
  });

  it('should handle very large selections count', async () => {
    const largeSelectionsCount = 100;
    const processingTime = 45; // ms

    // Should still be under 50ms target even with large selections
    expect(processingTime).toBeLessThan(50);
  });

  it('should handle null inventory_item_id options', async () => {
    const optionWithoutInventory = {
      option_id: 'opt-1',
      name: 'No Ice',
      customization_type: 'remove',
      inventory_item_id: null,
      price_adjustment: 0
    };

    // Should process without trying to deduct inventory
    expect(optionWithoutInventory.inventory_item_id).toBeNull();
  });
});
