/**
 * Snack Service Unit Tests
 * 
 * Tests for snack items and order operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSnackService,
  SnackService,
  SnackServiceError,
} from '../../src/lib/services/snack.service.js';
import { createInMemorySnackRepository } from '../../src/lib/repositories/snack.repository.memory.js';
import type { LoggerService, ActivityLoggerService, SocketEmitter } from '../../src/lib/container/types.js';

// ============================================
// TEST FIXTURES
// ============================================

function createMockLogger(): LoggerService {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockActivityLogger(): ActivityLoggerService {
  return {
    log: vi.fn().mockResolvedValue(undefined),
    getActivityLogs: vi.fn().mockResolvedValue([]),
  };
}

function createMockSocketEmitter(): SocketEmitter {
  return {
    emitToUnit: vi.fn(),
    emitToUser: vi.fn(),
  };
}

// ============================================
// ITEM TESTS
// ============================================

describe('SnackService - Items', () => {
  let service: SnackService;
  let snackRepository: ReturnType<typeof createInMemorySnackRepository>;
  let mockActivityLogger: ActivityLoggerService;

  beforeEach(() => {
    snackRepository = createInMemorySnackRepository();
    mockActivityLogger = createMockActivityLogger();

    service = createSnackService({
      snackRepository,
      logger: createMockLogger(),
      activityLogger: mockActivityLogger,
      socketEmitter: createMockSocketEmitter(),
    });
  });

  describe('getItems', () => {
    it('should return empty array when no items exist', async () => {
      const result = await service.getItems();
      expect(result).toEqual([]);
    });

    it('should return all items', async () => {
      snackRepository.addItem({
        id: 'item-1',
        name: 'Hamburger',
        price: '8.00',
        category: 'sandwich',
        display_order: 1,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      snackRepository.addItem({
        id: 'item-2',
        name: 'Cola',
        price: '2.50',
        category: 'drink',
        display_order: 2,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getItems();
      expect(result).toHaveLength(2);
    });

    it('should filter by category', async () => {
      snackRepository.addItem({
        id: 'item-1',
        name: 'Hamburger',
        price: '8.00',
        category: 'sandwich',
        display_order: 1,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      snackRepository.addItem({
        id: 'item-2',
        name: 'Cola',
        price: '2.50',
        category: 'drink',
        display_order: 2,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getItems({ category: 'sandwich' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Hamburger');
    });

    it('should filter by availability', async () => {
      snackRepository.addItem({
        id: 'item-1',
        name: 'Available Item',
        price: '5.00',
        category: 'snack',
        display_order: 1,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      snackRepository.addItem({
        id: 'item-2',
        name: 'Unavailable Item',
        price: '5.00',
        category: 'snack',
        display_order: 2,
        is_available: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getItems({ availableOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Available Item');
    });
  });

  describe('getItemById', () => {
    it('should return item by ID', async () => {
      snackRepository.addItem({
        id: 'item-1',
        name: 'Test Item',
        price: '5.00',
        category: 'snack',
        display_order: 1,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.getItemById('item-1');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Item');
    });

    it('should return null for non-existent item', async () => {
      const result = await service.getItemById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createItem', () => {
    it('should create a new snack item', async () => {
      const result = await service.createItem({
        name: 'New Sandwich',
        price: 7.99,
        category: 'sandwich',
      }, 'user-1');

      expect(result.name).toBe('New Sandwich');
      expect(result.price).toBe('7.99');
      expect(result.category).toBe('sandwich');
      expect(result.is_available).toBe(true);
    });

    it('should create item with translations', async () => {
      const result = await service.createItem({
        name: 'Croissant',
        nameAr: 'كرواسون',
        nameFr: 'Croissant',
        description: 'Buttery pastry',
        price: 3.50,
      });

      expect(result.name).toBe('Croissant');
      expect(result.name_ar).toBe('كرواسون');
      expect(result.name_fr).toBe('Croissant');
    });

    it('should default category to snack', async () => {
      const result = await service.createItem({
        name: 'Chips',
        price: 2.00,
      });

      expect(result.category).toBe('snack');
    });

    it('should throw error for negative price', async () => {
      await expect(
        service.createItem({
          name: 'Invalid Item',
          price: -5.00,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PRICE',
        statusCode: 400,
      });
    });

    it('should log activity on creation', async () => {
      await service.createItem({
        name: 'Logged Item',
        price: 5.00,
      }, 'user-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'CREATE_SNACK_ITEM',
        expect.objectContaining({
          name: 'Logged Item',
          price: 5.00,
        }),
        'user-123'
      );
    });
  });

  describe('updateItem', () => {
    beforeEach(() => {
      snackRepository.addItem({
        id: 'item-update',
        name: 'Original Name',
        price: '5.00',
        category: 'snack',
        display_order: 1,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should update item name', async () => {
      const result = await service.updateItem('item-update', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should update item price', async () => {
      const result = await service.updateItem('item-update', {
        price: 7.50,
      });

      expect(result.price).toBe('7.5');
    });

    it('should update multiple fields', async () => {
      const result = await service.updateItem('item-update', {
        name: 'New Name',
        price: 10.00,
        category: 'drink',
        isAvailable: false,
      });

      expect(result.name).toBe('New Name');
      expect(result.price).toBe('10');
      expect(result.category).toBe('drink');
      expect(result.is_available).toBe(false);
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        service.updateItem('non-existent', { name: 'Test' })
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error for negative price', async () => {
      await expect(
        service.updateItem('item-update', { price: -1.00 })
      ).rejects.toMatchObject({
        code: 'INVALID_PRICE',
      });
    });
  });

  describe('deleteItem', () => {
    beforeEach(() => {
      snackRepository.addItem({
        id: 'item-delete',
        name: 'To Delete',
        price: '5.00',
        category: 'snack',
        display_order: 1,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should delete snack item', async () => {
      await service.deleteItem('item-delete', 'user-1');

      const result = await service.getItemById('item-delete');
      expect(result).toBeNull();
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        service.deleteItem('non-existent')
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should log activity on deletion', async () => {
      await service.deleteItem('item-delete', 'user-456');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'DELETE_SNACK_ITEM',
        expect.objectContaining({
          itemId: 'item-delete',
          name: 'To Delete',
        }),
        'user-456'
      );
    });
  });

  describe('setItemAvailability', () => {
    beforeEach(() => {
      snackRepository.addItem({
        id: 'item-avail',
        name: 'Toggle Item',
        price: '5.00',
        category: 'snack',
        display_order: 1,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('should set item unavailable', async () => {
      const result = await service.setItemAvailability('item-avail', false, 'user-1');
      expect(result.is_available).toBe(false);
    });

    it('should set item available', async () => {
      await service.setItemAvailability('item-avail', false);
      const result = await service.setItemAvailability('item-avail', true, 'user-1');
      expect(result.is_available).toBe(true);
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        service.setItemAvailability('non-existent', true)
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      });
    });
  });
});

// ============================================
// ORDER TESTS
// ============================================

describe('SnackService - Orders', () => {
  let service: SnackService;
  let snackRepository: ReturnType<typeof createInMemorySnackRepository>;
  let mockActivityLogger: ActivityLoggerService;
  let mockSocketEmitter: SocketEmitter;

  beforeEach(() => {
    snackRepository = createInMemorySnackRepository();
    mockActivityLogger = createMockActivityLogger();
    mockSocketEmitter = createMockSocketEmitter();

    service = createSnackService({
      snackRepository,
      logger: createMockLogger(),
      activityLogger: mockActivityLogger,
      socketEmitter: mockSocketEmitter,
    });

    // Add default items
    snackRepository.addItem({
      id: 'burger',
      name: 'Hamburger',
      price: '8.00',
      category: 'sandwich',
      display_order: 1,
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    snackRepository.addItem({
      id: 'cola',
      name: 'Cola',
      price: '2.50',
      category: 'drink',
      display_order: 2,
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    snackRepository.addItem({
      id: 'unavailable',
      name: 'Sold Out Item',
      price: '5.00',
      category: 'snack',
      display_order: 3,
      is_available: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  describe('createOrder', () => {
    it('should create a new order', async () => {
      const result = await service.createOrder({
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [
          { itemId: 'burger', quantity: 2 },
          { itemId: 'cola', quantity: 1 },
        ],
      }, 'customer-1');

      expect(result.order_number).toMatch(/^S-/);
      expect(result.customer_name).toBe('John Doe');
      expect(result.customer_phone).toBe('+1234567890');
      expect(result.status).toBe('pending');
      expect(result.total_amount).toBe('18.50'); // 8*2 + 2.5
      expect(result.payment_status).toBe('pending');
    });

    it('should calculate correct total for multiple items', async () => {
      const result = await service.createOrder({
        items: [
          { itemId: 'burger', quantity: 3 },
          { itemId: 'cola', quantity: 4 },
        ],
      });

      expect(result.total_amount).toBe('34.00'); // 8*3 + 2.5*4 = 24 + 10
    });

    it('should throw error for empty order', async () => {
      await expect(
        service.createOrder({ items: [] })
      ).rejects.toMatchObject({
        code: 'EMPTY_ORDER',
        statusCode: 400,
      });
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        service.createOrder({
          items: [{ itemId: 'non-existent', quantity: 1 }],
        })
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error for unavailable item', async () => {
      await expect(
        service.createOrder({
          items: [{ itemId: 'unavailable', quantity: 1 }],
        })
      ).rejects.toMatchObject({
        code: 'ITEM_UNAVAILABLE',
        statusCode: 400,
      });
    });

    it('should emit socket event on order creation', async () => {
      const result = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'snack_bar',
        'order:new',
        expect.objectContaining({
          orderId: result.id,
          orderNumber: result.order_number,
        })
      );
    });
  });

  describe('getOrderById', () => {
    it('should return order by ID', async () => {
      const order = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });

      const result = await service.getOrderById(order.id);
      expect(result).not.toBeNull();
      expect(result?.order_number).toBe(order.order_number);
    });

    it('should return null for non-existent order', async () => {
      const result = await service.getOrderById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getOrders', () => {
    beforeEach(async () => {
      // Create multiple orders
      await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      }, 'customer-1');
      
      await service.createOrder({
        items: [{ itemId: 'cola', quantity: 2 }],
      }, 'customer-2');
    });

    it('should return all orders', async () => {
      const result = await service.getOrders();
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const result = await service.getOrders({ status: 'pending' });
      expect(result.every(o => o.status === 'pending')).toBe(true);
    });
  });

  describe('getCustomerOrders', () => {
    beforeEach(async () => {
      await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      }, 'customer-1');
      
      await service.createOrder({
        items: [{ itemId: 'cola', quantity: 2 }],
      }, 'customer-1');
      
      await service.createOrder({
        items: [{ itemId: 'burger', quantity: 3 }],
      }, 'customer-2');
    });

    it('should return only customer orders', async () => {
      const result = await service.getCustomerOrders('customer-1');
      expect(result).toHaveLength(2);
      expect(result.every(o => o.customer_id === 'customer-1')).toBe(true);
    });
  });

  describe('getLiveOrders', () => {
    it('should return only active orders', async () => {
      const order1 = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });
      const order2 = await service.createOrder({
        items: [{ itemId: 'cola', quantity: 1 }],
      });

      // Complete one order
      await service.updateOrderStatus(order2.id, 'completed');

      const result = await service.getLiveOrders();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(order1.id);
    });

    it('should include pending, preparing, and ready orders', async () => {
      const order1 = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });
      const order2 = await service.createOrder({
        items: [{ itemId: 'cola', quantity: 1 }],
      });
      const order3 = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 2 }],
      });

      await service.updateOrderStatus(order1.id, 'preparing');
      await service.updateOrderStatus(order2.id, 'ready');
      // order3 stays pending

      const result = await service.getLiveOrders();
      expect(result).toHaveLength(3);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const order = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });

      const result = await service.updateOrderStatus(order.id, 'preparing', 'staff-1');
      expect(result.status).toBe('preparing');
    });

    it('should set completed_at and payment_status when completing', async () => {
      const order = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });

      const result = await service.updateOrderStatus(order.id, 'completed', 'staff-1');
      expect(result.status).toBe('completed');
      expect(result.completed_at).toBeDefined();
      expect(result.payment_status).toBe('paid');
    });

    it('should throw error for non-existent order', async () => {
      await expect(
        service.updateOrderStatus('non-existent', 'preparing')
      ).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should emit socket event on status update', async () => {
      const order = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });

      await service.updateOrderStatus(order.id, 'ready', 'staff-1');

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'snack_bar',
        'order:updated',
        expect.objectContaining({
          orderId: order.id,
          status: 'ready',
        })
      );
    });

    it('should log activity on status update', async () => {
      const order = await service.createOrder({
        items: [{ itemId: 'burger', quantity: 1 }],
      });

      await service.updateOrderStatus(order.id, 'preparing', 'staff-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'UPDATE_SNACK_ORDER_STATUS',
        expect.objectContaining({
          orderId: order.id,
          previousStatus: 'pending',
          newStatus: 'preparing',
        }),
        'staff-123'
      );
    });
  });
});

// ============================================
// CATEGORIES TESTS
// ============================================

describe('SnackService - Categories', () => {
  let service: SnackService;

  beforeEach(() => {
    service = createSnackService({
      snackRepository: createInMemorySnackRepository(),
      logger: createMockLogger(),
      activityLogger: createMockActivityLogger(),
      socketEmitter: createMockSocketEmitter(),
    });
  });

  describe('getCategories', () => {
    it('should return static categories', async () => {
      const result = await service.getCategories();
      
      expect(result).toHaveLength(4);
      expect(result.map(c => c.id)).toContain('sandwich');
      expect(result.map(c => c.id)).toContain('drink');
      expect(result.map(c => c.id)).toContain('snack');
      expect(result.map(c => c.id)).toContain('ice_cream');
    });

    it('should have display order', async () => {
      const result = await service.getCategories();
      
      expect(result.every(c => typeof c.display_order === 'number')).toBe(true);
    });
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('SnackServiceError', () => {
  it('should create error with correct properties', () => {
    const error = new SnackServiceError('Test message', 'TEST_CODE', 500);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('SnackServiceError');
  });

  it('should default to 400 status code', () => {
    const error = new SnackServiceError('Test', 'TEST');
    expect(error.statusCode).toBe(400);
  });
});
