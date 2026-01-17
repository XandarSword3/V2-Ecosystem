/**
 * Order Service Unit Tests
 * 
 * Comprehensive tests for OrderService with dependency injection.
 * Tests run completely in-memory - no database, no network calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createOrderService, OrderServiceError, OrderService } from '../../src/lib/services/order.service.js';
import { createInMemoryRestaurantRepository, InMemoryRestaurantRepository } from '../../src/lib/repositories/restaurant.repository.memory.js';
import { 
  createMockEmailService, 
  createMockLogger, 
  createMockActivityLogger, 
  createMockSocketEmitter,
  createTestConfig 
} from '../utils/test-helpers.js';
import type { 
  EmailService, 
  LoggerService, 
  ActivityLoggerService, 
  SocketEmitter,
  AppConfig, 
  RestaurantMenuItem,
  RestaurantOrder,
  RestaurantTable
} from '../../src/lib/container/types.js';

describe('OrderService', () => {
  let orderService: OrderService;
  let restaurantRepository: InMemoryRestaurantRepository;
  let mockEmailService: ReturnType<typeof createMockEmailService>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockSocketEmitter: ReturnType<typeof createMockSocketEmitter>;
  let config: AppConfig;

  // Test data builders
  function buildMenuItem(overrides: Partial<RestaurantMenuItem> = {}): RestaurantMenuItem {
    const id = overrides.id || `item-${Math.random().toString(36).slice(2)}`;
    return {
      id,
      module_id: 'restaurant-1',
      category_id: 'cat-1',
      name: 'Test Burger',
      name_ar: 'برجر تجريبي',
      description: 'A delicious test burger',
      price: '15.00',
      is_available: true,
      preparation_time_minutes: 15,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function buildOrder(overrides: Partial<RestaurantOrder> = {}): RestaurantOrder {
    return {
      id: 'order-123',
      order_number: 'R-240101-123456abcd',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      module_id: 'restaurant-1',
      order_type: 'dine_in',
      status: 'pending',
      subtotal: '30.00',
      tax_amount: '3.30',
      service_charge: '3.00',
      delivery_fee: '0',
      discount_amount: '0',
      total_amount: '36.30',
      payment_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function buildTable(overrides: Partial<RestaurantTable> = {}): RestaurantTable {
    return {
      id: 'table-1',
      module_id: 'restaurant-1',
      table_number: 'T1',
      capacity: 4,
      status: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(() => {
    // Create fresh instances for each test
    restaurantRepository = createInMemoryRestaurantRepository();
    mockEmailService = createMockEmailService();
    mockLogger = createMockLogger();
    mockActivityLogger = createMockActivityLogger();
    mockSocketEmitter = createMockSocketEmitter();
    config = createTestConfig();

    orderService = createOrderService({
      restaurantRepository,
      emailService: mockEmailService as unknown as EmailService,
      logger: mockLogger as unknown as LoggerService,
      activityLogger: mockActivityLogger as unknown as ActivityLoggerService,
      socketEmitter: mockSocketEmitter as unknown as SocketEmitter,
      config,
    });

    // Add default menu items
    restaurantRepository.addMenuItem(buildMenuItem({ id: 'burger-1', name: 'Classic Burger', price: '15.00' }));
    restaurantRepository.addMenuItem(buildMenuItem({ id: 'fries-1', name: 'French Fries', price: '5.00' }));
    restaurantRepository.addMenuItem(buildMenuItem({ id: 'drink-1', name: 'Soft Drink', price: '3.00' }));
    restaurantRepository.addTable(buildTable());
  });

  // ============================================
  // CREATE ORDER TESTS
  // ============================================

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const result = await orderService.createOrder({
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 2 },
          { menuItemId: 'fries-1', quantity: 1 },
        ],
      });

      expect(result.order.customer_name).toBe('Jane Doe');
      expect(result.order.status).toBe('pending');
      expect(result.order.order_number).toMatch(/^R-\d{6}-\d+\w+$/);
      expect(result.items).toHaveLength(2);
    });

    it('should calculate totals correctly for dine-in', async () => {
      const result = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 2 }, // 15 * 2 = 30
          { menuItemId: 'fries-1', quantity: 1 },  // 5 * 1 = 5
        ],
      });

      // Subtotal = 35
      // Tax (11%) = 3.85
      // Service (10% for dine-in) = 3.50
      // Total = 42.35
      expect(parseFloat(result.order.subtotal)).toBe(35);
      expect(parseFloat(result.order.tax_amount)).toBeCloseTo(3.85, 2);
      expect(parseFloat(result.order.service_charge)).toBeCloseTo(3.5, 2);
      expect(parseFloat(result.order.total_amount)).toBeCloseTo(42.35, 2);
    });

    it('should not charge service fee for takeaway', async () => {
      const result = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'takeaway',
        items: [
          { menuItemId: 'burger-1', quantity: 1 },
        ],
      });

      expect(parseFloat(result.order.service_charge)).toBe(0);
    });

    it('should add delivery fee for delivery orders', async () => {
      const result = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'delivery',
        items: [
          { menuItemId: 'burger-1', quantity: 1 },
        ],
      });

      expect(parseFloat(result.order.delivery_fee)).toBe(5);
    });

    it('should throw for non-existent menu item', async () => {
      await expect(orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'non-existent', quantity: 1 },
        ],
      })).rejects.toThrow(OrderServiceError);

      try {
        await orderService.createOrder({
          customerName: 'Jane Doe',
          orderType: 'dine_in',
          items: [{ menuItemId: 'non-existent', quantity: 1 }],
        });
      } catch (error) {
        expect((error as OrderServiceError).code).toBe('MENU_ITEM_NOT_FOUND');
      }
    });

    it('should throw for unavailable menu item', async () => {
      restaurantRepository.addMenuItem(buildMenuItem({ 
        id: 'unavailable-item', 
        name: 'Sold Out Item',
        is_available: false 
      }));

      await expect(orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'unavailable-item', quantity: 1 },
        ],
      })).rejects.toThrow(OrderServiceError);

      try {
        await orderService.createOrder({
          customerName: 'Jane Doe',
          orderType: 'dine_in',
          items: [{ menuItemId: 'unavailable-item', quantity: 1 }],
        });
      } catch (error) {
        expect((error as OrderServiceError).code).toBe('ITEM_UNAVAILABLE');
      }
    });

    it('should throw for invalid quantity', async () => {
      await expect(orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 0 },
        ],
      })).rejects.toThrow(OrderServiceError);
    });

    it('should emit socket event for new order', async () => {
      await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 1 },
        ],
      });

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'order:new',
        expect.objectContaining({
          orderNumber: expect.any(String),
          orderType: 'dine_in',
        })
      );
    });

    it('should log activity for new order', async () => {
      await orderService.createOrder({
        customerId: 'user-123',
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 1 },
        ],
      });

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'CREATE_ORDER',
        expect.objectContaining({
          orderNumber: expect.any(String),
          itemCount: 1,
        }),
        'user-123'
      );
    });

    it('should create order items in repository', async () => {
      await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 2 },
          { menuItemId: 'fries-1', quantity: 1 },
        ],
      });

      const allItems = restaurantRepository.getAllOrderItems();
      expect(allItems).toHaveLength(2);
    });

    it('should include special instructions', async () => {
      const result = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 1, specialInstructions: 'No onions' },
        ],
        specialInstructions: 'Extra napkins please',
      });

      expect(result.order.special_instructions).toBe('Extra napkins please');
    });
  });

  // ============================================
  // GET ORDER TESTS
  // ============================================

  describe('getOrderById', () => {
    it('should return order with items', async () => {
      const createResult = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 2 },
        ],
      });

      const result = await orderService.getOrderById(createResult.order.id);

      expect(result).not.toBeNull();
      expect(result!.order.customer_name).toBe('Jane Doe');
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0].quantity).toBe(2);
    });

    it('should return null for non-existent order', async () => {
      const result = await orderService.getOrderById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getOrderByNumber', () => {
    it('should return order by order number', async () => {
      const createResult = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [
          { menuItemId: 'burger-1', quantity: 1 },
        ],
      });

      const result = await orderService.getOrderByNumber(createResult.order.order_number);

      expect(result).not.toBeNull();
      expect(result!.customer_name).toBe('Jane Doe');
    });
  });

  describe('getOrders', () => {
    beforeEach(async () => {
      // Create multiple orders
      await orderService.createOrder({
        customerName: 'Customer 1',
        orderType: 'dine_in',
        items: [{ menuItemId: 'burger-1', quantity: 1 }],
      });
      await orderService.createOrder({
        customerName: 'Customer 2',
        orderType: 'takeaway',
        items: [{ menuItemId: 'fries-1', quantity: 1 }],
      });
    });

    it('should return all orders', async () => {
      const result = await orderService.getOrders({});
      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      // Update one order status
      const orders = restaurantRepository.getAllOrders();
      await restaurantRepository.updateOrder(orders[0].id, { status: 'confirmed' });

      const result = await orderService.getOrders({ status: 'pending' });
      expect(result).toHaveLength(1);
    });
  });

  describe('getLiveOrders', () => {
    it('should return only active orders', async () => {
      await orderService.createOrder({
        customerName: 'Customer 1',
        orderType: 'dine_in',
        items: [{ menuItemId: 'burger-1', quantity: 1 }],
      });
      
      const orders = restaurantRepository.getAllOrders();
      await restaurantRepository.updateOrder(orders[0].id, { status: 'completed' });

      await orderService.createOrder({
        customerName: 'Customer 2',
        orderType: 'dine_in',
        items: [{ menuItemId: 'burger-1', quantity: 1 }],
      });

      const result = await orderService.getLiveOrders();
      expect(result).toHaveLength(1);
      expect(result[0].customer_name).toBe('Customer 2');
    });
  });

  describe('getOrdersByCustomer', () => {
    it('should return orders for specific customer', async () => {
      await orderService.createOrder({
        customerId: 'customer-1',
        customerName: 'Customer 1',
        orderType: 'dine_in',
        items: [{ menuItemId: 'burger-1', quantity: 1 }],
      });
      await orderService.createOrder({
        customerId: 'customer-2',
        customerName: 'Customer 2',
        orderType: 'dine_in',
        items: [{ menuItemId: 'burger-1', quantity: 1 }],
      });

      const result = await orderService.getOrdersByCustomer('customer-1');
      expect(result).toHaveLength(1);
      expect(result[0].customer_name).toBe('Customer 1');
    });
  });

  // ============================================
  // UPDATE ORDER STATUS TESTS
  // ============================================

  describe('updateOrderStatus', () => {
    let orderId: string;

    beforeEach(async () => {
      const result = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [{ menuItemId: 'burger-1', quantity: 1 }],
      });
      orderId = result.order.id;
    });

    it('should update order status', async () => {
      const result = await orderService.updateOrderStatus(orderId, 'confirmed');
      expect(result.status).toBe('confirmed');
    });

    it('should emit socket event on status update', async () => {
      await orderService.updateOrderStatus(orderId, 'confirmed');

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'order:status',
        expect.objectContaining({
          orderId,
          status: 'confirmed',
          previousStatus: 'pending',
        })
      );
    });

    it('should throw for invalid status transition', async () => {
      // Cannot go directly from pending to completed
      await expect(orderService.updateOrderStatus(orderId, 'completed'))
        .rejects.toThrow(OrderServiceError);

      try {
        await orderService.updateOrderStatus(orderId, 'completed');
      } catch (error) {
        expect((error as OrderServiceError).code).toBe('INVALID_STATUS_TRANSITION');
      }
    });

    it('should throw for non-existent order', async () => {
      await expect(orderService.updateOrderStatus('non-existent', 'confirmed'))
        .rejects.toThrow(OrderServiceError);
    });

    it('should allow valid status transitions', async () => {
      await orderService.updateOrderStatus(orderId, 'confirmed');
      await orderService.updateOrderStatus(orderId, 'preparing');
      await orderService.updateOrderStatus(orderId, 'ready');
      const result = await orderService.updateOrderStatus(orderId, 'completed');
      
      expect(result.status).toBe('completed');
    });

    it('should log activity on status update', async () => {
      await orderService.updateOrderStatus(orderId, 'confirmed', 'staff-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'UPDATE_ORDER_STATUS',
        expect.objectContaining({
          orderId,
          from: 'pending',
          to: 'confirmed',
        }),
        'staff-123'
      );
    });
  });

  // ============================================
  // CANCEL ORDER TESTS
  // ============================================

  describe('cancelOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const result = await orderService.createOrder({
        customerName: 'Jane Doe',
        orderType: 'dine_in',
        items: [{ menuItemId: 'burger-1', quantity: 1 }],
      });
      orderId = result.order.id;
    });

    it('should cancel order', async () => {
      const result = await orderService.cancelOrder(orderId, 'Customer request');
      expect(result.status).toBe('cancelled');
    });

    it('should emit socket event on cancel', async () => {
      await orderService.cancelOrder(orderId, 'Customer request');

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'restaurant',
        'order:cancelled',
        expect.objectContaining({
          orderId,
          reason: 'Customer request',
        })
      );
    });

    it('should throw when cancelling completed order', async () => {
      // Progress order to completed
      await orderService.updateOrderStatus(orderId, 'confirmed');
      await orderService.updateOrderStatus(orderId, 'preparing');
      await orderService.updateOrderStatus(orderId, 'ready');
      await orderService.updateOrderStatus(orderId, 'completed');

      await expect(orderService.cancelOrder(orderId, 'Changed mind'))
        .rejects.toThrow(OrderServiceError);

      try {
        await orderService.cancelOrder(orderId, 'Changed mind');
      } catch (error) {
        expect((error as OrderServiceError).code).toBe('CANNOT_CANCEL');
      }
    });

    it('should throw when cancelling already cancelled order', async () => {
      await orderService.cancelOrder(orderId, 'First cancel');

      await expect(orderService.cancelOrder(orderId, 'Second cancel'))
        .rejects.toThrow(OrderServiceError);
    });

    it('should log activity on cancel', async () => {
      await orderService.cancelOrder(orderId, 'Customer request', 'staff-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'CANCEL_ORDER',
        expect.objectContaining({
          orderId,
          reason: 'Customer request',
        }),
        'staff-123'
      );
    });
  });
});
