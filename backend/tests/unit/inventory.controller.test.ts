import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// Create a properly chainable Supabase mock
const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
  };

  const builder: any = {};
  
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
  ];
  
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

  return {
    builder,
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => {
      responseQueue = [];
      responseIndex = 0;
    },
  };
};

let mockBuilder: ReturnType<typeof createChainableMock>;
const mockFrom = vi.fn();

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { InventoryController } from '../../src/modules/inventory/inventory.controller';

describe('Inventory Controller', () => {
  let controller: InventoryController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    controller = new InventoryController();
    responseJson = {};
    responseStatus = 200;
    
    mockResponse = {
      status: vi.fn().mockImplementation((code) => {
        responseStatus = code;
        return mockResponse;
      }),
      json: vi.fn().mockImplementation((data) => {
        responseJson = data;
        return mockResponse;
      }),
    };
    
    mockRequest = {
      user: { id: 'staff-123', role: 'staff' },
      params: {},
      query: {},
      body: {},
    };
    
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    vi.clearAllMocks();
    mockFrom.mockReturnValue(mockBuilder.builder);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockBuilder.reset();
  });

  describe('getCategories', () => {
    it('should return all inventory categories', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Cleaning Supplies', description: 'Cleaning products' },
        { id: 'cat-2', name: 'Toiletries', description: 'Bathroom items' },
      ];

      // Get categories
      mockBuilder.queueResponse(mockCategories, null);
      // Get items for stats
      mockBuilder.queueResponse([
        { category_id: 'cat-1', current_stock: 50 },
        { category_id: 'cat-1', current_stock: 30 },
        { category_id: 'cat-2', current_stock: 100 },
      ], null);

      await controller.getCategories(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockFrom).toHaveBeenCalledWith('inventory_categories');
      expect(responseJson.success).toBe(true);
      expect(responseJson.data).toHaveLength(2);
    });

    it('should handle database errors', async () => {
      mockBuilder.queueResponse(null, { message: 'Database error' });

      await controller.getCategories(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      mockRequest.body = {
        name: 'Kitchen Supplies',
        description: 'Kitchen items',
        color: '#FF5733',
      };

      const createdCategory = {
        id: 'cat-new',
        name: 'Kitchen Supplies',
        description: 'Kitchen items',
        color: '#FF5733',
      };

      mockBuilder.queueResponse(createdCategory, null);

      await controller.createCategory(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson.success).toBe(true);
    });

    it('should reject invalid input', async () => {
      mockRequest.body = {
        // missing required name
      };

      await controller.createCategory(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getItems', () => {
    it('should return paginated items', async () => {
      mockRequest.query = { page: '1', limit: '10' };

      const mockItems = [
        { id: 'item-1', name: 'Soap', current_stock: 50 },
        { id: 'item-2', name: 'Towels', current_stock: 30 },
      ];

      mockBuilder.queueResponse(mockItems, null, 100);

      await controller.getItems(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data).toEqual(mockItems);
    });

    it('should filter by category', async () => {
      mockRequest.query = { categoryId: 'cat-1' };

      mockBuilder.queueResponse([{ id: 'item-1', category_id: 'cat-1' }], null, 10);

      await controller.getItems(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });

    it('should filter by low stock', async () => {
      mockRequest.query = { lowStock: 'true' };

      mockBuilder.queueResponse([
        { id: 'item-1', name: 'Soap', current_stock: 5, min_stock_level: 10 },
      ], null, 5);

      await controller.getItems(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });
  });

  describe('createItem', () => {
    it('should create a new item', async () => {
      mockRequest.body = {
        name: 'Hand Soap',
        categoryId: 'cat-1',
        unit: 'bottle',
        currentStock: 100,
        minStockLevel: 20,
        reorderPoint: 10,
      };

      const createdItem = {
        id: 'item-new',
        name: 'Hand Soap',
        category_id: 'cat-1',
        current_stock: 100,
      };

      mockBuilder.queueResponse(createdItem, null);

      await controller.createItem(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson.success).toBe(true);
    });
  });

  describe('recordTransaction', () => {
    it('should record stock in transaction', async () => {
      mockRequest.body = {
        itemId: 'item-1',
        type: 'in',
        quantity: 50,
        reason: 'Restocking',
      };

      // Get current item
      mockBuilder.queueResponse({
        id: 'item-1',
        name: 'Soap',
        current_stock: 100,
      }, null);
      
      // Update stock
      mockBuilder.queueResponse({
        id: 'item-1',
        current_stock: 150,
      }, null);
      
      // Insert transaction
      mockBuilder.queueResponse({
        id: 'txn-1',
        item_id: 'item-1',
        type: 'in',
        quantity: 50,
      }, null);

      await controller.recordTransaction(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });

    it('should record stock out transaction', async () => {
      mockRequest.body = {
        itemId: 'item-1',
        type: 'out',
        quantity: 20,
        reason: 'Used for cleaning',
      };

      mockBuilder.queueResponse({
        id: 'item-1',
        current_stock: 100,
      }, null);
      
      mockBuilder.queueResponse({
        id: 'item-1',
        current_stock: 80,
      }, null);
      
      mockBuilder.queueResponse({
        id: 'txn-1',
        type: 'out',
      }, null);

      await controller.recordTransaction(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });

    it('should reject insufficient stock', async () => {
      mockRequest.body = {
        itemId: 'item-1',
        type: 'out',
        quantity: 200,
      };

      mockBuilder.queueResponse({
        id: 'item-1',
        current_stock: 50,
      }, null);

      await controller.recordTransaction(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getAlerts', () => {
    it('should return items below reorder point', async () => {
      const lowStockItems = [
        { id: 'item-1', name: 'Soap', current_stock: 5, reorder_point: 10 },
        { id: 'item-2', name: 'Towels', current_stock: 3, reorder_point: 15 },
      ];

      mockBuilder.queueResponse(lowStockItems, null);

      await controller.getAlerts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return inventory stats', async () => {
      // Total items
      mockBuilder.queueResponse([{ id: '1' }, { id: '2' }], null, 100);
      // Low stock items
      mockBuilder.queueResponse([{ id: '3' }], null, 5);
      // Categories
      mockBuilder.queueResponse([{ id: 'cat-1' }, { id: 'cat-2' }], null, 10);

      await controller.getStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });
  });
});
