/**
 * Order Service
 *
 * Business logic for restaurant order operations with dependency injection.
 * Handles order creation, status updates, and cancellations.
 */

import type {
  RestaurantRepository,
  RestaurantOrder,
  RestaurantOrderItem,
  RestaurantMenuItem,
  EmailService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
} from '../container/types.js';

// ============================================
// ERROR TYPES
// ============================================

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'OrderServiceError';
  }
}

// ============================================
// SERVICE TYPES
// ============================================

export interface CreateOrderInput {
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service';
  tableId?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }>;
  specialInstructions?: string;
  paymentMethod?: string;
}

export interface OrderResult {
  order: RestaurantOrder;
  items: RestaurantOrderItem[];
}

export interface OrderServiceDeps {
  restaurantRepository: RestaurantRepository;
  emailService: EmailService;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
  config: AppConfig;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<RestaurantOrder['status'], RestaurantOrder['status'][]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'completed', 'delivered', 'cancelled'],
  served: ['completed', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

// Tax and fee constants
const TAX_RATE = 0.11;
const SERVICE_CHARGE_RATE = 0.10;
const DELIVERY_FEE = 5;

function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const suffix = Date.now().toString(36).slice(-4);
  return `R-${dateStr}-${random}${suffix}`;
}

// ============================================
// SERVICE INTERFACE
// ============================================

export interface OrderService {
  createOrder(input: CreateOrderInput): Promise<OrderResult>;
  getOrderById(id: string): Promise<OrderResult | null>;
  getOrderByNumber(orderNumber: string): Promise<RestaurantOrder | null>;
  getOrders(filters: { status?: string; orderType?: string }): Promise<RestaurantOrder[]>;
  getLiveOrders(): Promise<RestaurantOrder[]>;
  getOrdersByCustomer(customerId: string): Promise<RestaurantOrder[]>;
  updateOrderStatus(id: string, status: RestaurantOrder['status'], userId?: string): Promise<RestaurantOrder>;
  cancelOrder(id: string, reason: string, userId?: string): Promise<RestaurantOrder>;
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createOrderService(deps: OrderServiceDeps): OrderService {
  const { restaurantRepository, emailService, logger, activityLogger, socketEmitter, config } = deps;

  return {
    async createOrder(input: CreateOrderInput): Promise<OrderResult> {
      // Validate items
      if (!input.items || input.items.length === 0) {
        throw new OrderServiceError('Order must have at least one item', 'EMPTY_ORDER');
      }

      // Validate quantities
      for (const item of input.items) {
        if (!item.quantity || item.quantity < 1) {
          throw new OrderServiceError('Item quantity must be at least 1', 'INVALID_QUANTITY');
        }
      }

      // Fetch all menu items
      const menuItemIds = input.items.map(i => i.menuItemId);
      const menuItems = await restaurantRepository.getMenuItemsByIds(menuItemIds);
      const menuItemMap = new Map<string, RestaurantMenuItem>();
      for (const mi of menuItems) {
        menuItemMap.set(mi.id, mi);
      }

      // Validate all items exist and are available
      for (const item of input.items) {
        const menuItem = menuItemMap.get(item.menuItemId);
        if (!menuItem) {
          throw new OrderServiceError(
            `Menu item ${item.menuItemId} not found`,
            'MENU_ITEM_NOT_FOUND',
            404
          );
        }
        if (!menuItem.is_available) {
          throw new OrderServiceError(
            `Menu item ${menuItem.name} is not available`,
            'ITEM_UNAVAILABLE'
          );
        }
      }

      // Calculate totals
      let subtotal = 0;
      for (const item of input.items) {
        const menuItem = menuItemMap.get(item.menuItemId)!;
        subtotal += parseFloat(menuItem.price) * item.quantity;
      }

      const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
      const serviceCharge = input.orderType === 'dine_in'
        ? Math.round(subtotal * SERVICE_CHARGE_RATE * 100) / 100
        : 0;
      const deliveryFee = input.orderType === 'delivery' ? DELIVERY_FEE : 0;
      const totalAmount = Math.round((subtotal + taxAmount + serviceCharge + deliveryFee) * 100) / 100;

      const orderNumber = generateOrderNumber();

      // Create order in repository
      const order = await restaurantRepository.createOrder({
        order_number: orderNumber,
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        module_id: 'restaurant',
        order_type: input.orderType,
        table_id: input.tableId,
        status: 'pending',
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        service_charge: serviceCharge.toFixed(2),
        delivery_fee: deliveryFee.toFixed(2),
        discount_amount: '0',
        total_amount: totalAmount.toFixed(2),
        payment_status: 'pending',
        payment_method: input.paymentMethod,
        special_instructions: input.specialInstructions,
      } as Omit<RestaurantOrder, 'id' | 'created_at' | 'updated_at'>);

      // Create order items
      const orderItemsData = input.items.map(item => {
        const menuItem = menuItemMap.get(item.menuItemId)!;
        return {
          order_id: order.id,
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          unit_price: menuItem.price,
          subtotal: (parseFloat(menuItem.price) * item.quantity).toFixed(2),
          special_instructions: item.specialInstructions,
        } as Omit<RestaurantOrderItem, 'id' | 'created_at'>;
      });

      const items = await restaurantRepository.createOrderItems(orderItemsData);

      // Emit socket event
      socketEmitter.emitToUnit('restaurant', 'order:new', {
        orderId: order.id,
        orderNumber: order.order_number,
        orderType: input.orderType,
        customerName: input.customerName,
        totalAmount,
      });

      // Log activity
      await activityLogger.log(
        'CREATE_ORDER',
        {
          orderId: order.id,
          orderNumber: order.order_number,
          itemCount: input.items.length,
          totalAmount,
        },
        input.customerId
      );

      logger.info('Order created', { orderId: order.id, orderNumber: order.order_number });

      return { order, items };
    },

    async getOrderById(id: string): Promise<OrderResult | null> {
      const order = await restaurantRepository.getOrderById(id);
      if (!order) return null;
      const items = await restaurantRepository.getOrderItems(order.id);
      return { order, items };
    },

    async getOrderByNumber(orderNumber: string): Promise<RestaurantOrder | null> {
      return restaurantRepository.getOrderByNumber(orderNumber);
    },

    async getOrders(filters: { status?: string; orderType?: string }): Promise<RestaurantOrder[]> {
      return restaurantRepository.getOrders({ status: filters.status });
    },

    async getLiveOrders(): Promise<RestaurantOrder[]> {
      return restaurantRepository.getLiveOrders();
    },

    async getOrdersByCustomer(customerId: string): Promise<RestaurantOrder[]> {
      return restaurantRepository.getOrdersByCustomer(customerId);
    },

    async updateOrderStatus(id: string, status: RestaurantOrder['status'], userId?: string): Promise<RestaurantOrder> {
      const order = await restaurantRepository.getOrderById(id);
      if (!order) {
        throw new OrderServiceError('Order not found', 'ORDER_NOT_FOUND', 404);
      }

      // Validate status transition
      const allowedTransitions = VALID_TRANSITIONS[order.status];
      if (!allowedTransitions || !allowedTransitions.includes(status)) {
        throw new OrderServiceError(
          `Cannot transition from ${order.status} to ${status}`,
          'INVALID_STATUS_TRANSITION'
        );
      }

      const previousStatus = order.status;
      const updated = await restaurantRepository.updateOrder(id, { status });

      // Emit socket event
      socketEmitter.emitToUnit('restaurant', 'order:status', {
        orderId: id,
        status,
        previousStatus,
      });

      // Log activity
      await activityLogger.log(
        'UPDATE_ORDER_STATUS',
        { orderId: id, from: previousStatus, to: status },
        userId
      );

      logger.info('Order status updated', { orderId: id, from: previousStatus, to: status });

      return updated;
    },

    async cancelOrder(id: string, reason: string, userId?: string): Promise<RestaurantOrder> {
      const order = await restaurantRepository.getOrderById(id);
      if (!order) {
        throw new OrderServiceError('Order not found', 'ORDER_NOT_FOUND', 404);
      }

      if (order.status === 'completed') {
        throw new OrderServiceError('Cannot cancel a completed order', 'CANNOT_CANCEL');
      }
      if (order.status === 'cancelled') {
        throw new OrderServiceError('Order is already cancelled', 'ALREADY_CANCELLED');
      }

      const updated = await restaurantRepository.updateOrder(id, {
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      });

      // Emit socket event
      socketEmitter.emitToUnit('restaurant', 'order:cancelled', {
        orderId: id,
        reason,
      });

      // Log activity
      await activityLogger.log(
        'CANCEL_ORDER',
        { orderId: id, reason },
        userId
      );

      logger.info('Order cancelled', { orderId: id, reason });

      return updated;
    },
  };
}
