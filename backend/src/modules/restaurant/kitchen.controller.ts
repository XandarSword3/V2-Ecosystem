import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { supabase } from '../../lib/supabase';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/async-handler';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';

export function createKitchenController(io: Server): Router {
  const router = Router();
  const kitchenNamespace = io.of('/kitchen');

  // Get all active orders for kitchen display
  router.get(
    '/orders',
    authenticate,
    authorize(['kitchen_staff', 'chef', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const statuses = ['PENDING', 'IN_PROGRESS', 'READY'];
      
      const { data: orders, error } = await supabase
        .from('kitchen_orders')
        .select(`
          *,
          items:kitchen_order_items(
            id,
            menu_item_id,
            name,
            quantity,
            modifications,
            notes,
            status,
            prepared_at
          ),
          table:restaurant_tables(number, name),
          server:users!server_id(full_name)
        `)
        .in('status', statuses)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        throw new AppError('Failed to fetch kitchen orders', 500);
      }

      const formattedOrders = orders.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        tableNumber: order.table?.number,
        tableName: order.table?.name,
        serverName: order.server?.full_name || 'Unknown',
        items: order.items.map((item: any) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          modifications: item.modifications || [],
          notes: item.notes,
          status: item.status,
          preparedAt: item.prepared_at,
        })),
        priority: order.priority,
        status: order.status,
        createdAt: order.created_at,
        startedAt: order.started_at,
        completedAt: order.completed_at,
        estimatedTime: order.estimated_time || 15,
        notes: order.notes,
      }));

      res.json({
        success: true,
        data: formattedOrders,
      });
    })
  );

  // Get kitchen stats
  router.get(
    '/stats',
    authenticate,
    authorize(['kitchen_staff', 'chef', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get counts by status
      const { data: statusCounts } = await supabase
        .from('kitchen_orders')
        .select('status')
        .in('status', ['PENDING', 'IN_PROGRESS']);

      const pendingOrders = statusCounts?.filter(o => o.status === 'PENDING').length || 0;
      const inProgressOrders = statusCounts?.filter(o => o.status === 'IN_PROGRESS').length || 0;

      // Get rush orders
      const { count: rushOrders } = await supabase
        .from('kitchen_orders')
        .select('*', { count: 'exact', head: true })
        .eq('priority', 'RUSH')
        .in('status', ['PENDING', 'IN_PROGRESS']);

      // Get completed today
      const { count: completedToday } = await supabase
        .from('kitchen_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .gte('completed_at', today.toISOString());

      // Calculate average wait time from recent completed orders
      const { data: recentOrders } = await supabase
        .from('kitchen_orders')
        .select('created_at, completed_at')
        .eq('status', 'COMPLETED')
        .gte('completed_at', today.toISOString())
        .limit(50);

      let averageWaitTime = 0;
      if (recentOrders && recentOrders.length > 0) {
        const totalTime = recentOrders.reduce((sum, order) => {
          const created = new Date(order.created_at).getTime();
          const completed = new Date(order.completed_at).getTime();
          return sum + (completed - created);
        }, 0);
        averageWaitTime = Math.round(totalTime / recentOrders.length / 1000 / 60);
      }

      res.json({
        success: true,
        data: {
          pendingOrders,
          inProgressOrders,
          rushOrders: rushOrders || 0,
          completedToday: completedToday || 0,
          averageWaitTime,
        },
      });
    })
  );

  // Start cooking an order
  router.post(
    '/orders/:orderId/start',
    authenticate,
    authorize(['kitchen_staff', 'chef', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;
      const userId = (req as any).user.id;

      // Check current status
      const { data: order, error: fetchError } = await supabase
        .from('kitchen_orders')
        .select('status, order_number, table_id')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        throw new AppError('Order not found', 404);
      }

      if (order.status !== 'PENDING') {
        throw new AppError('Order is not in pending status', 400);
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('kitchen_orders')
        .update({
          status: 'IN_PROGRESS',
          started_at: new Date().toISOString(),
          started_by: userId,
        })
        .eq('id', orderId);

      if (updateError) {
        throw new AppError('Failed to start order', 500);
      }

      // Update all items to PREPARING
      await supabase
        .from('kitchen_order_items')
        .update({ status: 'PREPARING' })
        .eq('order_id', orderId);

      // Emit socket event
      kitchenNamespace.emit('kitchen:order-updated', {
        id: orderId,
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
      });

      logger.info(`Order ${order.order_number} started by user ${userId}`);

      res.json({
        success: true,
        message: 'Order started',
      });
    })
  );

  // Mark an item as ready
  router.post(
    '/orders/:orderId/items/:itemId/ready',
    authenticate,
    authorize(['kitchen_staff', 'chef', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId, itemId } = req.params;

      const { error: updateError } = await supabase
        .from('kitchen_order_items')
        .update({
          status: 'READY',
          prepared_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('order_id', orderId);

      if (updateError) {
        throw new AppError('Failed to update item', 500);
      }

      // Fetch updated order with all items
      const { data: order } = await supabase
        .from('kitchen_orders')
        .select(`
          *,
          items:kitchen_order_items(id, status)
        `)
        .eq('id', orderId)
        .single();

      if (order) {
        // Emit update
        kitchenNamespace.emit('kitchen:order-updated', {
          id: orderId,
          items: order.items,
        });
      }

      res.json({
        success: true,
        message: 'Item marked as ready',
      });
    })
  );

  // Bump order (mark as ready for pickup)
  router.post(
    '/orders/:orderId/ready',
    authenticate,
    authorize(['kitchen_staff', 'chef', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;
      const { notes } = req.body;
      const userId = (req as any).user.id;

      // Check current status
      const { data: order, error: fetchError } = await supabase
        .from('kitchen_orders')
        .select('status, order_number, table_id')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        throw new AppError('Order not found', 404);
      }

      if (order.status !== 'IN_PROGRESS') {
        throw new AppError('Order is not in progress', 400);
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('kitchen_orders')
        .update({
          status: 'READY',
          ready_at: new Date().toISOString(),
          ready_by: userId,
          kitchen_notes: notes,
        })
        .eq('id', orderId);

      if (updateError) {
        throw new AppError('Failed to mark order as ready', 500);
      }

      // Mark all items as ready
      await supabase
        .from('kitchen_order_items')
        .update({
          status: 'READY',
          prepared_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .neq('status', 'READY');

      // Get table info for notification
      const { data: table } = await supabase
        .from('restaurant_tables')
        .select('number, name')
        .eq('id', order.table_id)
        .single();

      // Emit socket events
      kitchenNamespace.emit('kitchen:order-updated', {
        id: orderId,
        status: 'READY',
        readyAt: new Date().toISOString(),
        notes,
      });

      // Notify servers
      io.of('/restaurant').emit('order-ready', {
        orderId,
        orderNumber: order.order_number,
        tableNumber: table?.number,
        tableName: table?.name,
      });

      logger.info(`Order ${order.order_number} marked as ready`);

      res.json({
        success: true,
        message: 'Order marked as ready',
      });
    })
  );

  // Complete order (picked up by server)
  router.post(
    '/orders/:orderId/complete',
    authenticate,
    authorize(['server', 'kitchen_staff', 'chef', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;
      const userId = (req as any).user.id;

      // Check current status
      const { data: order, error: fetchError } = await supabase
        .from('kitchen_orders')
        .select('status, order_number')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        throw new AppError('Order not found', 404);
      }

      if (order.status !== 'READY') {
        throw new AppError('Order is not ready', 400);
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('kitchen_orders')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_by: userId,
        })
        .eq('id', orderId);

      if (updateError) {
        throw new AppError('Failed to complete order', 500);
      }

      // Mark all items as served
      await supabase
        .from('kitchen_order_items')
        .update({ status: 'SERVED' })
        .eq('order_id', orderId);

      // Emit socket event
      kitchenNamespace.emit('kitchen:order-updated', {
        id: orderId,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      });

      logger.info(`Order ${order.order_number} completed`);

      res.json({
        success: true,
        message: 'Order completed',
      });
    })
  );

  // Create new kitchen order (from POS/server)
  router.post(
    '/orders',
    authenticate,
    authorize(['server', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { tableId, items, priority = 'NORMAL', notes } = req.body;
      const serverId = (req as any).user.id;

      if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
        throw new AppError('Table ID and items are required', 400);
      }

      // Validate table
      const { data: table, error: tableError } = await supabase
        .from('restaurant_tables')
        .select('id, number, name')
        .eq('id', tableId)
        .single();

      if (tableError || !table) {
        throw new AppError('Table not found', 404);
      }

      // Generate order number
      const orderNumber = `K${Date.now().toString(36).toUpperCase()}`;

      // Calculate estimated time based on items
      const estimatedTime = Math.max(15, Math.min(45, items.length * 5));

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('kitchen_orders')
        .insert({
          order_number: orderNumber,
          table_id: tableId,
          server_id: serverId,
          priority,
          status: 'PENDING',
          estimated_time: estimatedTime,
          notes,
        })
        .select()
        .single();

      if (orderError || !order) {
        throw new AppError('Failed to create order', 500);
      }

      // Create order items
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        name: item.name,
        quantity: item.quantity || 1,
        modifications: item.modifications || [],
        notes: item.notes,
        status: 'PENDING',
      }));

      const { error: itemsError } = await supabase
        .from('kitchen_order_items')
        .insert(orderItems);

      if (itemsError) {
        // Rollback order
        await supabase.from('kitchen_orders').delete().eq('id', order.id);
        throw new AppError('Failed to create order items', 500);
      }

      // Fetch complete order for socket emission
      const { data: completeOrder } = await supabase
        .from('kitchen_orders')
        .select(`
          *,
          items:kitchen_order_items(
            id, name, quantity, modifications, notes, status
          )
        `)
        .eq('id', order.id)
        .single();

      // Emit new order to kitchen
      kitchenNamespace.emit('kitchen:new-order', {
        id: order.id,
        orderNumber,
        tableNumber: table.number,
        tableName: table.name,
        serverName: (req as any).user.fullName,
        items: completeOrder?.items || [],
        priority,
        status: 'PENDING',
        createdAt: order.created_at,
        estimatedTime,
        notes,
      });

      logger.info(`New kitchen order ${orderNumber} created for table ${table.number}`);

      res.status(201).json({
        success: true,
        data: {
          id: order.id,
          orderNumber,
        },
      });
    })
  );

  // Cancel order
  router.post(
    '/orders/:orderId/cancel',
    authenticate,
    authorize(['admin', 'chef']),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user.id;

      const { data: order, error: fetchError } = await supabase
        .from('kitchen_orders')
        .select('status, order_number')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        throw new AppError('Order not found', 404);
      }

      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        throw new AppError('Cannot cancel completed or already cancelled order', 400);
      }

      const { error: updateError } = await supabase
        .from('kitchen_orders')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: reason,
        })
        .eq('id', orderId);

      if (updateError) {
        throw new AppError('Failed to cancel order', 500);
      }

      // Emit socket event
      kitchenNamespace.emit('kitchen:order-cancelled', { orderId });

      logger.info(`Order ${order.order_number} cancelled by user ${userId}: ${reason}`);

      res.json({
        success: true,
        message: 'Order cancelled',
      });
    })
  );

  return router;
}

export default createKitchenController;
