import { Request, Response, NextFunction } from 'express';
import * as orderService from "../services/order.service.js";
import { logActivity } from "../../../utils/activityLogger.js";

import { createRestaurantOrderSchema, updateOrderStatusSchema, validateBody } from "../../../validation/schemas.js";
import { isErrorWithStatusCode, RestaurantOrderRow, OrderItemRow } from "../../../types/index.js";

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = validateBody(createRestaurantOrderSchema, req.body);

    const formattedItems = validatedData.items.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      specialInstructions: item.notes,
    }));

    const order = await orderService.createOrder({
      customerName: validatedData.customerName || 'Guest',
      customerPhone: validatedData.customerPhone ?? undefined,
      orderType: validatedData.orderType,
      tableNumber: validatedData.tableNumber,
      items: formattedItems,
      paymentMethod: validatedData.paymentMethod,
      specialInstructions: validatedData.specialInstructions,
      customerId: req.user?.userId,
      // Pass discount fields from request body
      couponCode: req.body.couponCode,
      giftCardRedemptions: req.body.giftCardRedemptions,
      loyaltyPointsToRedeem: req.body.loyaltyPointsToRedeem,
      loyaltyPointsDollarValue: req.body.loyaltyPointsDollarValue,
    });
    
    // Audit log for order creation
    logActivity({
      user_id: req.user?.userId || 'guest',
      action: 'order_created',
      resource: 'restaurant_order',
      resource_id: order.id,
      new_value: { order_number: order.order_number, total: order.total_amount, items: formattedItems.length },
      ip_address: req.ip,
    });
    
    res.status(201).json({ success: true, data: order });
  } catch (error: unknown) {
    if (isErrorWithStatusCode(error)) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      next(error);
    }
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Security: Only order owner or admin/staff can view full order details
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const isOwner = order.customer_id === userId;
    const isAdminOrStaff = userRoles.includes('admin') || userRoles.includes('staff');
    
    // Guest orders (no customer_id) can be viewed by anyone with the order ID
    // This allows guests to see their order confirmation page
    const isGuestOrder = !order.customer_id;

    if (!isOwner && !isAdminOrStaff && !isGuestOrder) {
      // For non-owners viewing non-guest orders, only return limited info (status tracking)
      return res.json({
        success: true,
        data: {
          id: order.id,
          status: order.status,
          created_at: order.created_at,
          estimated_ready_time: order.estimated_ready_time
        }
      });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function getOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await orderService.getOrderStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await orderService.getOrdersByCustomer(req.user!.userId);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

// Helper function to transform order data for frontend
interface OrderWithItems extends RestaurantOrderRow {
  customer?: { full_name?: string } | null;
}

function transformOrderForFrontend(order: OrderWithItems) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name || order.customer?.full_name || 'Guest',
    customerPhone: order.customer_phone,
    orderType: order.order_type,
    status: order.status,
    tableNumber: order.table_number,
    totalAmount: parseFloat(order.total_amount || '0'),
    createdAt: order.created_at,
    estimatedReadyTime: order.estimated_ready_time,
    items: (order.order_items || []).map((item: OrderItemRow) => ({
      id: item.id,
      name: item.menu_items?.name || 'Unknown Item',
      quantity: item.quantity,
      unitPrice: parseFloat(item.unit_price || '0'),
      specialInstructions: item.notes,
    })),
    // Also include snake_case for compatibility
    order_number: order.order_number,
    customer_name: order.customer_name,
    order_type: order.order_type,
    total_amount: order.total_amount,
    created_at: order.created_at,
  };
}

export async function getStaffOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, date, moduleId } = req.query;
    const orders = await orderService.getOrders({
      status: status as string,
      date: date as string,
      moduleId: moduleId as string,
    });
    // Transform to camelCase format for frontend
    const transformedOrders = orders.map(transformOrderForFrontend);
    res.json({ success: true, data: transformedOrders });
  } catch (error) {
    next(error);
  }
}

export async function getLiveOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { moduleId } = req.query;
    const orders = await orderService.getLiveOrders(moduleId as string);
    // Transform to camelCase format for frontend
    const transformedOrders = orders.map(transformOrderForFrontend);
    res.json({ success: true, data: transformedOrders });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, notes } = validateBody(updateOrderStatusSchema, req.body);
    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user!.userId,
      notes
    );
    
    // Audit log for status change
    logActivity({
      user_id: req.user!.userId,
      action: 'order_status_changed',
      resource: 'restaurant_order',
      resource_id: req.params.id,
      new_value: { status, notes },
      ip_address: req.ip,
    });
    
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function getDailyReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, moduleId } = req.query;
    const report = await orderService.getDailyReport(date as string, moduleId as string);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function getSalesReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate, moduleId } = req.query;
    const report = await orderService.getSalesReport(
      startDate as string,
      endDate as string,
      moduleId as string
    );
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}
