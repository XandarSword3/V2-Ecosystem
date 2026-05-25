/**
 * Notifications Controller
 * Handles notification retrieval and management with templates, scheduling, and priorities.
 * 
 * Uses notification service and repository directly — no DI container dependency.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { logger } from '../../../utils/logger.js';
import { createNotificationService } from '../../../lib/services/notification.service.js';
import { createSupabaseNotificationRepository } from '../../../lib/repositories/notification.repository.supabase.js';

function getNotificationService() {
  const repo = createSupabaseNotificationRepository();
  return createNotificationService({ notificationRepository: repo, logger });
}

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const { userId } = req.query;
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);

  const notifications = await svc.getForUser(
    userId as string || req.user?.userId || '',
    {
      unreadOnly: req.query.unreadOnly === 'true',
      type: req.query.type as any,
      limit: parseInt(req.query.limit as string) || 20,
      propertyId,
    }
  );

  res.json({ success: true, data: notifications, total: notifications.length });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const notification = await svc.markAsRead(req.params.id);
  res.json({ success: true, data: notification });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const count = await svc.markAllAsRead(req.user?.userId || '');
  res.json({ success: true, message: `${count} notifications marked as read` });
});

export const broadcastNotification = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, type = 'info', target_type = 'all', priority = 'normal', target_user_ids, actions, scheduled_for } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Title and message are required' });
  }
  const svc = getNotificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const broadcast = await svc.broadcast({
    title, message, type, targetType: target_type, priority,
    targetUserIds: target_user_ids, actions,
    scheduledFor: scheduled_for,
    createdBy: req.user?.userId || '',
    propertyId,
  });
  res.status(201).json({ success: true, data: broadcast });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  await svc.delete(req.params.id);
  res.json({ success: true, message: 'Notification deleted' });
});

export const deleteMultipleNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of notification IDs required' });
  }
  const svc = getNotificationService();
  const count = await svc.deleteMultiple(ids);
  res.json({ success: true, message: `${count} notifications deleted` });
});

export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const templates = await svc.getTemplates(req.query.activeOnly !== 'false', propertyId);
  res.json({ success: true, data: templates });
});

export const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const template = await svc.getTemplateById(req.params.id);
  if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
  res.json({ success: true, data: template });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { name, title, message, type = 'info', target_type = 'all', priority = 'normal', actions, variables, is_active = true } = req.body;
  if (!name || !title || !message) {
    return res.status(400).json({ success: false, error: 'Name, title, and message are required' });
  }
  const svc = getNotificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const template = await svc.createTemplate({ name, title, message, type, targetType: target_type, priority, actions, variables: variables || [], isActive: is_active, propertyId });
  res.status(201).json({ success: true, data: template });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const u = req.body;
  const template = await svc.updateTemplate(req.params.id, {
    name: u.name, title: u.title, message: u.message,
    type: u.type, targetType: u.target_type, priority: u.priority,
    actions: u.actions, variables: u.variables, isActive: u.is_active, propertyId,
  });
  res.json({ success: true, data: template });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  await svc.deleteTemplate(req.params.id);
  res.json({ success: true, message: 'Template deleted' });
});

export const sendFromTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { variables = {}, target_user_ids, scheduled_for } = req.body;
  const svc = getNotificationService();
  const broadcast = await svc.sendFromTemplate(req.params.id, variables, {
    targetUserIds: target_user_ids,
    scheduledFor: scheduled_for,
    createdBy: req.user?.userId || '',
  });
  res.status(201).json({ success: true, data: broadcast });
});

export const getBroadcasts = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const broadcasts = await svc.getBroadcasts(req.query.target_type as any, propertyId);
  res.json({ success: true, data: broadcasts });
});

export const getValidPriorities = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  res.json({ success: true, data: svc.getValidPriorities() });
});

export const processScheduledNotifications = asyncHandler(async (req: Request, res: Response) => {
  const svc = getNotificationService();
  const count = await svc.processScheduledNotifications();
  res.json({ success: true, message: `${count} scheduled notifications processed` });
});
