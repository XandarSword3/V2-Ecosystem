/**
 * Restaurant Order Controller Unit Tests
 * Tests logic in order.controller.ts and implicitly order.service.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// 1. Mock Database
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// 2. Mock Validation
vi.mock('../../../src/validation/schemas.js', () => ({
    createRestaurantOrderSchema: {},
    updateOrderStatusSchema: {},
    validateBody: vi.fn().mockImplementation((schema, body) => body), // Bypass validation
}));

// 3. Mock Socket
vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
  emitToUser: vi.fn(),
  notifyAdmins: vi.fn(),
}));

// 4. Mock Email Service
vi.mock('../../../src/services/email.service.js', () => ({
  emailService: {
    sendOrderConfirmation: vi.fn().mockResolvedValue(true),
    sendOrderUpdate: vi.fn().mockResolvedValue(true),
  },
}));

// 5. Mock Logger & Activity Logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

import { getSupabase } from '../../../src/database/connection.js';
import { emitToUnit } from '../../../src/socket/index.js';

// Helper to create mock request/response
function createMockReqRes(options: { 
  params?: Record<string, string>; 
  query?: Record<string, any>; 
  body?: Record<string, any>;
  user?: { id: string; role: string; userId: string };
} = {}) {
  const req = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    user: options.user || { id: 'test-user-id', role: 'customer', userId: 'user-id-123' },
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('Order Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create a valid order', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        orderType: 'dine_in',
        tableId: 'table-1',
        items: [
          { menuItemId: 'item-1', quantity: 2, notes: 'No spice' }
        ],
        paymentMethod: 'cash'
      };

      const mockMenuItems = [
        { id: 'item-1', price: 10, is_available: true, name: 'Burger', module_id: 'mod-1' }
      ];
      const createdOrder = { 
        id: 'order-1', 
        order_number: 'R-123', 
        total_amount: 22, // 20 + 2 tax
        module_id: 'mod-1' 
      };

      const mockClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'menu_items') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({ data: mockMenuItems, error: null }),
            };
          }
          if (table === 'restaurant_orders') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: createdOrder, error: null }),
            };
          }
          if (table === 'restaurant_order_items') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'restaurant_order_status_history') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return { select: vi.fn() };
        }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { createOrder } = await import('../../../src/modules/restaurant/controllers/order.controller.js');
      const { req, res, next } = createMockReqRes({ body: orderData });

      await createOrder(req, res, next);

      expect(mockClient.from).toHaveBeenCalledWith('restaurant_orders');
      expect(emitToUnit).toHaveBeenCalledWith('restaurant', 'order:new', expect.anything());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdOrder,
      });
    });
  });

  describe('getOrder', () => {
    it('should return order details for owner', async () => {
      const mockOrder = { 
        id: 'order-1', 
        items: [],
        customer_id: 'user-id-123' // Matches req.user.userId
      };

      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getOrder } = await import('../../../src/modules/restaurant/controllers/order.controller.js');
      const { req, res, next } = createMockReqRes({ params: { id: 'order-1' } });

      await getOrder(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrder,
      });
    });
  });

  describe('getMyOrders', () => {
    it('should return user orders', async () => {
      const mockOrders = [{ id: 'order-1', total_amount: 50 }];

      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockOrders, error: null }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getMyOrders } = await import('../../../src/modules/restaurant/controllers/order.controller.js');
      const { req, res, next } = createMockReqRes();

      await getMyOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrders,
      });
    });
  });

  describe('getLiveOrders', () => {
    it('should return active orders', async () => {
      const mockOrders = [{ 
          id: 'order-1', 
          status: 'pending', 
          order_number: '123',
          customer_name: 'Guest',
          total_amount: '0',
          created_at: '2023-01-01',
          estimated_ready_time: null,
          order_items: [],
          order_type: 'dine_in'
      }];

      const queryChain = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: mockOrders, error: null })
      };

      vi.mocked(getSupabase).mockReturnValue({
          from: vi.fn().mockReturnValue(queryChain)
      } as any);

      const { getLiveOrders } = await import('../../../src/modules/restaurant/controllers/order.controller.js');
      const { req, res, next } = createMockReqRes();

      await getLiveOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
            expect.objectContaining({
                id: 'order-1',
                orderNumber: '123', // check transformed key
                status: 'pending'
            })
        ]),
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update status and emit event', async () => {
      const mockOrder = { 
        id: 'order-1', 
        status: 'pending',
        customer_id: 'user-1'
      };
      const updatedOrder = { ...mockOrder, status: 'preparing' };

      // We need to mock the update return
      const updateChain = {
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: updatedOrder, error: null })
      };
      
      const mockClient = {
        from: vi.fn().mockImplementation((table) => {
            if (table === 'restaurant_orders') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
                    update: vi.fn().mockReturnValue(updateChain),
                }
            }
             if (table === 'restaurant_order_status_history') {
                 return { insert: vi.fn().mockResolvedValue({ error: null }) }
             }
             return { select: vi.fn() }
        })
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      // We need to mock request body to pass validation (mocked above to return body)
      // Controller uses `validateBody`.
      
      const { updateOrderStatus } = await import('../../../src/modules/restaurant/controllers/order.controller.js');
      const { req, res, next } = createMockReqRes({ 
        params: { id: 'order-1' },
        body: { status: 'preparing', notes: 'Cooking' }
      });

      await updateOrderStatus(req, res, next);

      expect(emitToUnit).toHaveBeenCalledWith('restaurant', 'order:updated', expect.anything());
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedOrder,
      });
    });
  });

  describe('getDailyReport', () => {
      it('should return daily stats', async () => {
         const mockOrders = [
             { total_amount: 100, status: 'completed' },
             { total_amount: 50, status: 'cancelled' }
         ];
         
         const queryChain = {
             select: vi.fn().mockReturnThis(),
             eq: vi.fn().mockReturnThis(),
             gte: vi.fn().mockReturnThis(),
             lte: vi.fn().mockReturnThis(),
             is: vi.fn().mockReturnThis(),
             then: (resolve: any) => resolve({ data: mockOrders, error: null })
         };

         vi.mocked(getSupabase).mockReturnValue({
             from: vi.fn().mockReturnValue(queryChain)
         } as any);

         const { getDailyReport } = await import('../../../src/modules/restaurant/controllers/order.controller.js');
         const { req, res, next } = createMockReqRes({ query: { date: '2024-01-20' } });
         
         await getDailyReport(req, res, next);
         
         expect(res.json).toHaveBeenCalled();
      });
  });
});
