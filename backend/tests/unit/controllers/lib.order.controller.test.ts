import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';
import { createOrderController } from '../../../src/lib/controllers/order.controller';

describe('OrderController', () => {
  let mockOrderService: any;
  let mockLogger: any;
  let controller: ReturnType<typeof createOrderController>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrderService = {
      createOrder: vi.fn(),
      getOrderById: vi.fn(),
      getOrderByNumber: vi.fn(),
      getOrders: vi.fn(),
      getLiveOrders: vi.fn(),
      getOrdersByCustomer: vi.fn(),
      updateOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    controller = createOrderController({
      orderService: mockOrderService,
      logger: mockLogger,
    });
  });

  describe('createOrder', () => {
    const validOrderBody = {
      customerName: 'John Doe',
      orderType: 'dine_in',
      items: [
        { menuItemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 },
      ],
    };

    it('should create order successfully', async () => {
      const mockOrder = { id: 'order-1', orderNumber: 'ORD-001' };
      const mockItems = [{ id: 'item-1' }];
      mockOrderService.createOrder.mockResolvedValue({ order: mockOrder, items: mockItems });

      const { req, res } = createMockReqRes({
        body: validOrderBody,
      });

      await controller.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { order: mockOrder, items: mockItems },
      });
    });

    it('should require at least one item', async () => {
      const { req, res } = createMockReqRes({
        body: {
          customerName: 'John',
          orderType: 'dine_in',
          items: [],
        },
      });

      await controller.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate order type', async () => {
      const { req, res } = createMockReqRes({
        body: {
          ...validOrderBody,
          orderType: 'invalid',
        },
      });

      await controller.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors with statusCode', async () => {
      mockOrderService.createOrder.mockRejectedValue({
        statusCode: 400,
        message: 'Menu item not available',
        code: 'ITEM_UNAVAILABLE',
      });

      const { req, res } = createMockReqRes({
        body: validOrderBody,
      });

      await controller.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Menu item not available',
        code: 'ITEM_UNAVAILABLE',
      });
    });

    it('should handle generic errors', async () => {
      mockOrderService.createOrder.mockRejectedValue(new Error('Unknown'));

      const { req, res } = createMockReqRes({
        body: validOrderBody,
      });

      await controller.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getOrderById', () => {
    it('should return order', async () => {
      const mockOrder = { id: 'order-1', items: [] };
      mockOrderService.getOrderById.mockResolvedValue(mockOrder);

      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
      });

      await controller.getOrderById(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrder,
      });
    });

    it('should return 404 for non-existent order', async () => {
      mockOrderService.getOrderById.mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { id: 'non-existent' },
      });

      await controller.getOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      mockOrderService.getOrderById.mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
      });

      await controller.getOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getOrderByNumber', () => {
    it('should return order by number', async () => {
      const mockOrder = { id: 'order-1', orderNumber: 'ORD-001' };
      mockOrderService.getOrderByNumber.mockResolvedValue(mockOrder);
      mockOrderService.getOrderById.mockResolvedValue({ ...mockOrder, items: [] });

      const { req, res } = createMockReqRes({
        params: { orderNumber: 'ORD-001' },
      });

      await controller.getOrderByNumber(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: 'order-1' }),
      });
    });

    it('should return 404 for non-existent order number', async () => {
      mockOrderService.getOrderByNumber.mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { orderNumber: 'INVALID' },
      });

      await controller.getOrderByNumber(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getOrders', () => {
    it('should return filtered orders', async () => {
      const mockOrders = [{ id: 'order-1' }];
      mockOrderService.getOrders.mockResolvedValue(mockOrders);

      const { req, res } = createMockReqRes({
        query: { status: 'pending' },
      });

      await controller.getOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrders,
      });
    });

    it('should use default pagination', async () => {
      mockOrderService.getOrders.mockResolvedValue([]);

      const { req, res } = createMockReqRes({
        query: {},
      });

      await controller.getOrders(req, res);

      expect(mockOrderService.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
          offset: 0,
        })
      );
    });

    it('should reject invalid status', async () => {
      const { req, res } = createMockReqRes({
        query: { status: 'invalid' },
      });

      await controller.getOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getLiveOrders', () => {
    it('should return live orders', async () => {
      const mockOrders = [{ id: 'order-1', status: 'preparing' }];
      mockOrderService.getLiveOrders.mockResolvedValue(mockOrders);

      const { req, res } = createMockReqRes({});

      await controller.getLiveOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrders,
      });
    });

    it('should handle errors', async () => {
      mockOrderService.getLiveOrders.mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes({});

      await controller.getLiveOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMyOrders', () => {
    it('should return user orders', async () => {
      const mockOrders = [{ id: 'order-1' }];
      mockOrderService.getOrdersByCustomer.mockResolvedValue(mockOrders);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', userId: 'user-1', role: 'customer' },
      });

      await controller.getMyOrders(req, res);

      expect(mockOrderService.getOrdersByCustomer).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrders,
      });
    });

    it('should require authentication', async () => {
      const { req, res } = createMockReqRes({});
      // Override user to be undefined for this test (controller checks req.user?.id)
      (req as any).user = undefined;

      await controller.getMyOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const mockOrder = { id: 'order-1', status: 'preparing' };
      mockOrderService.updateOrderStatus.mockResolvedValue(mockOrder);

      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'preparing' },
        user: { id: 'staff-1', userId: 'staff-1', role: 'staff' },
      });

      await controller.updateOrderStatus(req, res);

      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith('order-1', 'preparing', 'staff-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrder,
      });
    });

    it('should reject invalid status', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'invalid' },
      });

      await controller.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors', async () => {
      mockOrderService.updateOrderStatus.mockRejectedValue({
        statusCode: 400,
        message: 'Invalid status transition',
        code: 'INVALID_TRANSITION',
      });

      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'completed' },
        user: { id: 'staff-1', userId: 'staff-1', role: 'staff' },
      });

      await controller.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const mockOrder = { id: 'order-1', status: 'cancelled' };
      mockOrderService.cancelOrder.mockResolvedValue(mockOrder);

      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
        body: { reason: 'Customer request' },
        user: { id: 'staff-1', userId: 'staff-1', role: 'staff' },
      });

      await controller.cancelOrder(req, res);

      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith('order-1', 'Customer request', 'staff-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrder,
      });
    });

    it('should require cancellation reason', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
        body: {},
      });

      await controller.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle not allowed to cancel', async () => {
      mockOrderService.cancelOrder.mockRejectedValue({
        statusCode: 400,
        message: 'Cannot cancel completed order',
        code: 'CANCEL_NOT_ALLOWED',
      });

      const { req, res } = createMockReqRes({
        params: { id: 'order-1' },
        body: { reason: 'Testing' },
        user: { id: 'staff-1', userId: 'staff-1', role: 'staff' },
      });

      await controller.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
