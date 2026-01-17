/**
 * Order Service
 * 
 * Business logic for restaurant orders with dependency injection.
 * All dependencies are injected via constructor, making this fully testable.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  RestaurantRepository,
  RestaurantOrder,
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
  tableId?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service';
  items: Array<{
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }>;
  specialInstructions?: string;
  paymentMethod?: 'cash' | 'card' | 'whish' | 'online' | 'room_charge';
}

export interface OrderResult {
  order: RestaurantOrder;
  items: Array<{
    menuItem: RestaurantMenuItem;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export interface OrderServiceDependencies {
  restaurantRepository: RestaurantRepository;
  emailService: EmailService;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
  config: AppConfig;
}

// ============================================
// CONSTANTS
// ============================================

const TAX_RATE = 0.11; // 11% VAT in Lebanon
const SERVICE_CHARGE_RATE = 0.10; // 10% service for dine-in
const DELIVERY_FEE = 5; // Flat delivery fee

// ============================================
// ORDER SERVICE
// ============================================

export interface OrderService {
  createOrder(input: CreateOrderInput): Promise<OrderResult>;
  getOrderById(id: string): Promise<OrderResult | null>;
  getOrderByNumber(orderNumber: string): Promise<RestaurantOrder | null>;
  getOrders(filters: { status?: string; date?: string; moduleId?: string }): Promise<RestaurantOrder[]>;
  getLiveOrders(moduleId?: string): Promise<RestaurantOrder[]>;
  getOrdersByCustomer(customerId: string): Promise<RestaurantOrder[]>;
  updateOrderStatus(id: string, status: RestaurantOrder['status'], updatedBy?: string): Promise<RestaurantOrder>;
  cancelOrder(id: string, reason: string, cancelledBy?: string): Promise<RestaurantOrder>;
}

export function createOrderService(deps: OrderServiceDependencies): OrderService {
  const { restaurantRepository, emailService, logger, activityLogger, socketEmitter, config } = deps;

  function generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const suffix = Date.now().toString(36).slice(-4);
    return `R-${year}${month}${day}-${random}${suffix}`;
  }

  function calculateEstimatedReadyTime(menuItems: RestaurantMenuItem[]): string {
    const maxPrepTime = Math.max(...menuItems.map(i => i.preparation_time_minutes || 15));
    const readyTime = new Date(Date.now() + (maxPrepTime + 5) * 60 * 1000);
    return readyTime.toISOString();
  }

  return {
    async createOrder(input: CreateOrderInput): Promise<OrderResult> {
      logger.info('[ORDER SERVICE] Creating order for:', input.customerName);

      // Validate and get menu items
      const itemIds = input.items.map(i => i.menuItemId);
      const menuItemsList = await restaurantRepository.getMenuItemsByIds(itemIds);
      const itemMap = new Map(menuItemsList.map(i => [i.id, i]));

      // Validate all items exist and are available
      for (const item of input.items) {
        const menuItem = itemMap.get(item.menuItemId);
        if (!menuItem) {
          throw new OrderServiceError(
            `Menu item ${item.menuItemId} not found`,
            'MENU_ITEM_NOT_FOUND',
            404
          );
        }
        if (!menuItem.is_available) {
          throw new OrderServiceError(
            `${menuItem.name} is not available`,
            'ITEM_UNAVAILABLE',
            400
          );
        }
        if (item.quantity < 1) {
          throw new OrderServiceError(
            `Invalid quantity for ${menuItem.name}`,
            'INVALID_QUANTITY',
            400
          );
        }
      }

      // Get module_id from first item (all items assumed same module)
      const moduleId = menuItemsList[0]?.module_id;

      // Calculate totals
      let subtotal = 0;
      const orderItemsData = input.items.map(item => {
        const menuItem = itemMap.get(item.menuItemId)!;
        const unitPrice = parseFloat(menuItem.price);
        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;

        return {
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          unit_price: unitPrice.toFixed(2),
          subtotal: itemSubtotal.toFixed(2),
          special_instructions: item.specialInstructions,
        };
      });

      const taxAmount = subtotal * TAX_RATE;
      const serviceCharge = input.orderType === 'dine_in' ? subtotal * SERVICE_CHARGE_RATE : 0;
      const deliveryFee = input.orderType === 'delivery' ? DELIVERY_FEE : 0;
      const totalAmount = subtotal + taxAmount + serviceCharge + deliveryFee;

      const estimatedReadyTime = calculateEstimatedReadyTime(menuItemsList);

      // Create the order
      const order = await restaurantRepository.createOrder({
        order_number: generateOrderNumber(),
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        table_id: input.tableId,
        module_id: moduleId,
        order_type: input.orderType,
        status: 'pending',
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        service_charge: serviceCharge.toFixed(2),
        delivery_fee: deliveryFee.toFixed(2),
        discount_amount: '0',
        total_amount: totalAmount.toFixed(2),
        special_instructions: input.specialInstructions,
        estimated_ready_time: estimatedReadyTime,
        payment_status: 'pending',
        payment_method: input.paymentMethod,
      });

      // Create order items
      await restaurantRepository.createOrderItems(
        orderItemsData.map(item => ({
          order_id: order.id,
          ...item,
        }))
      );

      logger.info('[ORDER SERVICE] Order created:', order.order_number);

      // Emit real-time event to restaurant staff
      socketEmitter.emitToUnit('restaurant', 'order:new', {
        orderId: order.id,
        orderNumber: order.order_number,
        orderType: order.order_type,
        totalAmount: order.total_amount,
        moduleId: order.module_id,
      });

      // Log activity
      await activityLogger.log('CREATE_ORDER', {
        orderId: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        itemCount: input.items.length,
      }, input.customerId);

      // Send confirmation email (non-blocking)
      if (input.customerEmail) {
        this.sendOrderConfirmationEmail(order, menuItemsList, orderItemsData).catch(err => {
          logger.warn('[ORDER SERVICE] Failed to send confirmation email:', err);
        });
      }

      // Build result
      const resultItems = input.items.map(item => {
        const menuItem = itemMap.get(item.menuItemId)!;
        const unitPrice = parseFloat(menuItem.price);
        return {
          menuItem,
          quantity: item.quantity,
          unitPrice,
          subtotal: unitPrice * item.quantity,
        };
      });

      return { order, items: resultItems };
    },

    async sendOrderConfirmationEmail(
      order: RestaurantOrder,
      menuItems: RestaurantMenuItem[],
      orderItems: Array<{ menu_item_id: string; quantity: number; unit_price: string; subtotal: string }>
    ): Promise<void> {
      const itemMap = new Map(menuItems.map(i => [i.id, i]));
      
      const formattedItems = orderItems.map(item => {
        const menuItem = itemMap.get(item.menu_item_id);
        return `${menuItem?.name || 'Item'} x ${item.quantity} - $${item.subtotal}`;
      });

      await emailService.sendEmail({
        to: order.customer_email!,
        subject: `Order Confirmation - ${order.order_number}`,
        html: `
          <h1>Order Confirmed!</h1>
          <p>Thank you for your order, ${order.customer_name}!</p>
          <p><strong>Order Number:</strong> ${order.order_number}</p>
          <p><strong>Estimated Ready Time:</strong> ${order.estimated_ready_time}</p>
          <h3>Order Details:</h3>
          <ul>${formattedItems.map(i => `<li>${i}</li>`).join('')}</ul>
          <p><strong>Total:</strong> $${order.total_amount}</p>
          <p>Thank you for dining with us!</p>
        `,
      });
    },

    async getOrderById(id: string): Promise<OrderResult | null> {
      const order = await restaurantRepository.getOrderById(id);
      if (!order) return null;

      const orderItems = await restaurantRepository.getOrderItems(id);
      const menuItemIds = orderItems.map(i => i.menu_item_id);
      const menuItemsList = await restaurantRepository.getMenuItemsByIds(menuItemIds);
      const itemMap = new Map(menuItemsList.map(i => [i.id, i]));

      const items = orderItems.map(item => {
        const menuItem = itemMap.get(item.menu_item_id)!;
        return {
          menuItem,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price),
          subtotal: parseFloat(item.subtotal),
        };
      });

      return { order, items };
    },

    async getOrderByNumber(orderNumber: string): Promise<RestaurantOrder | null> {
      return restaurantRepository.getOrderByNumber(orderNumber);
    },

    async getOrders(filters: { status?: string; date?: string; moduleId?: string }): Promise<RestaurantOrder[]> {
      return restaurantRepository.getOrders(filters);
    },

    async getLiveOrders(moduleId?: string): Promise<RestaurantOrder[]> {
      return restaurantRepository.getLiveOrders(moduleId);
    },

    async getOrdersByCustomer(customerId: string): Promise<RestaurantOrder[]> {
      return restaurantRepository.getOrdersByCustomer(customerId);
    },

    async updateOrderStatus(id: string, status: RestaurantOrder['status'], updatedBy?: string): Promise<RestaurantOrder> {
      const order = await restaurantRepository.getOrderById(id);
      if (!order) {
        throw new OrderServiceError('Order not found', 'ORDER_NOT_FOUND', 404);
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      if (!validTransitions[order.status]?.includes(status)) {
        throw new OrderServiceError(
          `Cannot transition from ${order.status} to ${status}`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      const updatedOrder = await restaurantRepository.updateOrder(id, { status });

      logger.info('[ORDER SERVICE] Order status updated:', {
        orderId: id,
        from: order.status,
        to: status,
      });

      // Emit real-time update
      socketEmitter.emitToUnit('restaurant', 'order:status', {
        orderId: id,
        orderNumber: order.order_number,
        status,
        previousStatus: order.status,
      });

      await activityLogger.log('UPDATE_ORDER_STATUS', {
        orderId: id,
        from: order.status,
        to: status,
      }, updatedBy);

      return updatedOrder;
    },

    async cancelOrder(id: string, reason: string, cancelledBy?: string): Promise<RestaurantOrder> {
      const order = await restaurantRepository.getOrderById(id);
      if (!order) {
        throw new OrderServiceError('Order not found', 'ORDER_NOT_FOUND', 404);
      }

      if (order.status === 'completed' || order.status === 'cancelled') {
        throw new OrderServiceError(
          `Cannot cancel ${order.status} order`,
          'CANNOT_CANCEL',
          400
        );
      }

      const updatedOrder = await restaurantRepository.updateOrder(id, {
        status: 'cancelled',
      });

      logger.info('[ORDER SERVICE] Order cancelled:', {
        orderId: id,
        reason,
      });

      socketEmitter.emitToUnit('restaurant', 'order:cancelled', {
        orderId: id,
        orderNumber: order.order_number,
        reason,
      });

      await activityLogger.log('CANCEL_ORDER', {
        orderId: id,
        reason,
      }, cancelledBy);

      return updatedOrder;
    },
  } as OrderService & { sendOrderConfirmationEmail: (order: RestaurantOrder, menuItems: RestaurantMenuItem[], orderItems: Array<{ menu_item_id: string; quantity: number; unit_price: string; subtotal: string }>) => Promise<void> };
}
