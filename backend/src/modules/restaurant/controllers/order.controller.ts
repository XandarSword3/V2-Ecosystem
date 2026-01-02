import { Request, Response, NextFunction } from 'express';
import * as orderService from "../services/order.service";

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.createOrder({
      ...req.body,
      customerId: req.user?.userId,
    });
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
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

export async function getStaffOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, date } = req.query;
    const orders = await orderService.getOrders({
      status: status as string,
      date: date as string,
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

export async function getLiveOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await orderService.getLiveOrders();
    res.json({ success: true, data: orders });
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
    const { date } = req.query;
    const report = await orderService.getDailyReport(date as string);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function getSalesReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query;
    const report = await orderService.getSalesReport(
      startDate as string,
      endDate as string
    );
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}
