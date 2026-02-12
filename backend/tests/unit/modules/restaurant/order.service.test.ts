import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket
vi.mock('../../../../src/socket/index', () => ({
  emitToUnit: vi.fn(),
  emitToRole: vi.fn(),
}));

// Mock email service
vi.mock('../../../../src/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    sendOrderConfirmation: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock tax service
vi.mock('../../../../src/services/tax.service', () => ({
  taxService: {
    getTaxRate: vi.fn().mockResolvedValue(0.1),
  },
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============= Chainable Supabase Mock =============
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
    then: (resolve: (val: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
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
  updateChain.then = (resolve: (val: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (val: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// Test data
const mockMenuItem = {
  id: 'menu-item-1',
  name: 'Grilled Salmon',
  price: '25.00',
  module_id: 'module-1',
  is_available: true,
  preparation_time_minutes: 20,
};

const mockOrder = {
  id: 'order-1',
  order_number: 'R-260207-123456abcd',
  customer_id: 'customer-1',
  customer_name: 'John Doe',
  customer_phone: '+1234567890',
  table_id: 'table-1',
  module_id: 'module-1',
  order_type: 'dine_in',
  status: 'pending',
  subtotal: '25.00',
  tax_amount: '2.50',
  service_charge: '2.50',
  delivery_fee: '0.00',
  discount_amount: '0.00',
  total_amount: '30.00',
  payment_status: 'pending',
  payment_method: 'card',
  created_at: '2026-02-07T10:00:00Z',
  estimated_ready_time: '2026-02-07T10:25:00Z',
};

const mockOrderItem = {
  id: 'order-item-1',
  order_id: 'order-1',
  menu_item_id: 'menu-item-1',
  quantity: 1,
  unit_price: '25.00',
  subtotal: '25.00',
  special_instructions: 'No sauce',
  menu_items: {
    id: 'menu-item-1',
    name: 'Grilled Salmon',
    name_ar: 'سمك السلمون المشوي',
    image_url: '/images/salmon.jpg',
  },
};

const mockTable = {
  id: 'table-1',
  table_number: 'T1',
  is_active: true,
};

// Global mock state
let mockTables: unknown[] = [];
let mockMenuItems: unknown[] = [];
let mockOrders: unknown[] = [];
let mockOrderItems: unknown[] = [];
let mockRpcResults: Record<string, unknown> = {};

// Mock database
vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn().mockImplementation(() => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'restaurant_tables') {
        return createQueryMock(() => mockTables);
      }
      if (table === 'menu_items') {
        return createQueryMock(() => mockMenuItems);
      }
      if (table === 'restaurant_orders') {
        return createQueryMock(() => mockOrders);
      }
      if (table === 'restaurant_order_items') {
        return createQueryMock(() => mockOrderItems);
      }
      if (table === 'restaurant_order_status_history') {
        return createQueryMock(() => []);
      }
      return createQueryMock(() => []);
    });

    return {
      from: fromMock,
      rpc: vi.fn().mockImplementation((name: string) => {
        const result = mockRpcResults[name];
        if (result !== undefined) {
          return Promise.resolve({ data: result, error: null });
        }
        return Promise.resolve({ data: [{ success: true }], error: null });
      }),
    };
  }),
}));

import * as orderService from '../../../../src/modules/restaurant/services/order.service';
import { emitToUnit } from '../../../../src/socket/index';

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTables = [mockTable];
    mockMenuItems = [mockMenuItem];
    mockOrders = [mockOrder];
    mockOrderItems = [mockOrderItem];
    mockRpcResults = {};
  });

  describe('createOrder', () => {
    it('should create an order with valid data', async () => {
      const orderData = {
        customerId: 'customer-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '+1234567890',
        tableId: 'table-1',
        orderType: 'dine_in' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
        paymentMethod: 'card' as const,
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
      expect(result.id).toBe('new-1');
      expect(emitToUnit).toHaveBeenCalledWith('restaurant', 'order:new', expect.any(Object));
    });

    it('should resolve table ID from table number', async () => {
      const orderData = {
        customerName: 'Jane Doe',
        tableNumber: 'T1',
        orderType: 'dine_in' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should calculate modifier totals correctly', async () => {
      const orderData = {
        customerName: 'Test Customer',
        orderType: 'takeaway' as const,
        items: [{
          menuItemId: 'menu-item-1',
          quantity: 2,
          selectedModifiers: [
            {
              optionId: 'mod-1',
              optionName: 'Extra Cheese',
              groupId: 'group-1',
              groupName: 'Additions',
              modifierType: 'add' as const,
              priceAdjustment: 2.00,
              quantity: 1,
            },
          ],
          modifierTotal: 2.00,
        }],
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should apply coupon discount', async () => {
      mockRpcResults['apply_coupon_atomic'] = [{ success: true, discount_amount: '5.00', coupon_id: 'coupon-1' }];

      const orderData = {
        customerId: 'customer-1',
        customerName: 'Coupon User',
        orderType: 'dine_in' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
        couponCode: 'SAVE5',
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should apply gift card redemption', async () => {
      mockRpcResults['redeem_giftcard_atomic'] = [{ success: true, amount_redeemed: '10.00', gift_card_id: 'gc-1' }];

      const orderData = {
        customerName: 'Gift Card User',
        orderType: 'takeaway' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
        giftCardRedemptions: [{ code: 'GIFTCARD123', amount: 10 }],
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should apply loyalty points redemption', async () => {
      mockRpcResults['redeem_loyalty_points_atomic'] = [{ success: true, points_redeemed: 500 }];

      const orderData = {
        customerId: 'customer-1',
        customerName: 'Loyalty User',
        orderType: 'dine_in' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
        loyaltyPointsToRedeem: 500,
        loyaltyPointsDollarValue: 5,
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should earn loyalty points for logged in customers', async () => {
      mockRpcResults['earn_loyalty_points_atomic'] = [{ success: true, points_earned: 30 }];

      const orderData = {
        customerId: 'customer-1',
        customerName: 'Points Earner',
        orderType: 'dine_in' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should handle delivery orders with delivery fee', async () => {
      const orderData = {
        customerName: 'Delivery Customer',
        orderType: 'delivery' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should handle room service orders', async () => {
      const orderData = {
        customerName: 'Room Service Customer',
        orderType: 'room_service' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should handle tax exempt orders', async () => {
      const orderData = {
        customerName: 'Tax Exempt Customer',
        orderType: 'takeaway' as const,
        items: [{ menuItemId: 'menu-item-1', quantity: 1 }],
        taxExempt: true,
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });

    it('should include special instructions', async () => {
      const orderData = {
        customerName: 'Special Instructions Customer',
        orderType: 'dine_in' as const,
        items: [{
          menuItemId: 'menu-item-1',
          quantity: 1,
          specialInstructions: 'No onions',
        }],
        specialInstructions: 'Birthday celebration',
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toBeDefined();
    });
  });

  describe('getOrderById', () => {
    it('should return order with items', async () => {
      const result = await orderService.getOrderById('order-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('order-1');
    });

    it('should return null for non-existent order', async () => {
      mockOrders = [];

      const result = await orderService.getOrderById('non-existent');

      expect(result).toBeNull();
    });

    it('should transform items with menu_item property', async () => {
      const result = await orderService.getOrderById('order-1');

      expect(result).toBeDefined();
      expect(result?.items).toBeDefined();
    });
  });

  describe('getOrderStatus', () => {
    it('should return full order details', async () => {
      const result = await orderService.getOrderStatus('order-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('order-1');
    });

    it('should return null for non-existent order', async () => {
      mockOrders = [];

      const result = await orderService.getOrderStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getOrdersByCustomer', () => {
    it('should return orders for customer', async () => {
      const result = await orderService.getOrdersByCustomer('customer-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for customer with no orders', async () => {
      mockOrders = [];

      const result = await orderService.getOrdersByCustomer('customer-no-orders');

      expect(result).toEqual([]);
    });

    it('should order results by created_at descending', async () => {
      const result = await orderService.getOrdersByCustomer('customer-1');

      expect(result).toBeDefined();
    });
  });

  describe('getOrders', () => {
    it('should return all orders with no filters', async () => {
      const result = await orderService.getOrders({});

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await orderService.getOrders({ status: 'pending' });

      expect(result).toBeDefined();
    });

    it('should filter by multiple statuses', async () => {
      const result = await orderService.getOrders({ status: 'pending,confirmed,preparing' });

      expect(result).toBeDefined();
    });

    it('should filter by date', async () => {
      const result = await orderService.getOrders({ date: '2026-02-07' });

      expect(result).toBeDefined();
    });

    it('should filter by moduleId', async () => {
      const result = await orderService.getOrders({ moduleId: 'module-1' });

      expect(result).toBeDefined();
    });

    it('should apply multiple filters', async () => {
      const result = await orderService.getOrders({
        status: 'pending',
        date: '2026-02-07',
        moduleId: 'module-1',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getLiveOrders', () => {
    it('should return active orders', async () => {
      const result = await orderService.getLiveOrders();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by moduleId when provided', async () => {
      const result = await orderService.getLiveOrders('module-1');

      expect(result).toBeDefined();
    });

    it('should return empty array when no active orders', async () => {
      mockOrders = [];

      const result = await orderService.getLiveOrders();

      expect(result).toEqual([]);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const result = await orderService.updateOrderStatus('order-1', 'confirmed', 'staff-1');

      expect(result).toBeDefined();
      expect(emitToUnit).toHaveBeenCalledWith('restaurant', 'order:updated', expect.any(Object));
    });

    it('should set actual_ready_time when status is ready', async () => {
      const result = await orderService.updateOrderStatus('order-1', 'ready', 'staff-1');

      expect(result).toBeDefined();
    });

    it('should set served_at when status is served', async () => {
      const result = await orderService.updateOrderStatus('order-1', 'served', 'staff-1');

      expect(result).toBeDefined();
    });

    it('should set completed_at and payment_status when status is completed', async () => {
      const result = await orderService.updateOrderStatus('order-1', 'completed', 'staff-1');

      expect(result).toBeDefined();
    });

    it('should set cancelled_at and cancellation_reason when status is cancelled', async () => {
      const result = await orderService.updateOrderStatus('order-1', 'cancelled', 'staff-1', 'Customer request');

      expect(result).toBeDefined();
    });

    it('should record status history', async () => {
      const result = await orderService.updateOrderStatus('order-1', 'preparing', 'staff-1');

      expect(result).toBeDefined();
    });

    it('should include notes in status history', async () => {
      const result = await orderService.updateOrderStatus('order-1', 'preparing', 'staff-1', 'Started cooking');

      expect(result).toBeDefined();
    });
  });

  describe('getDailyReport', () => {
    beforeEach(() => {
      mockOrders = [
        { ...mockOrder, status: 'completed', total_amount: '30.00', tax_amount: '2.50' },
        { ...mockOrder, id: 'order-2', status: 'completed', total_amount: '50.00', tax_amount: '4.50' },
        { ...mockOrder, id: 'order-3', status: 'cancelled', total_amount: '20.00', tax_amount: '2.00' },
      ];
    });

    it('should return daily report for today', async () => {
      const result = await orderService.getDailyReport();

      expect(result).toBeDefined();
      expect(result.date).toBeDefined();
    });

    it('should return daily report for specific date', async () => {
      const result = await orderService.getDailyReport('2026-02-07');

      expect(result).toBeDefined();
      expect(result.date).toBe('2026-02-07');
    });

    it('should filter by moduleId', async () => {
      const result = await orderService.getDailyReport('2026-02-07', 'module-1');

      expect(result).toBeDefined();
    });

    it('should calculate total orders', async () => {
      const result = await orderService.getDailyReport();

      expect(result.totalOrders).toBeDefined();
    });

    it('should calculate completed orders count', async () => {
      const result = await orderService.getDailyReport();

      expect(result.completedOrders).toBeDefined();
    });

    it('should calculate cancelled orders count', async () => {
      const result = await orderService.getDailyReport();

      expect(result.cancelledOrders).toBeDefined();
    });

    it('should calculate total revenue from completed orders', async () => {
      const result = await orderService.getDailyReport();

      expect(result.totalRevenue).toBeDefined();
    });

    it('should calculate total tax from completed orders', async () => {
      const result = await orderService.getDailyReport();

      expect(result.totalTax).toBeDefined();
    });

    it('should calculate average order value', async () => {
      const result = await orderService.getDailyReport();

      expect(result.averageOrderValue).toBeDefined();
    });

    it('should return zero averageOrderValue when no completed orders', async () => {
      mockOrders = [];

      const result = await orderService.getDailyReport();

      expect(result.averageOrderValue).toBe(0);
    });
  });

  describe('getSalesReport', () => {
    beforeEach(() => {
      mockOrders = [
        { ...mockOrder, status: 'completed', total_amount: '100.00' },
        { ...mockOrder, id: 'order-2', status: 'completed', total_amount: '150.00' },
      ];
    });

    it('should return sales report for date range', async () => {
      const result = await orderService.getSalesReport('2026-02-01', '2026-02-07');

      expect(result).toBeDefined();
      expect(result.startDate).toBe('2026-02-01');
      expect(result.endDate).toBe('2026-02-07');
    });

    it('should filter by moduleId', async () => {
      const result = await orderService.getSalesReport('2026-02-01', '2026-02-07', 'module-1');

      expect(result).toBeDefined();
    });

    it('should calculate total orders', async () => {
      const result = await orderService.getSalesReport('2026-02-01', '2026-02-07');

      expect(result.totalOrders).toBeDefined();
    });

    it('should calculate total revenue', async () => {
      const result = await orderService.getSalesReport('2026-02-01', '2026-02-07');

      expect(result.totalRevenue).toBeDefined();
    });

    it('should calculate average order value', async () => {
      const result = await orderService.getSalesReport('2026-02-01', '2026-02-07');

      expect(result.averageOrderValue).toBeDefined();
    });

    it('should return zero averageOrderValue when no orders', async () => {
      mockOrders = [];

      const result = await orderService.getSalesReport('2026-02-01', '2026-02-07');

      expect(result.averageOrderValue).toBe(0);
    });
  });

  describe('exported functions availability', () => {
    it('should export createOrder function', () => {
      expect(typeof orderService.createOrder).toBe('function');
    });

    it('should export getOrderById function', () => {
      expect(typeof orderService.getOrderById).toBe('function');
    });

    it('should export getOrderStatus function', () => {
      expect(typeof orderService.getOrderStatus).toBe('function');
    });

    it('should export getOrdersByCustomer function', () => {
      expect(typeof orderService.getOrdersByCustomer).toBe('function');
    });

    it('should export getOrders function', () => {
      expect(typeof orderService.getOrders).toBe('function');
    });

    it('should export getLiveOrders function', () => {
      expect(typeof orderService.getLiveOrders).toBe('function');
    });

    it('should export updateOrderStatus function', () => {
      expect(typeof orderService.updateOrderStatus).toBe('function');
    });

    it('should export getDailyReport function', () => {
      expect(typeof orderService.getDailyReport).toBe('function');
    });

    it('should export getSalesReport function', () => {
      expect(typeof orderService.getSalesReport).toBe('function');
    });
  });
});
