/**
 * Snack Service
 * 
 * Business logic for snack bar operations with dependency injection.
 * Handles snack items, orders, and order status updates.
 */

import type {
  SnackRepository,
  SnackItem,
  SnackOrder,
  SnackOrderWithItems,
  SnackItemFilters,
  SnackOrderFilters,
  SnackCategory,
  SnackOrderStatus,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
} from '../container/types.js';

// ============================================
// ERROR TYPES
// ============================================

export class SnackServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SnackServiceError';
  }
}

// ============================================
// SERVICE TYPES
// ============================================

export interface CreateSnackItemInput {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  price: number;
  category?: SnackCategory;
  imageUrl?: string;
  displayOrder?: number;
  isAvailable?: boolean;
  moduleId?: string;
}

export interface UpdateSnackItemInput {
  name?: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  price?: number;
  category?: SnackCategory;
  imageUrl?: string;
  displayOrder?: number;
  isAvailable?: boolean;
}

export interface CreateSnackOrderInput {
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  items: Array<{
    itemId: string;
    quantity: number;
    notes?: string;
  }>;
}

export interface SnackServiceDeps {
  snackRepository: SnackRepository;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
}

export interface SnackService {
  // Item operations
  getItems(filters?: SnackItemFilters): Promise<SnackItem[]>;
  getItemById(id: string): Promise<SnackItem | null>;
  createItem(input: CreateSnackItemInput, userId?: string): Promise<SnackItem>;
  updateItem(id: string, input: UpdateSnackItemInput, userId?: string): Promise<SnackItem>;
  deleteItem(id: string, userId?: string): Promise<void>;
  setItemAvailability(id: string, isAvailable: boolean, userId?: string): Promise<SnackItem>;
  
  // Order operations
  createOrder(input: CreateSnackOrderInput, customerId?: string): Promise<SnackOrderWithItems>;
  getOrderById(id: string): Promise<SnackOrderWithItems | null>;
  getOrders(filters?: SnackOrderFilters): Promise<SnackOrderWithItems[]>;
  getCustomerOrders(customerId: string, limit?: number): Promise<SnackOrderWithItems[]>;
  getLiveOrders(): Promise<SnackOrderWithItems[]>;
  updateOrderStatus(id: string, status: SnackOrderStatus, userId?: string): Promise<SnackOrder>;
  
  // Categories (static)
  getCategories(): Promise<Array<{ id: string; name: string; display_order: number }>>;
}

// Static categories
const STATIC_CATEGORIES = [
  { id: 'sandwich', name: 'Sandwich', display_order: 1 },
  { id: 'drink', name: 'Drink', display_order: 2 },
  { id: 'snack', name: 'Snack', display_order: 3 },
  { id: 'ice_cream', name: 'Ice Cream', display_order: 4 },
];

function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const suffix = Date.now().toString(36).slice(-4);
  return `S-${dateStr}-${random}${suffix}`;
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createSnackService(deps: SnackServiceDeps): SnackService {
  const { snackRepository, logger, activityLogger, socketEmitter } = deps;

  return {
    // ============================================
    // ITEM OPERATIONS
    // ============================================

    async getItems(filters) {
      return snackRepository.getItems(filters);
    },

    async getItemById(id) {
      return snackRepository.getItemById(id);
    },

    async createItem(input, userId) {
      // Validate price
      if (input.price < 0) {
        throw new SnackServiceError('Price cannot be negative', 'INVALID_PRICE', 400);
      }

      const item = await snackRepository.createItem({
        name: input.name,
        name_ar: input.nameAr,
        name_fr: input.nameFr,
        description: input.description,
        description_ar: input.descriptionAr,
        price: input.price.toString(),
        category: input.category || 'snack',
        image_url: input.imageUrl,
        display_order: input.displayOrder || 0,
        is_available: input.isAvailable !== false,
        module_id: input.moduleId,
      });

      await activityLogger.log('CREATE_SNACK_ITEM', {
        itemId: item.id,
        name: item.name,
        price: input.price,
      }, userId);

      logger.info('Snack item created', { itemId: item.id, name: item.name });

      return item;
    },

    async updateItem(id, input, userId) {
      const existing = await snackRepository.getItemById(id);
      if (!existing) {
        throw new SnackServiceError('Item not found', 'ITEM_NOT_FOUND', 404);
      }

      // Validate price if provided
      if (input.price !== undefined && input.price < 0) {
        throw new SnackServiceError('Price cannot be negative', 'INVALID_PRICE', 400);
      }

      const updateData: Partial<SnackItem> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.nameAr !== undefined) updateData.name_ar = input.nameAr;
      if (input.nameFr !== undefined) updateData.name_fr = input.nameFr;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.descriptionAr !== undefined) updateData.description_ar = input.descriptionAr;
      if (input.price !== undefined) updateData.price = input.price.toString();
      if (input.category !== undefined) updateData.category = input.category;
      if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;
      if (input.displayOrder !== undefined) updateData.display_order = input.displayOrder;
      if (input.isAvailable !== undefined) updateData.is_available = input.isAvailable;

      const item = await snackRepository.updateItem(id, updateData);

      await activityLogger.log('UPDATE_SNACK_ITEM', {
        itemId: id,
        changes: input,
      }, userId);

      return item;
    },

    async deleteItem(id, userId) {
      const existing = await snackRepository.getItemById(id);
      if (!existing) {
        throw new SnackServiceError('Item not found', 'ITEM_NOT_FOUND', 404);
      }

      await snackRepository.deleteItem(id);

      await activityLogger.log('DELETE_SNACK_ITEM', {
        itemId: id,
        name: existing.name,
      }, userId);
    },

    async setItemAvailability(id, isAvailable, userId) {
      const existing = await snackRepository.getItemById(id);
      if (!existing) {
        throw new SnackServiceError('Item not found', 'ITEM_NOT_FOUND', 404);
      }

      const item = await snackRepository.setItemAvailability(id, isAvailable);

      await activityLogger.log('SET_SNACK_AVAILABILITY', {
        itemId: id,
        name: existing.name,
        isAvailable,
      }, userId);

      return item;
    },

    // ============================================
    // ORDER OPERATIONS
    // ============================================

    async createOrder(input, customerId) {
      // Validate items
      if (!input.items || input.items.length === 0) {
        throw new SnackServiceError('Order must have at least one item', 'EMPTY_ORDER', 400);
      }

      // Get all snack items for pricing
      const itemIds = input.items.map(i => i.itemId);
      const snackItems = await snackRepository.getItemsByIds(itemIds);
      const itemMap = new Map(snackItems.map(i => [i.id, i]));

      // Validate all items exist and are available
      let totalAmount = 0;
      const orderItemsData = input.items.map(item => {
        const snackItem = itemMap.get(item.itemId);
        if (!snackItem) {
          throw new SnackServiceError(`Item ${item.itemId} not found`, 'ITEM_NOT_FOUND', 404);
        }
        if (!snackItem.is_available) {
          throw new SnackServiceError(`${snackItem.name} is not available`, 'ITEM_UNAVAILABLE', 400);
        }

        const unitPrice = parseFloat(snackItem.price);
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;

        return {
          snack_item_id: item.itemId,
          quantity: item.quantity,
          unit_price: unitPrice.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notes: item.notes,
        };
      });

      // Calculate estimated ready time (10 minutes from now)
      const estimatedReadyTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Create order
      const order = await snackRepository.createOrder({
        order_number: generateOrderNumber(),
        customer_id: customerId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        status: 'pending',
        total_amount: totalAmount.toFixed(2),
        payment_status: 'pending',
        payment_method: input.paymentMethod,
        estimated_ready_time: estimatedReadyTime,
      });

      // Create order items
      await snackRepository.createOrderItems(
        orderItemsData.map(item => ({
          order_id: order.id,
          ...item,
        }))
      );

      // Emit socket event
      socketEmitter.emitToUnit('snack_bar', 'order:new', {
        orderId: order.id,
        orderNumber: order.order_number,
      });

      logger.info('Snack order created', { orderId: order.id, orderNumber: order.order_number });

      // Return full order with items
      const fullOrder = await snackRepository.getOrderById(order.id);
      return fullOrder!;
    },

    async getOrderById(id) {
      return snackRepository.getOrderById(id);
    },

    async getOrders(filters) {
      return snackRepository.getOrders(filters);
    },

    async getCustomerOrders(customerId, limit) {
      return snackRepository.getOrdersByCustomer(customerId, limit);
    },

    async getLiveOrders() {
      return snackRepository.getLiveOrders();
    },

    async updateOrderStatus(id, status, userId) {
      const existing = await snackRepository.getOrderById(id);
      if (!existing) {
        throw new SnackServiceError('Order not found', 'ORDER_NOT_FOUND', 404);
      }

      const additionalData: Partial<SnackOrder> = {};
      
      if (status === 'completed') {
        additionalData.completed_at = new Date().toISOString();
        additionalData.payment_status = 'paid';
      }

      const order = await snackRepository.updateOrderStatus(id, status, additionalData);

      socketEmitter.emitToUnit('snack_bar', 'order:updated', {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
      });

      await activityLogger.log('UPDATE_SNACK_ORDER_STATUS', {
        orderId: id,
        orderNumber: existing.order_number,
        previousStatus: existing.status,
        newStatus: status,
      }, userId);

      logger.info('Snack order status updated', { orderId: id, status });

      return order;
    },

    // ============================================
    // CATEGORIES
    // ============================================

    async getCategories() {
      return STATIC_CATEGORIES;
    },
  };
}
