/**
 * Snack Controller Tests
 * 
 * Tests the snack module controller functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils.js';

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn()
}));

vi.mock('../../../src/validation/schemas.js', () => ({
  createSnackOrderSchema: {},
  validateBody: vi.fn((schema, body) => body)
}));

import { getSupabase } from '../../../src/database/connection.js';
import { emitToUnit } from '../../../src/socket/index.js';
import { validateBody } from '../../../src/validation/schemas.js';
import * as snackController from '../../../src/modules/snack/snack.controller.js';

// Helper to create supabase mock with from method
function createSupabaseMock(tableHandlers: Record<string, any>) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (tableHandlers[table]) {
        return tableHandlers[table];
      }
      return createChainableMock([]);
    })
  };
}

describe('Snack Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getItems', () => {
    it('should return all items', async () => {
      const mockItems = [
        { id: 'item-1', name: 'Sandwich', price: '5.00' },
        { id: 'item-2', name: 'Cola', price: '2.00' }
      ];
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(mockItems) }) as any
      );

      const { req, res, next } = createMockReqRes({ query: {} });
      
      await snackController.getItems(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems
      });
    });

    it('should filter by category', async () => {
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock([]) }) as any
      );

      const { req, res, next } = createMockReqRes({ 
        query: { category: 'drink' } 
      });
      
      await snackController.getItems(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should filter by availability', async () => {
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock([]) }) as any
      );

      const { req, res, next } = createMockReqRes({ 
        query: { available: 'true' } 
      });
      
      await snackController.getItems(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should filter by moduleId', async () => {
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock([]) }) as any
      );

      const { req, res, next } = createMockReqRes({ 
        query: { moduleId: 'module-123' } 
      });
      
      await snackController.getItems(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(null, new Error('DB error')) }) as any
      );

      const { req, res, next } = createMockReqRes({ query: {} });
      
      await snackController.getItems(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getItem', () => {
    it('should return single item by id', async () => {
      const mockItem = { id: 'item-1', name: 'Sandwich', price: '5.00' };
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(mockItem) }) as any
      );

      const { req, res, next } = createMockReqRes({ 
        params: { id: 'item-1' } 
      });
      
      await snackController.getItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem
      });
    });

    it('should return 404 for non-existent item', async () => {
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(null, { code: 'PGRST116' }) }) as any
      );

      const { req, res, next } = createMockReqRes({ 
        params: { id: 'non-existent' } 
      });
      
      await snackController.getItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Item not found'
      });
    });
  });

  describe('createOrder', () => {
    it('should create order with valid data', async () => {
      const mockOrder = { id: 'order-1', order_number: 'S-240115-123456abc' };
      const mockItems = [
        { id: 'item-1', name: 'Sandwich', price: '5.00', is_available: true }
      ];

      // Mock for getting items
      const supabaseMock = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'snack_items') {
            return createChainableMock(mockItems);
          }
          if (table === 'snack_orders') {
            return createChainableMock(mockOrder);
          }
          if (table === 'snack_order_items') {
            return createChainableMock([]);
          }
          return createChainableMock([]);
        })
      };

      vi.mocked(getSupabase).mockReturnValue(supabaseMock as any);
      vi.mocked(validateBody).mockReturnValue({
        customerName: 'John Doe',
        items: [{ itemId: 'item-1', quantity: 2 }],
        paymentMethod: 'cash'
      });

      const { req, res, next } = createMockReqRes({ 
        body: {
          customerName: 'John Doe',
          items: [{ itemId: 'item-1', quantity: 2 }],
          paymentMethod: 'cash'
        }
      });
      
      await snackController.createOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(emitToUnit).toHaveBeenCalledWith(
        'snack_bar',
        'order:new',
        expect.any(Object)
      );
    });

    it('should handle item not found error', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock([]))
      } as any);

      vi.mocked(validateBody).mockReturnValue({
        items: [{ itemId: 'non-existent', quantity: 1 }],
        paymentMethod: 'cash'
      });

      const { req, res, next } = createMockReqRes({ 
        body: {
          items: [{ itemId: 'non-existent', quantity: 1 }]
        }
      });
      
      await snackController.createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getOrder', () => {
    it('should return order with items', async () => {
      const mockOrder = { id: 'order-1', status: 'pending' };
      const mockItems = [{ id: 'item-1', quantity: 2 }];

      const supabaseMock = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'snack_orders') {
            return createChainableMock(mockOrder);
          }
          if (table === 'snack_order_items') {
            return createChainableMock(mockItems);
          }
          return createChainableMock([]);
        })
      };

      vi.mocked(getSupabase).mockReturnValue(supabaseMock as any);

      const { req, res, next } = createMockReqRes({ 
        params: { id: 'order-1' } 
      });
      
      await snackController.getOrder(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'order-1',
          items: expect.any(Array)
        })
      });
    });

    it('should return 404 for non-existent order', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116' })
        )
      } as any);

      const { req, res, next } = createMockReqRes({ 
        params: { id: 'non-existent' } 
      });
      
      await snackController.getOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getOrderStatus', () => {
    it('should return order status with items', async () => {
      const mockOrder = { id: 'order-1', status: 'preparing' };
      const mockItems = [{ id: 'item-1', quantity: 1 }];

      const supabaseMock = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'snack_orders') {
            return createChainableMock(mockOrder);
          }
          if (table === 'snack_order_items') {
            return createChainableMock(mockItems);
          }
          return createChainableMock([]);
        })
      };

      vi.mocked(getSupabase).mockReturnValue(supabaseMock as any);

      const { req, res, next } = createMockReqRes({ 
        params: { id: 'order-1' } 
      });
      
      await snackController.getOrderStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'preparing',
          items: expect.any(Array)
        })
      });
    });

    it('should return 404 for non-existent order', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116' })
        )
      } as any);

      const { req, res, next } = createMockReqRes({ 
        params: { id: 'non-existent' } 
      });
      
      await snackController.getOrderStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyOrders', () => {
    it('should return user orders', async () => {
      const mockOrders = [{ id: 'order-1' }, { id: 'order-2' }];
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_orders: createChainableMock(mockOrders) }) as any
      );

      const { req, res, next } = createMockReqRes({});
      (req as any).user = { userId: 'user-123' };
      
      await snackController.getMyOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrders
      });
    });

    it('should return 401 if not authenticated', async () => {
      const { req, res, next } = createMockReqRes({});
      (req as any).user = undefined;
      
      await snackController.getMyOrders(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('getStaffOrders', () => {
    it('should return all orders for staff', async () => {
      const mockOrders = [
        { id: 'order-1', items: [{ id: 'i1', quantity: 1, unit_price: '5.00', snack_items: { name: 'Test' } }] }
      ];
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_orders: createChainableMock(mockOrders) }) as any
      );

      const { req, res, next } = createMockReqRes({});
      
      await snackController.getStaffOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
  });

  describe('getLiveOrders', () => {
    it('should return active orders', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'pending', items: [] },
        { id: 'order-2', status: 'preparing', items: [] }
      ];
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_orders: createChainableMock(mockOrders) }) as any
      );

      const { req, res, next } = createMockReqRes({});
      
      await snackController.getLiveOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const mockOrder = { id: 'order-1', status: 'preparing', order_number: 'S-001' };
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_orders: createChainableMock(mockOrder) }) as any
      );

      const { req, res, next } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'preparing' }
      });
      
      await snackController.updateOrderStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrder
      });
      expect(emitToUnit).toHaveBeenCalledWith(
        'snack_bar',
        'order:updated',
        expect.objectContaining({ status: 'preparing' })
      );
    });

    it('should mark as paid when completed', async () => {
      const mockOrder = { id: 'order-1', status: 'completed', order_number: 'S-001' };
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_orders: createChainableMock(mockOrder) }) as any
      );

      const { req, res, next } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'completed' }
      });
      
      await snackController.updateOrderStatus(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('createItem', () => {
    it('should create new item', async () => {
      const mockItem = { id: 'item-1', name: 'New Sandwich', price: '7.00' };
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(mockItem) }) as any
      );

      const { req, res, next } = createMockReqRes({
        body: { name: 'New Sandwich', price: 7.00 }
      });
      
      await snackController.createItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem
      });
    });

    it('should require name', async () => {
      const { req, res, next } = createMockReqRes({
        body: { price: 7.00 }
      });
      
      await snackController.createItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name is required'
      });
    });

    it('should require price', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'Test Item' }
      });
      
      await snackController.createItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Price is required'
      });
    });
  });

  describe('updateItem', () => {
    it('should update item fields', async () => {
      const mockItem = { id: 'item-1', name: 'Updated Name', price: '8.00' };
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(mockItem) }) as any
      );

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { name: 'Updated Name', price: 8.00 }
      });
      
      await snackController.updateItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem
      });
    });

    it('should handle both camelCase and snake_case', async () => {
      const mockItem = { id: 'item-1', name_ar: 'اسم عربي' };
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(mockItem) }) as any
      );

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { nameAr: 'اسم عربي' }
      });
      
      await snackController.updateItem(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('should soft delete item', async () => {
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock({}) }) as any
      );

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' }
      });
      
      await snackController.deleteItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item deleted'
      });
    });
  });

  describe('toggleAvailability', () => {
    it('should toggle item availability', async () => {
      const mockItem = { id: 'item-1', is_available: false };
      
      vi.mocked(getSupabase).mockReturnValue(
        createSupabaseMock({ snack_items: createChainableMock(mockItem) }) as any
      );

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { isAvailable: false }
      });
      
      await snackController.toggleAvailability(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem
      });
    });
  });

  describe('Categories', () => {
    it('getCategories should return static categories', async () => {
      const { req, res, next } = createMockReqRes({});
      
      await snackController.getCategories(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'sandwich' }),
          expect.objectContaining({ id: 'drink' }),
          expect.objectContaining({ id: 'snack' }),
          expect.objectContaining({ id: 'ice_cream' })
        ])
      });
    });

    it('createCategory should return 405', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'New Category' }
      });
      
      await snackController.createCategory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('updateCategory should return 405', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'cat-1' },
        body: { name: 'Updated' }
      });
      
      await snackController.updateCategory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('deleteCategory should return 405', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'cat-1' }
      });
      
      await snackController.deleteCategory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(405);
    });
  });
});
