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
  // Discount integration fields
  couponCode?: string;
  giftCardRedemptions?: Array<{
    code: string;
    amount: number;
  }>;
  loyaltyPointsToRedeem?: number;
  loyaltyPointsDollarValue?: number;
}

export interface OrderResult {
  order: RestaurantOrder;
  items: Array<{
    menuItem: RestaurantMenuItem;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  discountsApplied?: {
    coupon?: { code: string; discount: number; couponId: string };
    giftCards?: Array<{ code: string; amount: number; giftCardId: string }>;
    loyalty?: { pointsUsed: number; discount: number };
    totalDiscount: number;
  };
  loyaltyPointsEarned?: number;
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
      let preDiscountTotal = subtotal + taxAmount + serviceCharge + deliveryFee;

      // Initialize discount tracking
      let totalDiscount = 0;
      let couponDiscount = 0;
      let couponId: string | undefined;
      let giftCardAmount = 0;
      const giftCardRedemptions: Array<{ code: string; amount: number; giftCardId: string }> = [];
      let loyaltyPointsUsed = 0;
      let loyaltyDiscount = 0;

      const estimatedReadyTime = calculateEstimatedReadyTime(menuItemsList);

      // Create the order first (we need the ID for discount tracking)
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
        discount_amount: '0', // Will be updated after discounts are applied
        total_amount: preDiscountTotal.toFixed(2), // Will be updated
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

      // === APPLY DISCOUNTS (Order: Coupon -> Gift Cards -> Loyalty Points) ===
      let remainingTotal = preDiscountTotal;

      // Define types for RPC results
      interface CouponRpcResult {
        success: boolean;
        discount_amount: string;
        coupon_id: string;
        error_message?: string;
      }
      interface GiftCardRpcResult {
        success: boolean;
        amount_redeemed: string;
        gift_card_id: string;
      }
      interface LoyaltyRpcResult {
        success: boolean;
        points_redeemed: number;
        points_earned: number;
      }
      interface InventoryRpcResult {
        items_deducted: number;
      }

      // 1. Apply Coupon (if provided)
      if (input.couponCode) {
        try {
          const { data: couponData, error: couponError } = await restaurantRepository.rpc(
            'apply_coupon_atomic',
            {
              p_code: input.couponCode.toUpperCase(),
              p_user_id: input.customerId || null,
              p_order_total: subtotal, // Coupon applies to subtotal, not total with tax
              p_order_id: order.id,
              p_module_type: 'all', // Could map moduleId to type
            }
          );
          const couponResult = couponData as CouponRpcResult[] | null;

          if (couponError) {
            logger.warn('[ORDER SERVICE] Coupon application failed:', couponError);
          } else if (couponResult && couponResult[0]?.success) {
            couponDiscount = parseFloat(couponResult[0].discount_amount) || 0;
            couponId = couponResult[0].coupon_id;
            totalDiscount += couponDiscount;
            remainingTotal -= couponDiscount;
            logger.info('[ORDER SERVICE] Coupon applied:', { code: input.couponCode, discount: couponDiscount });
          } else if (couponResult && couponResult[0]?.error_message) {
            logger.warn('[ORDER SERVICE] Coupon invalid:', couponResult[0].error_message);
            // Don't fail the order, just skip the coupon
          }
        } catch (err) {
          logger.warn('[ORDER SERVICE] Coupon error (non-fatal):', err);
        }
      }

      // 2. Apply Gift Cards (if provided)
      if (input.giftCardRedemptions && input.giftCardRedemptions.length > 0) {
        for (const gc of input.giftCardRedemptions) {
          if (remainingTotal <= 0) break;

          try {
            const { data: gcData, error: gcError } = await restaurantRepository.rpc(
              'redeem_giftcard_atomic',
              {
                p_code: gc.code.toUpperCase(),
                p_amount: Math.min(gc.amount, remainingTotal),
                p_order_id: order.id,
              }
            );
            const gcResult = gcData as GiftCardRpcResult[] | null;

            if (gcError) {
              logger.warn('[ORDER SERVICE] Gift card redemption failed:', gcError);
            } else if (gcResult && gcResult[0]?.success) {
              const redeemed = parseFloat(gcResult[0].amount_redeemed) || 0;
              giftCardAmount += redeemed;
              totalDiscount += redeemed;
              remainingTotal -= redeemed;
              giftCardRedemptions.push({
                code: gc.code,
                amount: redeemed,
                giftCardId: gcResult[0].gift_card_id,
              });
              logger.info('[ORDER SERVICE] Gift card redeemed:', { code: gc.code, amount: redeemed });
            }
          } catch (err) {
            logger.warn('[ORDER SERVICE] Gift card error (non-fatal):', err);
          }
        }
      }

      // 3. Apply Loyalty Points (if provided)
      if (input.loyaltyPointsToRedeem && input.loyaltyPointsToRedeem > 0 && input.customerId) {
        try {
          const pointsDollarValue = input.loyaltyPointsDollarValue || (input.loyaltyPointsToRedeem / 100);
          const redeemAmount = Math.min(pointsDollarValue, remainingTotal);

          const { data: loyaltyData, error: loyaltyError } = await restaurantRepository.rpc(
            'redeem_loyalty_points_atomic',
            {
              p_user_id: input.customerId,
              p_points: input.loyaltyPointsToRedeem,
              p_order_id: order.id,
              p_dollar_value: redeemAmount,
            }
          );
          const loyaltyResult = loyaltyData as LoyaltyRpcResult[] | null;

          if (loyaltyError) {
            logger.warn('[ORDER SERVICE] Loyalty redemption failed:', loyaltyError);
          } else if (loyaltyResult && loyaltyResult[0]?.success) {
            loyaltyPointsUsed = loyaltyResult[0].points_redeemed || 0;
            loyaltyDiscount = redeemAmount;
            totalDiscount += loyaltyDiscount;
            remainingTotal -= loyaltyDiscount;
            logger.info('[ORDER SERVICE] Loyalty points redeemed:', { points: loyaltyPointsUsed, value: loyaltyDiscount });
          }
        } catch (err) {
          logger.warn('[ORDER SERVICE] Loyalty error (non-fatal):', err);
        }
      }

      // Calculate final total
      const finalTotal = Math.max(0, preDiscountTotal - totalDiscount);

      // Update order with discount information
      if (totalDiscount > 0) {
        await restaurantRepository.updateOrder(order.id, {
          discount_amount: totalDiscount.toFixed(2),
          total_amount: finalTotal.toFixed(2),
          coupon_id: couponId,
          coupon_code: input.couponCode,
          coupon_discount: couponDiscount.toFixed(2),
          gift_card_amount: giftCardAmount.toFixed(2),
          loyalty_points_used: loyaltyPointsUsed,
          loyalty_discount: loyaltyDiscount.toFixed(2),
        } as any);
        
        // Update local order object
        order.discount_amount = totalDiscount.toFixed(2);
        order.total_amount = finalTotal.toFixed(2);
      }

      // === EARN LOYALTY POINTS (if customer is logged in) ===
      let loyaltyPointsEarned = 0;
      if (input.customerId && finalTotal > 0) {
        try {
          const { data: earnData } = await restaurantRepository.rpc(
            'earn_loyalty_points_atomic',
            {
              p_user_id: input.customerId,
              p_order_total: finalTotal,
              p_order_id: order.id,
              p_points_per_dollar: 1, // Could be configurable
            }
          );
          const earnResult = earnData as LoyaltyRpcResult[] | null;

          if (earnResult && earnResult[0]?.success) {
            loyaltyPointsEarned = earnResult[0].points_earned || 0;
            logger.info('[ORDER SERVICE] Loyalty points earned:', loyaltyPointsEarned);
          }
        } catch (err) {
          logger.warn('[ORDER SERVICE] Points earning error (non-fatal):', err);
        }
      }

      // === DEDUCT INVENTORY (for ingredients linked to menu items) ===
      try {
        const { data: inventoryData, error: inventoryError } = await restaurantRepository.rpc(
          'deduct_inventory_for_order',
          { p_order_id: order.id }
        );
        const inventoryResult = inventoryData as InventoryRpcResult[] | null;

        if (inventoryError) {
          logger.warn('[ORDER SERVICE] Inventory deduction failed:', inventoryError);
        } else if (inventoryResult && inventoryResult[0]?.items_deducted > 0) {
          logger.info('[ORDER SERVICE] Inventory deducted:', inventoryResult[0].items_deducted, 'items');
        }
      } catch (err) {
        logger.warn('[ORDER SERVICE] Inventory deduction error (non-fatal):', err);
      }

      logger.info('[ORDER SERVICE] Order created:', order.order_number, {
        subtotal,
        totalDiscount,
        finalTotal,
        pointsEarned: loyaltyPointsEarned,
      });

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
        discountApplied: totalDiscount,
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
