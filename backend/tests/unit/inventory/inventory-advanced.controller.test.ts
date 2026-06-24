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

  builder.single = vi.fn().mockImplementation(() => {
    return Promise.resolve(getNextResponse());
  });
  builder.maybeSingle = vi.fn().mockImplementation(() => {
    return Promise.resolve(getNextResponse());
  });
  builder.then = (resolve: any, reject: any) => {
    return Promise.resolve(getNextResponse()).then(resolve, reject);
  };

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
const mockRpc = vi.fn();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { InventoryAdvancedController } from '../../../src/modules/inventory/inventory-advanced.controller';

describe('Inventory Advanced Controller', () => {
  let controller: InventoryAdvancedController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    controller = new InventoryAdvancedController();
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
      user: { userId: 'staff-123', role: 'staff' },
      params: {},
      query: {},
      body: {},
    };
    
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    mockRpc.mockResolvedValue({ data: null, error: null });
    vi.clearAllMocks();
    mockFrom.mockReturnValue(mockBuilder.builder);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockBuilder.reset();
  });

  describe('recordWastage', () => {
    it('should record wastage successfully', async () => {
      const mockItem = { id: 'item-1', cost_per_unit: '5.00' };
      const mockWastage = { 
        id: 'wastage-1', 
        item_id: 'item-1', 
        quantity: 5, 
        approval_status: 'approved' 
      };
      
      mockBuilder.queueResponse(mockItem); // item lookup
      mockBuilder.queueResponse(mockWastage); // wastage insert
      mockRpc.mockResolvedValue({ data: null, error: null });
      
      mockRequest.body = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 5,
        reason: 'expired',
        notes: 'Test wastage',
      };
      
      await controller.recordWastage(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should return 400 for invalid data', async () => {
      mockRequest.body = {
        itemId: 'not-a-uuid',
        quantity: -5,
      };
      
      await controller.recordWastage(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseJson.success).toBe(false);
    });

    it('should return 404 for non-existent item', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116', message: 'Not found' });
      
      mockRequest.body = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 5,
        reason: 'expired',
      };
      
      await controller.recordWastage(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('approveWastage', () => {
    it('should approve wastage successfully', async () => {
      const mockWastage = { id: 'wastage-1', item_id: 'item-1', quantity: 5, approval_status: 'pending' };
      const updatedWastage = { ...mockWastage, approval_status: 'approved' };
      
      mockBuilder.queueResponse(mockWastage); // fetch wastage
      mockBuilder.queueResponse(updatedWastage); // update wastage
      mockRpc.mockResolvedValue({ data: null, error: null });
      
      mockRequest.params = { id: 'wastage-1' };
      mockRequest.body = { approved: true };
      
      await controller.approveWastage(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should reject wastage when not approved', async () => {
      const mockWastage = { id: 'wastage-1', item_id: 'item-1', quantity: 5, approval_status: 'pending' };
      const rejectedWastage = { ...mockWastage, approval_status: 'rejected' };
      
      mockBuilder.queueResponse(mockWastage);
      mockBuilder.queueResponse(rejectedWastage);
      
      mockRequest.params = { id: 'wastage-1' };
      mockRequest.body = { approved: false };
      
      await controller.approveWastage(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('recordPhysicalCount', () => {
    it('should record physical count and calculate variance', async () => {
      const mockItem = { id: 'item-1', name: 'Test Item', quantity_on_hand: 100, cost_per_unit: '5.00' };
      const mockCount = { id: 'count-1', item_id: 'item-1', actual_quantity: 95, variance: -5 };
      
      mockBuilder.queueResponse(mockItem);
      mockBuilder.queueResponse(mockCount);
      mockBuilder.queueResponse({ id: 'item-1', quantity_on_hand: 95 }); // update quantity
      
      mockRequest.body = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        actualQuantity: 95,
        notes: 'Monthly count',
      };
      
      await controller.recordPhysicalCount(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should return 400 for invalid count data', async () => {
      mockRequest.body = {
        itemId: 'not-a-uuid',
        actualQuantity: -10,
      };
      
      await controller.recordPhysicalCount(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getVarianceReport', () => {
    it('should return variance report', async () => {
      const mockVariances = [
        { item_id: 'item-1', item_name: 'Item 1', variance: -5, variance_percentage: -5.0 },
        { item_id: 'item-2', item_name: 'Item 2', variance: 3, variance_percentage: 3.0 },
      ];
      
      mockBuilder.queueResponse(mockVariances);
      
      mockRequest.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
      
      await controller.getVarianceReport(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('createPurchaseOrder', () => {
    it('should create a purchase order', async () => {
      const mockPO = { 
        id: 'po-1', 
        supplier_id: 'supplier-1', 
        status: 'pending',
        items: [] 
      };
      
      mockBuilder.queueResponse(mockPO); // insert PO
      mockBuilder.queueResponse([{ id: 'poi-1', purchase_order_id: 'po-1' }]); // insert PO items
      
      mockRequest.body = {
        supplierId: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          { itemId: '123e4567-e89b-12d3-a456-426614174001', quantity: 50, unitCost: 10 },
        ],
      };
      
      await controller.createPurchaseOrder(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should return 400 for invalid PO data', async () => {
      mockRequest.body = {
        supplierId: 'not-a-uuid',
        items: [],
      };
      
      await controller.createPurchaseOrder(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('receivePurchaseOrder', () => {
    it('should receive and update inventory from PO', async () => {
      const mockPO = { id: 'po-1', status: 'pending' };
      const updatedPO = { ...mockPO, status: 'received' };
      
      mockBuilder.queueResponse(mockPO); // fetch PO
      mockBuilder.queueResponse(updatedPO); // update PO status
      mockRpc.mockResolvedValue({ data: null, error: null }); // add stock
      
      mockRequest.params = { id: 'po-1' };
      mockRequest.body = {
        items: [
          { itemId: '123e4567-e89b-12d3-a456-426614174001', quantityReceived: 50 },
        ],
      };
      
      await controller.receivePurchaseOrder(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('getSuppliers', () => {
    it('should return all suppliers', async () => {
      const mockSuppliers = [
        { id: 'sup-1', name: 'Supplier A', contact_email: 'a@test.com' },
        { id: 'sup-2', name: 'Supplier B', contact_email: 'b@test.com' },
      ];
      
      mockBuilder.queueResponse(mockSuppliers);
      
      await controller.getSuppliers(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockSuppliers,
      }));
    });
  });

  describe('createSupplier', () => {
    it('should create a new supplier', async () => {
      const mockSupplier = { id: 'sup-1', name: 'New Supplier' };
      
      mockBuilder.queueResponse(mockSupplier);
      
      mockRequest.body = {
        name: 'New Supplier',
        contactEmail: 'supplier@test.com',
        phone: '123-456-7890',
      };
      
      await controller.createSupplier(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('getItemBatches', () => {
    it('should return batches for an item', async () => {
      const mockBatches = [
        { id: 'batch-1', item_id: 'item-1', batch_number: 'B001', quantity: 50 },
        { id: 'batch-2', item_id: 'item-1', batch_number: 'B002', quantity: 30 },
      ];
      
      mockBuilder.queueResponse(mockBatches);
      
      mockRequest.params = { itemId: 'item-1' };
      
      await controller.getItemBatches(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockBatches,
      }));
    });
  });

  describe('createRecipe', () => {
    it('should create a recipe with ingredients', async () => {
      const mockRecipe = { 
        id: 'recipe-1', 
        name: 'Test Recipe',
        catalog_item_id: 'menu-1' 
      };
      
      mockBuilder.queueResponse(mockRecipe); // insert recipe
      mockBuilder.queueResponse([{ id: 'ing-1', recipe_id: 'recipe-1' }]); // insert ingredients
      
      mockRequest.body = {
        name: 'Test Recipe',
        menuItemId: '123e4567-e89b-12d3-a456-426614174000',
        yieldQuantity: 10,
        ingredients: [
          { itemId: '123e4567-e89b-12d3-a456-426614174001', quantity: 2, unit: 'kg' },
        ],
      };
      
      await controller.createRecipe(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getRecipe', () => {
    it('should return a recipe with ingredients', async () => {
      const mockRecipe = {
        id: 'recipe-1',
        name: 'Test Recipe',
        yields: 1,
        ingredients: [
          { id: 'ing-1', inventory_item: { name: 'Flour', cost_per_unit: '2.00', current_stock: '100' }, quantity: 2 },
        ],
      };
      
      mockBuilder.queueResponse(mockRecipe);
      
      mockRequest.params = { menuItemId: 'menu-1' };
      
      await controller.getRecipe(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          name: 'Test Recipe',
        }),
      }));
    });

    it('should return null data for non-existent recipe', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });
      
      mockRequest.params = { menuItemId: 'nonexistent' };
      
      await controller.getRecipe(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: null,
      }));
    });
  });

  describe('updateRecipe', () => {
    it('should update an existing recipe', async () => {
      const mockRecipe = { id: 'recipe-1', name: 'Updated Recipe' };
      
      mockBuilder.queueResponse(mockRecipe); // update recipe
      mockBuilder.queueResponse(null); // delete old ingredients
      mockBuilder.queueResponse([{ id: 'ing-1' }]); // insert new ingredients
      
      mockRequest.params = { id: 'recipe-1' };
      mockRequest.body = {
        name: 'Updated Recipe',
        yieldQuantity: 15,
        ingredients: [
          { itemId: '123e4567-e89b-12d3-a456-426614174001', quantity: 3, unit: 'kg' },
        ],
      };
      
      await controller.updateRecipe(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('deductForOrder', () => {
    it('should deduct inventory for an order', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });
      
      mockRequest.body = {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          { menuItemId: 'menu-1', quantity: 2 },
        ],
      };
      
      await controller.deductForOrder(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('getMenuItemCostAnalysis', () => {
    it('should return cost analysis for a menu item', async () => {
      const mockRecipe = {
        id: 'recipe-1',
        name: 'Test Recipe',
        yield_quantity: 10,
        ingredients: [
          { item: { cost_per_unit: 5 }, quantity: 2 },
        ],
      };
      const mockMenuItem = { id: 'menu-1', name: 'Dish', price: 25 };
      
      mockBuilder.queueResponse(mockRecipe); // get recipe
      mockBuilder.queueResponse(mockMenuItem); // get menu item
      
      mockRequest.params = { menuItemId: 'menu-1' };
      
      await controller.getMenuItemCostAnalysis(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('getDashboardStats', () => {
    it('should return inventory dashboard statistics', async () => {
      const mockItems = [{ id: 'item-1', quantity_on_hand: 50, reorder_level: 20 }];
      const mockLowStock = [{ id: 'item-2' }];
      const mockExpiring = [{ id: 'batch-1' }];
      const mockWastage = [{ cost_impact: 100 }];
      
      mockBuilder.queueResponse(mockItems);
      mockBuilder.queueResponse(mockLowStock);
      mockBuilder.queueResponse(mockExpiring);
      mockBuilder.queueResponse(mockWastage);
      
      await controller.getDashboardStats(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });
});
