import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import * as orderService from "../services/order.service.js";
import { logActivity } from "../../../utils/activityLogger.js";
import { getSupabase } from '../../../database/connection.js';

import { createRestaurantOrderSchema, updateOrderStatusSchema, validateBody } from "../../../validation/schemas.js";
import { isErrorWithStatusCode, RestaurantOrderRow, OrderItemRow } from "../../../types/index.js";

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = validateBody(createRestaurantOrderSchema, req.body);

    // FIX: Iteration 1 - Pass selectedModifiers and modifierTotal through to service.
    // Previously these fields were dropped here, causing all modifier pricing to be lost.
    const formattedItems = validatedData.items.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      specialInstructions: item.notes,
      selectedModifiers: item.selectedModifiers?.map(modifier => ({
        optionId: modifier.optionId,
        optionName: modifier.optionName ?? '',
        groupId: modifier.groupId,
        groupName: modifier.groupName ?? '',
        modifierType: modifier.modifierType ?? 'add',
        priceAdjustment: modifier.priceAdjustment ?? 0,
        quantity: modifier.quantity ?? 1,
        inventoryItemId: modifier.inventoryItemId,
        inventoryQuantity: modifier.inventoryQuantity,
      })),
      modifierTotal: item.modifierTotal,
    }));

    // FIX: Iteration 1 - Use validated discount fields instead of raw req.body
    const order = await orderService.createOrder({
      customerName: validatedData.customerName || 'Guest',
      customerPhone: validatedData.customerPhone ?? undefined,
      orderType: validatedData.orderType,
      tableNumber: validatedData.tableNumber,
      items: formattedItems,
      paymentMethod: validatedData.paymentMethod,
      specialInstructions: validatedData.specialInstructions,
      customerId: req.user?.userId,
      couponCode: validatedData.couponCode,
      giftCardRedemptions: validatedData.giftCardRedemptions,
      loyaltyPointsToRedeem: validatedData.loyaltyPointsToRedeem,
      loyaltyPointsDollarValue: validatedData.loyaltyPointsDollarValue,
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

export const createStaffOrder = asyncHandler(async (req: Request, res: Response) => {
    const userRoles = req.user?.roles || [];
    const allowedRoles = ['staff', 'restaurant_staff', 'restaurant_admin', 'admin', 'super_admin'];
    if (!userRoles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const body = req.body as {
      customer_id?: string;
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      table_number?: string;
      items: Array<{
        item_id?: string;
        menuItemId?: string;
        quantity: number;
        notes?: string;
        selectedModifiers?: Array<{
          optionId: string;
          optionName?: string;
          groupId: string;
          groupName?: string;
          modifierType?: 'add' | 'remove' | 'swap';
          priceAdjustment?: number;
          quantity?: number;
          inventoryItemId?: string;
          inventoryQuantity?: number;
        }>;
      }>;
      notes?: string;
    };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ success: false, error: 'items are required' });
    }

    const order = await orderService.createOrder({
      customerId: body.customer_id,
      customerName: body.customer_name || 'Walk-in Guest',
      customerPhone: body.customer_phone,
      customerEmail: body.customer_email,
      tableNumber: body.table_number,
      orderType: 'dine_in',
      items: body.items.map((item) => ({
        menuItemId: item.menuItemId || item.item_id || '',
        quantity: item.quantity,
        specialInstructions: item.notes,
        selectedModifiers: item.selectedModifiers?.map((modifier) => ({
          optionId: modifier.optionId,
          optionName: modifier.optionName || '',
          groupId: modifier.groupId,
          groupName: modifier.groupName || '',
          modifierType: modifier.modifierType || 'add',
          priceAdjustment: modifier.priceAdjustment || 0,
          quantity: modifier.quantity || 1,
          inventoryItemId: modifier.inventoryItemId,
          inventoryQuantity: modifier.inventoryQuantity,
        })),
      })),
      specialInstructions: body.notes,
      paymentMethod: 'cash',
    });

    // Staff-side order starts directly as confirmed.
    await orderService.updateOrderStatus(
      order.id,
      'confirmed',
      req.user?.userId || 'system',
    );

    res.status(201).json({ success: true, data: { ...order, status: 'confirmed' } });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Security: Only order owner or admin/staff can view full order details
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const isOwner = order.customer_id === userId;
    const staffLikeRoles = ['admin', 'super_admin', 'staff', 'restaurant_staff', 'restaurant_admin', 'snack_bar_staff', 'snack_bar_admin'];
    const isAdminOrStaff = userRoles.some(r => staffLikeRoles.includes(r));
    
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
});

export const getOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const status = await orderService.getOrderStatus(req.params.id);
    res.json({ success: true, data: status });
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getOrdersByCustomer(req.user!.userId);
    res.json({ success: true, data: orders });
});

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

export const getStaffOrders = asyncHandler(async (req: Request, res: Response) => {
    const { status, date, moduleId } = req.query;
    const orders = await orderService.getOrders({
      status: status as string,
      date: date as string,
      moduleId: moduleId as string,
    });
    // Transform to camelCase format for frontend
    const transformedOrders = orders.map(transformOrderForFrontend);
    res.json({ success: true, data: transformedOrders });
});

export const getLiveOrders = asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = req.query;
    const orders = await orderService.getLiveOrders(moduleId as string);
    // Transform to camelCase format for frontend
    const transformedOrders = orders.map(transformOrderForFrontend);
    res.json({ success: true, data: transformedOrders });
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
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
});

export const getDailyReport = asyncHandler(async (req: Request, res: Response) => {
    const { date, moduleId } = req.query;
    const report = await orderService.getDailyReport(date as string, moduleId as string);
    res.json({ success: true, data: report });
});

export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, moduleId } = req.query;
    const report = await orderService.getSalesReport(
      startDate as string,
      endDate as string,
      moduleId as string
    );
    res.json({ success: true, data: report });
});

export const splitOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { method, parts } = req.body as { method: 'equal' | 'item' | 'amount' | 'seat'; parts: number };

    if (method !== 'equal') {
      return res.status(501).json({
        success: false,
        error: `Split method "${method}" is not_implemented. Only "equal" is supported right now.`,
      });
    }
    if (!parts || parts < 2) {
      return res.status(400).json({ success: false, error: 'parts must be at least 2' });
    }

    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('id, total_amount, status')
      .eq('id', id)
      .single();
    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const total = parseFloat(String(order.total_amount || 0));
    const each = Number((total / parts).toFixed(2));
    const splitPayments = Array.from({ length: parts }).map((_, idx) => ({
      reference_type: 'restaurant_order',
      reference_id: id,
      amount: idx === parts - 1 ? Number((total - each * (parts - 1)).toFixed(2)).toFixed(2) : each.toFixed(2),
      currency: 'USD',
      method: 'split',
      status: 'pending',
      notes: `Split bill part ${idx + 1}/${parts}`,
      processed_by: req.user?.userId,
      processed_at: new Date().toISOString(),
    }));
    const { error: paymentError } = await supabase.from('payments').insert(splitPayments);
    if (paymentError) throw paymentError;

    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update({ status: 'split', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;

    res.json({
      success: true,
      data: {
        order: updatedOrder,
        method,
        parts,
        per_part_amount: each,
      },
    });
});
