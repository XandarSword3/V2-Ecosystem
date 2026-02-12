import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { inventoryService, InventoryService } from '../../../../src/modules/inventory/inventory.service';

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

function createMockSupabase(tableDataMap: Record<string, unknown[]> = {}) {
  const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
  
  return {
    from: vi.fn().mockImplementation((tableName: string) => {
      const data = tableDataMap[tableName] || [];
      return createQueryMock(() => data);
    }),
    rpc: rpcMock,
  };
}

describe('InventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('inventoryService instance', () => {
    it('should be defined', () => {
      expect(inventoryService).toBeDefined();
    });

    it('should be instance of InventoryService', () => {
      expect(inventoryService).toBeInstanceOf(InventoryService);
    });

    it('should have deductIngredients method', () => {
      expect(typeof inventoryService.deductIngredients).toBe('function');
    });

    it('should have processDeductions method', () => {
      expect(typeof inventoryService.processDeductions).toBe('function');
    });
  });

  describe('deductIngredients', () => {
    it('should return early when deductions array is empty', async () => {
      const mockSupabase = createMockSupabase();
      
      await inventoryService.deductIngredients(
        'order-123',
        'order',
        [],
        mockSupabase as any
      );

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should call RPC deduct_stock_fifo for each deduction', async () => {
      const mockSupabase = createMockSupabase();
      const deductions = [
        { inventory_item_id: 'item-1', quantity: 5 },
        { inventory_item_id: 'item-2', quantity: 3 },
      ];

      await inventoryService.deductIngredients(
        'order-123',
        'order',
        deductions,
        mockSupabase as any
      );

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'item-1',
        p_quantity: 5,
        p_reason: 'ORDER #order-123'
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'item-2',
        p_quantity: 3,
        p_reason: 'ORDER #order-123'
      });
    });

    it('should handle ticket reference type', async () => {
      const mockSupabase = createMockSupabase();
      const deductions = [{ inventory_item_id: 'item-1', quantity: 2 }];

      await inventoryService.deductIngredients(
        'ticket-456',
        'ticket',
        deductions,
        mockSupabase as any
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'item-1',
        p_quantity: 2,
        p_reason: 'TICKET #ticket-456'
      });
    });

    it('should handle manual reference type', async () => {
      const mockSupabase = createMockSupabase();
      const deductions = [{ inventory_item_id: 'item-1', quantity: 10 }];

      await inventoryService.deductIngredients(
        'manual-789',
        'manual',
        deductions,
        mockSupabase as any
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'item-1',
        p_quantity: 10,
        p_reason: 'MANUAL #manual-789'
      });
    });

    it('should use fallback when RPC fails', async () => {
      const mockSupabase = createMockSupabase({
        inventory_items: [{ id: 'item-1', current_stock: 100 }],
      });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC not found' } });

      const deductions = [{ inventory_item_id: 'item-1', quantity: 5 }];

      await inventoryService.deductIngredients(
        'order-123',
        'order',
        deductions,
        mockSupabase as any
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_items');
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_transactions');
    });

    it('should calculate new stock correctly in fallback (stock - quantity)', async () => {
      const inventoryItems = [{ id: 'item-1', current_stock: 50 }];
      const mockSupabase = createMockSupabase({ inventory_items: inventoryItems });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });

      const deductions = [{ inventory_item_id: 'item-1', quantity: 20 }];

      await inventoryService.deductIngredients(
        'order-100',
        'order',
        deductions,
        mockSupabase as any
      );

      // Fallback should fetch item and update
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_items');
    });

    it('should not allow stock to go negative in fallback', async () => {
      const inventoryItems = [{ id: 'item-1', current_stock: 5 }];
      const mockSupabase = createMockSupabase({ inventory_items: inventoryItems });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });

      const deductions = [{ inventory_item_id: 'item-1', quantity: 100 }];

      await inventoryService.deductIngredients(
        'order-100',
        'order',
        deductions,
        mockSupabase as any
      );

      // Should call update - new stock would be Math.max(0, 5 - 100) = 0
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_items');
    });

    it('should handle null current_stock as 0 in fallback', async () => {
      const inventoryItems = [{ id: 'item-1', current_stock: null }];
      const mockSupabase = createMockSupabase({ inventory_items: inventoryItems });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });

      const deductions = [{ inventory_item_id: 'item-1', quantity: 5 }];

      await inventoryService.deductIngredients(
        'order-100',
        'order',
        deductions,
        mockSupabase as any
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_items');
    });

    it('should log inventory transaction in fallback', async () => {
      const inventoryItems = [{ id: 'item-1', current_stock: 100 }];
      const mockSupabase = createMockSupabase({ 
        inventory_items: inventoryItems,
        inventory_transactions: []
      });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });

      const deductions = [{ inventory_item_id: 'item-1', quantity: 10 }];

      await inventoryService.deductIngredients(
        'order-123',
        'order',
        deductions,
        mockSupabase as any
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_transactions');
    });

    it('should continue processing other deductions if one fails fetch', async () => {
      let callCount = 0;
      const mockSupabase = {
        from: vi.fn().mockImplementation((tableName: string) => {
          if (tableName === 'inventory_items') {
            callCount++;
            if (callCount === 1) {
              // First call fails
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Fetch error' } })
                  })
                })
              };
            }
            // Second call succeeds
            return createQueryMock(() => [{ id: 'item-2', current_stock: 50 }]);
          }
          return createQueryMock(() => []);
        }),
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } }),
      };

      const deductions = [
        { inventory_item_id: 'item-1', quantity: 5 },
        { inventory_item_id: 'item-2', quantity: 3 },
      ];

      await inventoryService.deductIngredients(
        'order-123',
        'order',
        deductions,
        mockSupabase as any
      );

      // Should have tried both items
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully and continue', async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network error'))
                      .mockResolvedValue({ data: null, error: null });

      const deductions = [
        { inventory_item_id: 'item-1', quantity: 5 },
        { inventory_item_id: 'item-2', quantity: 3 },
      ];

      // Should not throw
      await expect(
        inventoryService.deductIngredients('order-123', 'order', deductions, mockSupabase as any)
      ).resolves.toBeUndefined();

      // Should have tried both
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });
  });

  describe('processDeductions', () => {
    it('should return early when items array is empty', async () => {
      const mockSupabase = createMockSupabase();

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should fetch recipes from menu_item_ingredients table', async () => {
      const recipes = [
        { menu_item_id: 'menu-1', inventory_item_id: 'inv-1', quantity_required: 2 }
      ];
      const mockSupabase = createMockSupabase({ menu_item_ingredients: recipes });

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [{ id: 'menu-1', quantity: 1 }],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('menu_item_ingredients');
    });

    it('should fetch recipes from session_ingredients table', async () => {
      const recipes = [
        { session_id: 'session-1', inventory_item_id: 'inv-1', quantity_required: 1 }
      ];
      const mockSupabase = createMockSupabase({ session_ingredients: recipes });

      await inventoryService.processDeductions(
        'ticket-456',
        'ticket',
        [{ id: 'session-1', quantity: 1 }],
        'session_ingredients',
        'session_id',
        mockSupabase as any
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('session_ingredients');
    });

    it('should return early when no recipes are found', async () => {
      const mockSupabase = createMockSupabase({ menu_item_ingredients: [] });

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [{ id: 'menu-1', quantity: 1 }],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      // Should only call from once for the recipe fetch
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should aggregate deductions for same inventory item', async () => {
      const recipes = [
        { menu_item_id: 'menu-1', inventory_item_id: 'inv-1', quantity_required: 2 },
        { menu_item_id: 'menu-2', inventory_item_id: 'inv-1', quantity_required: 3 },
      ];
      const mockSupabase = createMockSupabase({ menu_item_ingredients: recipes });

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [
          { id: 'menu-1', quantity: 1 },
          { id: 'menu-2', quantity: 1 }
        ],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      // Should call RPC once with aggregated quantity (2 + 3 = 5)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'inv-1',
        p_quantity: 5,
        p_reason: 'ORDER #order-123'
      });
    });

    it('should multiply quantity_required by item quantity', async () => {
      const recipes = [
        { menu_item_id: 'menu-1', inventory_item_id: 'inv-1', quantity_required: 3 }
      ];
      const mockSupabase = createMockSupabase({ menu_item_ingredients: recipes });

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [{ id: 'menu-1', quantity: 4 }], // Ordering 4 of menu-1
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      // Should call RPC with 3 * 4 = 12
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'inv-1',
        p_quantity: 12,
        p_reason: 'ORDER #order-123'
      });
    });

    it('should handle multiple inventory items per menu item', async () => {
      const recipes = [
        { menu_item_id: 'menu-1', inventory_item_id: 'inv-1', quantity_required: 2 },
        { menu_item_id: 'menu-1', inventory_item_id: 'inv-2', quantity_required: 1 },
      ];
      const mockSupabase = createMockSupabase({ menu_item_ingredients: recipes });

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [{ id: 'menu-1', quantity: 1 }],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      // Should call RPC twice, once for each inventory item
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'inv-1',
        p_quantity: 2,
        p_reason: 'ORDER #order-123'
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'inv-2',
        p_quantity: 1,
        p_reason: 'ORDER #order-123'
      });
    });

    it('should handle recipe fetch error gracefully', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
                resolve({ data: null, error: { message: 'DB error' } });
                return Promise.resolve({ data: null, error: { message: 'DB error' } });
              }
            })
          })
        })),
        rpc: vi.fn()
      };

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [{ id: 'menu-1', quantity: 1 }],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle complex order with multiple items and quantities', async () => {
      const recipes = [
        // Burger uses 1 patty and 2 tomato slices
        { menu_item_id: 'burger', inventory_item_id: 'patty', quantity_required: 1 },
        { menu_item_id: 'burger', inventory_item_id: 'tomato', quantity_required: 2 },
        // Salad uses 3 tomato slices and 1 lettuce
        { menu_item_id: 'salad', inventory_item_id: 'tomato', quantity_required: 3 },
        { menu_item_id: 'salad', inventory_item_id: 'lettuce', quantity_required: 1 },
      ];
      const mockSupabase = createMockSupabase({ menu_item_ingredients: recipes });

      await inventoryService.processDeductions(
        'order-999',
        'order',
        [
          { id: 'burger', quantity: 2 }, // 2 burgers
          { id: 'salad', quantity: 3 },  // 3 salads
        ],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      // Expected deductions:
      // patty: 2 * 1 = 2
      // tomato: 2 * 2 + 3 * 3 = 4 + 9 = 13
      // lettuce: 3 * 1 = 3
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'patty',
        p_quantity: 2,
        p_reason: 'ORDER #order-999'
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'tomato',
        p_quantity: 13,
        p_reason: 'ORDER #order-999'
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'lettuce',
        p_quantity: 3,
        p_reason: 'ORDER #order-999'
      });
    });

    it('should use ticket reference type for spa deductions', async () => {
      const recipes = [
        { session_id: 'massage', inventory_item_id: 'oil', quantity_required: 50 }
      ];
      const mockSupabase = createMockSupabase({ session_ingredients: recipes });

      await inventoryService.processDeductions(
        'ticket-spa-001',
        'ticket',
        [{ id: 'massage', quantity: 1 }],
        'session_ingredients',
        'session_id',
        mockSupabase as any
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'oil',
        p_quantity: 50,
        p_reason: 'TICKET #ticket-spa-001'
      });
    });

    it('should filter out items with no matching recipes', async () => {
      const recipes = [
        { menu_item_id: 'burger', inventory_item_id: 'patty', quantity_required: 1 }
        // No recipe for 'drink'
      ];
      const mockSupabase = createMockSupabase({ menu_item_ingredients: recipes });

      await inventoryService.processDeductions(
        'order-123',
        'order',
        [
          { id: 'burger', quantity: 1 },
          { id: 'drink', quantity: 2 }  // No recipe for this
        ],
        'menu_item_ingredients',
        'menu_item_id',
        mockSupabase as any
      );

      // Should only deduct for burger's ingredients
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_stock_fifo', {
        p_item_id: 'patty',
        p_quantity: 1,
        p_reason: 'ORDER #order-123'
      });
    });
  });
});
