/**
 * Order Controller Factory
 * 
 * Creates thin HTTP handlers for restaurant order routes.
 * All business logic lives in OrderService.
 */

import { z } from 'zod';
import type { Request, Response } from 'express';
import type { OrderService } from '../services/order.service.js';
import type { LoggerService } from '../container/types.js';
import { isErrorWithStatusCode, getErrorMessage } from '../../types/index.js';

// Extended error type for service errors with code
interface ServiceError {
  statusCode: number;
  message: string;
  code?: string;
}

function isServiceError(error: unknown): error is ServiceError {
  return (
    isErrorWithStatusCode(error) &&
    (!(error as { code?: unknown }).code || typeof (error as { code?: unknown }).code === 'string')
  );
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery', 'room_service']),
  tableId: z.string().uuid().optional(),
  roomNumber: z.string().optional(),
  deliveryAddress: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    specialInstructions: z.string().optional(),
  })).min(1),
  specialInstructions: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'delivered', 'completed', 'cancelled']),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

const getOrdersQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled']).optional(),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery', 'room_service']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ============================================
// CONTROLLER TYPES
// ============================================

export interface OrderControllerDeps {
  orderService: OrderService;
  logger: LoggerService;
}

export interface OrderController {
  createOrder: (req: Request, res: Response) => Promise<void>;
  getOrderById: (req: Request, res: Response) => Promise<void>;
  getOrderByNumber: (req: Request, res: Response) => Promise<void>;
  getOrders: (req: Request, res: Response) => Promise<void>;
  getLiveOrders: (req: Request, res: Response) => Promise<void>;
  getMyOrders: (req: Request, res: Response) => Promise<void>;
  updateOrderStatus: (req: Request, res: Response) => Promise<void>;
  cancelOrder: (req: Request, res: Response) => Promise<void>;
}

// ============================================
// CONTROLLER FACTORY
// ============================================

export function createOrderController(deps: OrderControllerDeps): OrderController {
  const { orderService, logger } = deps;

  return {
    /**
     * Create a new order
     * POST /api/restaurant/orders
     */
    async createOrder(req: Request, res: Response): Promise<void> {
      try {
        const validation = createOrderSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const result = await orderService.createOrder(validation.data as any);

        res.status(201).json({
          success: true,
          data: {
            order: result.order,
            items: result.items,
          },
        });
      } catch (error: unknown) {
        logger.error('Create order failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to create order' });
      }
    },

    /**
     * Get order by ID
     * GET /api/restaurant/orders/:id
     */
    async getOrderById(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const result = await orderService.getOrderById(id);

        if (!result) {
          res.status(404).json({ error: 'Order not found' });
          return;
        }

        res.json({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        logger.error('Get order failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get order' });
      }
    },

    /**
     * Get order by order number
     * GET /api/restaurant/orders/number/:orderNumber
     */
    async getOrderByNumber(req: Request, res: Response): Promise<void> {
      try {
        const { orderNumber } = req.params;
        const order = await orderService.getOrderByNumber(orderNumber);

        if (!order) {
          res.status(404).json({ error: 'Order not found' });
          return;
        }

        // Get items for the order
        const result = await orderService.getOrderById(order.id);

        res.json({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        logger.error('Get order by number failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get order' });
      }
    },

    /**
     * Get orders with filtering
     * GET /api/restaurant/orders
     */
    async getOrders(req: Request, res: Response): Promise<void> {
      try {
        const validation = getOrdersQuerySchema.safeParse(req.query);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const orders = await orderService.getOrders(validation.data);

        res.json({
          success: true,
          data: orders,
        });
      } catch (error: unknown) {
        logger.error('Get orders failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get orders' });
      }
    },

    /**
     * Get live (active) orders
     * GET /api/restaurant/orders/live
     */
    async getLiveOrders(req: Request, res: Response): Promise<void> {
      try {
        const orders = await orderService.getLiveOrders();

        res.json({
          success: true,
          data: orders,
        });
      } catch (error: unknown) {
        logger.error('Get live orders failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get live orders' });
      }
    },

    /**
     * Get orders for current user
     * GET /api/restaurant/orders/mine
     */
    async getMyOrders(req: Request, res: Response): Promise<void> {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const orders = await orderService.getOrdersByCustomer(userId);

        res.json({
          success: true,
          data: orders,
        });
      } catch (error: unknown) {
        logger.error('Get my orders failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get orders' });
      }
    },

    /**
     * Update order status
     * PATCH /api/restaurant/orders/:id/status
     */
    async updateOrderStatus(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const validation = updateStatusSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const order = await orderService.updateOrderStatus(
          id,
          validation.data.status,
          userId
        );

        res.json({
          success: true,
          data: order,
        });
      } catch (error: unknown) {
        logger.error('Update order status failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to update order status' });
      }
    },

    /**
     * Cancel order
     * POST /api/restaurant/orders/:id/cancel
     */
    async cancelOrder(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const validation = cancelOrderSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const order = await orderService.cancelOrder(
          id,
          validation.data.reason,
          userId
        );

        res.json({
          success: true,
          data: order,
        });
      } catch (error: unknown) {
        logger.error('Cancel order failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to cancel order' });
      }
    },
  };
}
