import { Request, Response, NextFunction } from 'express';
import * as orderService from "../services/order.service";

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.createOrder({
      ...req.body,
      customerId: req.user?.userId,
    });
    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
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

    if (!isOwner && !isAdminOrStaff) {
      // For non-owners, only return limited info (status tracking)
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
function transformOrderForFrontend(order: any) {
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
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      name: item.menu_items?.name || 'Unknown Item',
      quantity: item.quantity,
      unitPrice: parseFloat(item.unit_price || '0'),
      specialInstructions: item.special_instructions,
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
    const { status, notes } = req.body;
    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user!.userId,
      notes
    );
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
