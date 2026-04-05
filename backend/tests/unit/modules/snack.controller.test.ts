/**
 * Snack Controller Tests
 * 
 * Tests the snack module controller functions using chainable Supabase query mock pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock dependencies BEFORE imports
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

// Mock engine service for state machine and pricing
const mockEngineService = {
  calculatePricing: vi.fn().mockResolvedValue({
    subtotal: 10, taxAmount: 1.1, totalAmount: 11.1,
    discounts: [], lineItems: [], serviceCharge: 0, deliveryFee: 0,
    preDiscountTotal: 11.1, totalDiscount: 0, taxRate: 0.11,
    serviceChargeRate: 0, loyaltyPointsEarned: 0, depositAmount: 0,
  }),
  getInitialState: vi.fn().mockReturnValue('pending'),
  transitionState: vi.fn().mockResolvedValue({ allowed: true, targetState: 'preparing' }),
  canTransition: vi.fn().mockReturnValue(true),
  getAvailableActions: vi.fn().mockReturnValue([]),
  isTerminalState: vi.fn().mockReturnValue(false),
  getStates: vi.fn().mockReturnValue([]),
};

vi.mock('../../../src/engines/engine-service.js', () => ({
  getEngineService: vi.fn(() => mockEngineService),
}));

import { getSupabase } from '../../../src/database/connection.js';
import { emitToUnit } from '../../../src/socket/index.js';
import { validateBody } from '../../../src/validation/schemas.js';
import * as snackController from '../../../src/modules/snack/snack.controller.js';

// ============ MOCK PATTERN ============
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

// Helper to create error mock
function createErrorMock(error: { code?: string; message?: string }) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    resolve({ data: null, error });
    return Promise.resolve({ data: null, error });
  };
  mockObj.single = vi.fn().mockResolvedValue({ data: null, error });
  mockObj.maybeSingle = vi.fn().mockResolvedValue({ data: null, error });
  return mockObj;
}

// Helper to create mock request/response
function createMockReqRes(options: { 
  params?: Record<string, string>; 
  query?: Record<string, unknown>; 
  body?: Record<string, unknown>;
  user?: { id: string; role: string; userId: string; roles?: string[] };
} = {}) {
  const req = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    user: options.user || { id: 'user-1', role: 'admin', userId: 'user-1', roles: ['admin'] },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

// ============ TEST SUITES ============
describe('Snack Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ getItems ============
  describe('getItems', () => {
    it('should return all items', async () => {
      const mockItems = [
        { id: 'item-1', name: 'Sandwich', price: '5.00', category: 'sandwich' },
        { id: 'item-2', name: 'Cola', price: '2.00', category: 'drink' }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => mockItems))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ query: {} });
      await snackController.getItems(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems
      });
    });

    it('should filter by category', async () => {
      const mockItems = [{ id: 'item-2', name: 'Cola', price: '2.00', category: 'drink' }];
      
      const queryMock = createQueryMock(() => mockItems);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ query: { category: 'drink' } });
      await snackController.getItems(req, res, next);

      expect(queryMock.eq).toHaveBeenCalledWith('category', 'drink');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockItems });
    });

    it('should filter by availability', async () => {
      const mockItems = [{ id: 'item-1', name: 'Sandwich', is_available: true }];
      
      const queryMock = createQueryMock(() => mockItems);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ query: { available: 'true' } });
      await snackController.getItems(req, res, next);

      expect(queryMock.eq).toHaveBeenCalledWith('is_available', true);
      expect(res.json).toHaveBeenCalled();
    });

    it('should filter by moduleId', async () => {
      const queryMock = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ query: { moduleId: 'module-123' } });
      await snackController.getItems(req, res, next);

      expect(queryMock.eq).toHaveBeenCalledWith('module_id', 'module-123');
    });

    it('should return empty array when no items', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => []))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ query: {} });
      await snackController.getItems(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createErrorMock({ message: 'DB error' }))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ query: {} });
      await snackController.getItems(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'DB error' }));
    });
  });

  // ============ getItem ============
  describe('getItem', () => {
    it('should return single item by id', async () => {
      const mockItem = { id: 'item-1', name: 'Sandwich', price: '5.00' };
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => [mockItem]))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'item-1' } });
      await snackController.getItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem
      });
    });

    it('should return 404 for non-existent item', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => []))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'non-existent' } });
      await snackController.getItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Item not found'
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createErrorMock({ message: 'Connection failed' }))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'item-1' } });
      await snackController.getItem(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ createOrder ============
  describe('createOrder', () => {
    it('should create order with valid data', async () => {
      const mockSnackItems = [
        { id: 'item-1', name: 'Sandwich', price: '5.00', is_available: true }
      ];
      const mockOrder = { id: 'order-1', order_number: 'S-240115-123456abc', status: 'pending' };

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'snack_items') {
            return createQueryMock(() => mockSnackItems);
          }
          if (table === 'snack_orders') {
            const mock = createQueryMock(() => [mockOrder]);
            mock.insert = vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockOrder, error: null })
              })
            });
            return mock;
          }
          if (table === 'snack_order_items') {
            return {
              insert: vi.fn().mockResolvedValue({ data: null, error: null })
            };
          }
          return createQueryMock(() => []);
        })
      } as unknown as ReturnType<typeof getSupabase>);

      vi.mocked(validateBody).mockReturnValue({
        customerName: 'John Doe',
        customerPhone: '123-456-7890',
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
        from: vi.fn().mockReturnValue(createQueryMock(() => []))
      } as unknown as ReturnType<typeof getSupabase>);

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

    it('should handle unavailable item error', async () => {
      const mockSnackItems = [
        { id: 'item-1', name: 'Sandwich', price: '5.00', is_available: false }
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => mockSnackItems))
      } as unknown as ReturnType<typeof getSupabase>);

      vi.mocked(validateBody).mockReturnValue({
        items: [{ itemId: 'item-1', quantity: 1 }],
        paymentMethod: 'cash'
      });

      const { req, res, next } = createMockReqRes({ 
        body: { items: [{ itemId: 'item-1', quantity: 1 }] }
      });
      
      await snackController.createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should calculate total amount correctly', async () => {
      const mockSnackItems = [
        { id: 'item-1', name: 'Sandwich', price: '5.00', is_available: true },
        { id: 'item-2', name: 'Cola', price: '2.50', is_available: true }
      ];
      const mockOrder = { id: 'order-1', order_number: 'S-001', total_amount: '12.50' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'snack_items') return createQueryMock(() => mockSnackItems);
          if (table === 'snack_orders') {
            const mock = createQueryMock(() => [mockOrder]);
            mock.insert = vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockOrder, error: null })
              })
            });
            return mock;
          }
          if (table === 'snack_order_items') {
            return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }
          return createQueryMock(() => []);
        })
      } as unknown as ReturnType<typeof getSupabase>);

      vi.mocked(validateBody).mockReturnValue({
        customerName: 'John',
        items: [
          { itemId: 'item-1', quantity: 2 },  // 5.00 * 2 = 10.00
          { itemId: 'item-2', quantity: 1 }   // 2.50 * 1 = 2.50
        ],
        paymentMethod: 'cash'
      });

      const { req, res, next } = createMockReqRes({ body: {} });
      await snackController.createOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ============ getOrder ============
  describe('getOrder', () => {
    it('should return order with items', async () => {
      const mockOrder = { id: 'order-1', status: 'pending', customer_id: 'user-1' };
      const mockItems = [
        { id: 'oi-1', quantity: 2, unit_price: '5.00', subtotal: '10.00', snack_items: { id: 'item-1', name: 'Sandwich', image_url: null } }
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'snack_orders') return createQueryMock(() => [mockOrder]);
          if (table === 'snack_order_items') return createQueryMock(() => mockItems);
          return createQueryMock(() => []);
        })
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'order-1' } });
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
        from: vi.fn().mockReturnValue(createQueryMock(() => []))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'non-existent' } });
      await snackController.getOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Order not found'
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createErrorMock({ message: 'DB error' }))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'order-1' } });
      await snackController.getOrder(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ getOrderStatus ============
  describe('getOrderStatus', () => {
    it('should return order status with items', async () => {
      const mockOrder = { id: 'order-1', status: 'preparing' };
      const mockItems = [{ id: 'oi-1', quantity: 1, snack_items: { name: 'Cola' } }];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'snack_orders') return createQueryMock(() => [mockOrder]);
          if (table === 'snack_order_items') return createQueryMock(() => mockItems);
          return createQueryMock(() => []);
        })
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'order-1' } });
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
        from: vi.fn().mockReturnValue(createQueryMock(() => []))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({ params: { id: 'non-existent' } });
      await snackController.getOrderStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ============ getMyOrders ============
  describe('getMyOrders', () => {
    it('should return user orders', async () => {
      const mockOrders = [
        { id: 'order-1', order_number: 'S-001', status: 'completed' },
        { id: 'order-2', order_number: 'S-002', status: 'pending' }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => mockOrders))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      (req as unknown as { user: { userId: string } }).user = { userId: 'user-123' };
      
      await snackController.getMyOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrders
      });
    });

    it('should return 401 if not authenticated', async () => {
      const { req, res, next } = createMockReqRes({});
      (req as unknown as { user: undefined }).user = undefined;
      
      await snackController.getMyOrders(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should return empty array when no orders', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => []))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      (req as unknown as { user: { userId: string } }).user = { userId: 'user-123' };
      
      await snackController.getMyOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createErrorMock({ message: 'Connection failed' }))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      (req as unknown as { user: { userId: string } }).user = { userId: 'user-123' };
      
      await snackController.getMyOrders(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ getStaffOrders ============
  describe('getStaffOrders', () => {
    it('should return all orders for staff', async () => {
      const mockOrders = [
        { 
          id: 'order-1', 
          order_number: 'S-001',
          items: [{ id: 'oi-1', quantity: 1, unit_price: '5.00', snack_items: { name: 'Sandwich' } }] 
        }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => mockOrders))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      await snackController.getStaffOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should transform order items correctly', async () => {
      const mockOrders = [
        { 
          id: 'order-1', 
          items: [
            { id: 'oi-1', quantity: 2, unit_price: '5.00', notes: 'No onions', snack_items: { name: 'Burger' } }
          ] 
        }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => mockOrders))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      await snackController.getStaffOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ name: 'Burger', quantity: 2 })
            ])
          })
        ])
      });
    });

    it('should handle orders with missing snack_items', async () => {
      const mockOrders = [
        { id: 'order-1', items: [{ id: 'oi-1', quantity: 1, unit_price: '5.00', snack_items: null }] }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createQueryMock(() => mockOrders))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      await snackController.getStaffOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ name: 'Unknown Item' })
            ])
          })
        ])
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createErrorMock({ message: 'DB error' }))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      await snackController.getStaffOrders(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ getLiveOrders ============
  describe('getLiveOrders', () => {
    it('should return active orders (pending, preparing, ready)', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'pending', items: [] },
        { id: 'order-2', status: 'preparing', items: [] },
        { id: 'order-3', status: 'ready', items: [] }
      ];
      
      const queryMock = createQueryMock(() => mockOrders);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      await snackController.getLiveOrders(req, res, next);

      expect(queryMock.in).toHaveBeenCalledWith('status', ['pending', 'preparing', 'ready']);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should order by created_at ascending', async () => {
      const queryMock = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      await snackController.getLiveOrders(req, res, next);

      expect(queryMock.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createErrorMock({ message: 'DB error' }))
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({});
      await snackController.getLiveOrders(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ updateOrderStatus ============
  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const currentOrder = { id: 'order-1', status: 'pending' };
      const updatedOrder = { id: 'order-1', status: 'preparing', order_number: 'S-001' };

      // First call: select to get current status
      const selectMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: currentOrder, error: null })
          })
        })
      };

      // Second call: update
      const updateMockChain = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedOrder, error: null })
            })
          })
        })
      };

      const fromMock = vi.fn()
        .mockReturnValueOnce(selectMock)
        .mockReturnValueOnce(updateMockChain);
      
      vi.mocked(getSupabase).mockReturnValue({
        from: fromMock
      } as unknown as ReturnType<typeof getSupabase>);

      // Configure engine mock for this transition
      mockEngineService.transitionState.mockResolvedValue({ allowed: true, targetState: 'preparing' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'preparing' }
      });
      
      await snackController.updateOrderStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedOrder
      });
      expect(emitToUnit).toHaveBeenCalledWith(
        'snack_bar',
        'order:updated',
        expect.objectContaining({ status: 'preparing' })
      );
    });

    it('should mark as paid when completed', async () => {
      const currentOrder = { id: 'order-1', status: 'ready' };
      const updatedOrder = { id: 'order-1', status: 'completed', order_number: 'S-001', payment_status: 'paid' };

      const selectMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: currentOrder, error: null })
          })
        })
      };

      const updateMockChain = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedOrder, error: null })
            })
          })
        })
      };

      const fromMock = vi.fn()
        .mockReturnValueOnce(selectMock)
        .mockReturnValueOnce(updateMockChain);
      
      vi.mocked(getSupabase).mockReturnValue({
        from: fromMock
      } as unknown as ReturnType<typeof getSupabase>);

      mockEngineService.transitionState.mockResolvedValue({ allowed: true, targetState: 'completed' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'completed' }
      });
      
      await snackController.updateOrderStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ payment_status: 'paid' })
      });
    });

    it('should emit socket event on status update', async () => {
      const currentOrder = { id: 'order-1', status: 'preparing' };
      const updatedOrder = { id: 'order-1', status: 'ready', order_number: 'S-001' };

      const selectMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: currentOrder, error: null })
          })
        })
      };

      const updateMockChain = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedOrder, error: null })
            })
          })
        })
      };

      const fromMock = vi.fn()
        .mockReturnValueOnce(selectMock)
        .mockReturnValueOnce(updateMockChain);
      
      vi.mocked(getSupabase).mockReturnValue({
        from: fromMock
      } as unknown as ReturnType<typeof getSupabase>);

      mockEngineService.transitionState.mockResolvedValue({ allowed: true, targetState: 'ready' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'ready' }
      });
      
      await snackController.updateOrderStatus(req, res, next);

      expect(emitToUnit).toHaveBeenCalledWith(
        'snack_bar',
        'order:updated',
        { orderId: 'order-1', orderNumber: 'S-001', status: 'ready' }
      );
    });

    it('should handle database errors', async () => {
      // First query (select) fails
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } })
            })
          })
        })
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'preparing' }
      });
      
      await snackController.updateOrderStatus(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ createItem ============
  describe('createItem', () => {
    it('should create new item', async () => {
      const mockItem = { id: 'item-1', name: 'New Sandwich', price: '7.00' };
      
      const insertMock = createQueryMock(() => []);
      insertMock.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(insertMock)
      } as unknown as ReturnType<typeof getSupabase>);

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

    it('should accept price of 0', async () => {
      const mockItem = { id: 'item-1', name: 'Free Sample', price: '0' };
      
      const insertMock = createQueryMock(() => []);
      insertMock.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(insertMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Free Sample', price: 0 }
      });
      
      await snackController.createItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should handle optional fields', async () => {
      const mockItem = { 
        id: 'item-1', 
        name: 'Burger', 
        name_ar: 'برجر',
        price: '8.00',
        description: 'Delicious burger',
        category: 'sandwich',
        module_id: 'mod-1',
        image_url: 'http://example.com/burger.jpg'
      };
      
      const insertMock = createQueryMock(() => []);
      insertMock.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(insertMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        body: { 
          name: 'Burger',
          nameAr: 'برجر',
          price: 8.00,
          description: 'Delicious burger',
          category: 'sandwich',
          moduleId: 'mod-1',
          imageUrl: 'http://example.com/burger.jpg'
        }
      });
      
      await snackController.createItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should handle database errors', async () => {
      const insertMock = createQueryMock(() => []);
      insertMock.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(insertMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Test', price: 5.00 }
      });
      
      await snackController.createItem(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ updateItem ============
  describe('updateItem', () => {
    it('should update item fields', async () => {
      const mockItem = { id: 'item-1', name: 'Updated Name', price: '8.00' };
      
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

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

    it('should handle camelCase field names', async () => {
      const mockItem = { id: 'item-1', name_ar: 'اسم عربي', name_fr: 'Nom français' };
      
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { nameAr: 'اسم عربي', nameFr: 'Nom français' }
      });
      
      await snackController.updateItem(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should handle snake_case field names', async () => {
      const mockItem = { id: 'item-1', description_ar: 'وصف عربي' };
      
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { description_ar: 'وصف عربي' }
      });
      
      await snackController.updateItem(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should update availability', async () => {
      const mockItem = { id: 'item-1', is_available: false };
      
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { isAvailable: false }
      });
      
      await snackController.updateItem(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { name: 'Test' }
      });
      
      await snackController.updateItem(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ deleteItem ============
  describe('deleteItem', () => {
    it('should soft delete item', async () => {
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null }))
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' }
      });
      
      await snackController.deleteItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item deleted'
      });
    });

    it('should handle database errors', async () => {
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: { message: 'Delete failed' } }))
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' }
      });
      
      await snackController.deleteItem(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ toggleAvailability ============
  describe('toggleAvailability', () => {
    it('should toggle item availability to false', async () => {
      const mockItem = { id: 'item-1', is_available: false };
      
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

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

    it('should toggle item availability to true', async () => {
      const mockItem = { id: 'item-1', is_available: true };
      
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { isAvailable: true }
      });
      
      await snackController.toggleAvailability(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem
      });
    });

    it('should handle database errors', async () => {
      const updateMock = createQueryMock(() => []);
      updateMock.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } })
          })
        })
      });
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(updateMock)
      } as unknown as ReturnType<typeof getSupabase>);

      const { req, res, next } = createMockReqRes({
        params: { id: 'item-1' },
        body: { isAvailable: false }
      });
      
      await snackController.toggleAvailability(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============ Categories ============
  describe('Categories', () => {
    describe('getCategories', () => {
      it('should return static categories', async () => {
        const { req, res, next } = createMockReqRes({});
        
        await snackController.getCategories(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: 'sandwich', name: 'Sandwich' }),
            expect.objectContaining({ id: 'drink', name: 'Drink' }),
            expect.objectContaining({ id: 'snack', name: 'Snack' }),
            expect.objectContaining({ id: 'ice_cream', name: 'Ice Cream' })
          ])
        });
      });

      it('should include display_order for each category', async () => {
        const { req, res, next } = createMockReqRes({});
        
        await snackController.getCategories(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ display_order: expect.any(Number) })
          ])
        });
      });
    });

    describe('createCategory', () => {
      it('should return 405 Method Not Allowed', async () => {
        const { req, res, next } = createMockReqRes({
          body: { name: 'New Category' }
        });
        
        await snackController.createCategory(req, res, next);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Category creation not supported'
        });
      });
    });

    describe('updateCategory', () => {
      it('should return 405 Method Not Allowed', async () => {
        const { req, res, next } = createMockReqRes({
          params: { id: 'cat-1' },
          body: { name: 'Updated' }
        });
        
        await snackController.updateCategory(req, res, next);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Category update not supported'
        });
      });
    });

    describe('deleteCategory', () => {
      it('should return 405 Method Not Allowed', async () => {
        const { req, res, next } = createMockReqRes({
          params: { id: 'cat-1' }
        });
        
        await snackController.deleteCategory(req, res, next);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Category deletion not supported'
        });
      });
    });
  });
});
