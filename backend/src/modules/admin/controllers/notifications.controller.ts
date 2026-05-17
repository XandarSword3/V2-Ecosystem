/**
 * Notifications Controller
 * Handles notification retrieval and management with templates, scheduling, and priorities
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { getContainer } from '../../../lib/container';
import type { NotificationPriority, NotificationTargetType, NotificationType } from '../../../lib/container/types';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const container = getContainer();
    const notificationService = container.notificationService();
    const { userId } = req.query;
    
    // Get notifications from the service
    const notifications = await notificationService.getForUser(
      userId as string || req.user?.userId || '',
      {
        unreadOnly: req.query.unreadOnly === 'true',
        type: req.query.type as NotificationType,
        limit: parseInt(req.query.limit as string) || 20
      }
    );
    
    // Also get recent system events as real-time notifications
    const supabase = getSupabase();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const systemNotifications: Array<{ 
      id: string; 
      title: string; 
      message: string; 
      type: string;
      target_type: string;
      created_at: string; 
      is_read: boolean;
      priority: string;
    }> = [];

    // Get recent restaurant orders with error handling
    try {
      const { data: recentOrders } = await supabase
        .from('transactions')
        .select('id, order_number, status, created_at')
        .eq('engine_type', 'instant_transaction')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      (recentOrders || []).forEach(order => {
        systemNotifications.push({
          id: `order-${order.id}`,
          title: 'New Order',
          message: `Order #${order.order_number} - ${order.status}`,
          type: 'info',
          target_type: 'staff',
          created_at: order.created_at,
          is_read: order.status !== 'pending',
          priority: order.status === 'pending' ? 'high' : 'normal',
        });
      });
    } catch (error) {
      logger.warn('Failed to fetch recent restaurant orders for notifications:', error);
    }

    // Get recent chalet bookings with error handling
    try {
      const { data: recentBookings } = await supabase
        .from('transactions')
        .select('id, status, created_at, metadata')
        .eq('engine_type', 'time_exclusive_reservation')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      (recentBookings || []).forEach(booking => {
        systemNotifications.push({
          id: `booking-${booking.id}`,
          title: 'Chalet Booking',
          message: `New booking — ${booking.status}`,
          type: 'info',
          target_type: 'staff',
          created_at: booking.created_at,
          is_read: booking.status !== 'pending',
          priority: 'normal',
        });
      });
    } catch (error) {
      logger.warn('Failed to fetch recent chalet bookings for notifications:', error);
    }

    // Get pending reviews with error handling
    try {
      const { data: pendingReviews } = await supabase
        .from('reviews')
        .select('id, rating, created_at')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })
        .limit(5);

      (pendingReviews || []).forEach(review => {
        systemNotifications.push({
          id: `review-${review.id}`,
          title: 'Review Pending',
          message: `New ${review.rating}-star review awaiting approval`,
          type: 'warning',
          target_type: 'admin',
          created_at: review.created_at,
          is_read: false,
          priority: 'normal',
        });
      });
    } catch (error) {
      logger.warn('Failed to fetch pending reviews for notifications:', error);
    }

    // Combine stored notifications with system notifications
    const allNotifications = [
      ...notifications,
      ...systemNotifications
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ 
      success: true, 
      data: allNotifications.slice(0, 20),
      total: notifications.length + systemNotifications.length
    });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const container = getContainer();
    const notificationService = container.notificationService();
    
    const notification = await notificationService.markAsRead(id);
    res.json({ success: true, data: notification });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
    const container = getContainer();
    const notificationService = container.notificationService();
    const userId = req.user?.userId || '';
    
    const count = await notificationService.markAllAsRead(userId);
    res.json({ success: true, message: `${count} notifications marked as read` });
});

export const broadcastNotification = asyncHandler(async (req: Request, res: Response) => {
    const { 
      title, 
      message, 
      type = 'info', 
      target_type = 'all',
      priority = 'normal',
      target_user_ids,
      actions,
      scheduled_for
    } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required' });
    }

    const container = getContainer();
    const notificationService = container.notificationService();
    
    const broadcast = await notificationService.broadcast({
      title,
      message,
      type: type as NotificationType,
      targetType: target_type as NotificationTargetType,
      priority: priority as NotificationPriority,
      targetUserIds: target_user_ids,
      actions,
      scheduledFor: scheduled_for,
      createdBy: req.user?.userId || ''
    });

    res.status(201).json({ success: true, data: broadcast });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const container = getContainer();
    const notificationService = container.notificationService();
    
    await notificationService.delete(id);
    res.json({ success: true, message: 'Notification deleted' });
});

export const deleteMultipleNotifications = asyncHandler(async (req: Request, res: Response) => {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of notification IDs required' });
    }
    
    const container = getContainer();
    const notificationService = container.notificationService();
    
    const count = await notificationService.deleteMultiple(ids);
    res.json({ success: true, message: `${count} notifications deleted` });
});

// Template Management
export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
    const container = getContainer();
    const notificationService = container.notificationService();
    const activeOnly = req.query.activeOnly !== 'false';
    
    const templates = await notificationService.getTemplates(activeOnly);
    res.json({ success: true, data: templates });
});

export const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const container = getContainer();
    const notificationService = container.notificationService();
    
    const template = await notificationService.getTemplateById(id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, data: template });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { 
      name, 
      title, 
      message, 
      type = 'info', 
      target_type = 'all',
      priority = 'normal',
      actions,
      variables,
      is_active = true
    } = req.body;
    
    if (!name || !title || !message) {
      return res.status(400).json({ success: false, error: 'Name, title, and message are required' });
    }

    const container = getContainer();
    const notificationService = container.notificationService();
    
    const template = await notificationService.createTemplate({
      name,
      title,
      message,
      type: type as NotificationType,
      targetType: target_type as NotificationTargetType,
      priority: priority as NotificationPriority,
      actions,
      variables: variables || [],
      isActive: is_active
    });

    res.status(201).json({ success: true, data: template });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    
    const container = getContainer();
    const notificationService = container.notificationService();
    
    const template = await notificationService.updateTemplate(id, {
      name: updates.name,
      title: updates.title,
      message: updates.message,
      type: updates.type,
      targetType: updates.target_type,
      priority: updates.priority,
      actions: updates.actions,
      variables: updates.variables,
      isActive: updates.is_active
    });

    res.json({ success: true, data: template });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const container = getContainer();
    const notificationService = container.notificationService();
    
    await notificationService.deleteTemplate(id);
    res.json({ success: true, message: 'Template deleted' });
});

export const sendFromTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { variables = {}, target_user_ids, scheduled_for } = req.body;
    
    const container = getContainer();
    const notificationService = container.notificationService();
    
    const broadcast = await notificationService.sendFromTemplate(
      id, 
      variables, 
      {
        targetUserIds: target_user_ids,
        scheduledFor: scheduled_for,
        createdBy: req.user?.userId || ''
      }
    );

    res.status(201).json({ success: true, data: broadcast });
});

// Broadcast Management
export const getBroadcasts = asyncHandler(async (req: Request, res: Response) => {
    const container = getContainer();
    const notificationService = container.notificationService();
    const targetType = req.query.target_type as NotificationTargetType | undefined;
    
    const broadcasts = await notificationService.getBroadcasts(targetType);
    res.json({ success: true, data: broadcasts });
});

export const getValidPriorities = asyncHandler(async (req: Request, res: Response) => {
    const container = getContainer();
    const notificationService = container.notificationService();
    
    const priorities = notificationService.getValidPriorities();
    res.json({ success: true, data: priorities });
});

// Process scheduled notifications (called by cron job or admin)
export const processScheduledNotifications = asyncHandler(async (req: Request, res: Response) => {
    const container = getContainer();
    const notificationService = container.notificationService();
    
    const count = await notificationService.processScheduledNotifications();
    res.json({ success: true, message: `${count} scheduled notifications processed` });
});
