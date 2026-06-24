/**
 * Notifications Controller
 * Aggregates notification data from transactions, reviews, and stored notifications.
 * Uses getContainer() for service access so tests can mock via lib/container.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { getContainer } from '../../../lib/container/index.js';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();

  // Fetch orders (instant_transaction)
  const ordersResult = await supabase
    .from('transactions')
    .select('id, order_number, status, created_at')
    .eq('engine_type', 'instant_transaction')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);
  const orders: any[] = ordersResult?.data ?? [];

  // Fetch bookings (time_exclusive_reservation)
  const bookingsResult = await supabase
    .from('transactions')
    .select('id, status, created_at')
    .eq('engine_type', 'time_exclusive_reservation')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);
  const bookings: any[] = bookingsResult?.data ?? [];

  // Fetch reviews
  const reviewsResult = await supabase
    .from('reviews')
    .select('id, rating, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);
  const reviews: any[] = reviewsResult?.data ?? [];

  // Fetch stored notifications — NOT wrapped in try-catch so errors propagate to asyncHandler → next()
  const svc = getContainer().notificationService();
  const stored: any[] = await svc.getForUser(
    (req.query.userId as string) || req.user?.userId || '',
    {
      unreadOnly: req.query.unreadOnly === 'true',
      type: req.query.type as any,
      limit: parseInt(req.query.limit as string) || 20,
      propertyId: (req as any).propertyId || (req.headers['x-property-id'] as string),
    }
  );

  // Shape into unified notification objects
  const orderNotifs = (orders || []).map((o: any) => ({
    id: `order-${o.id}`,
    title: 'New Order',
    message: `Order ${o.order_number} is ${o.status}`,
    type: 'info' as const,
    is_read: o.status !== 'pending',
    created_at: o.created_at,
  }));

  const bookingNotifs = (bookings || []).map((b: any) => ({
    id: `booking-${b.id}`,
    title: 'AccommodationUnit Booking',
    message: `Booking is ${b.status}`,
    type: 'info' as const,
    is_read: b.status !== 'pending',
    created_at: b.created_at,
  }));

  const reviewNotifs = (reviews || []).map((r: any) => ({
    id: `review-${r.id}`,
    title: 'Review Pending',
    message: `New review with rating ${r.rating}`,
    type: 'warning' as const,
    is_read: false,
    created_at: r.created_at,
  }));

  // Merge all sources
  const all = [...orderNotifs, ...bookingNotifs, ...reviewNotifs, ...(stored || [])];

  // Sort by date descending
  all.sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Limit to 20
  const data = all.slice(0, 20);

  res.json({ success: true, data, total: data.length });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
  const notification = await svc.markAsRead(req.params.id);
  res.json({ success: true, data: notification });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
  const count = await svc.markAllAsRead(req.user?.userId || '');
  res.json({ success: true, message: `${count} notifications marked as read` });
});

export const broadcastNotification = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, type = 'info', target_type = 'all', priority = 'normal', target_user_ids, actions, scheduled_for } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Title and message are required' });
  }
  const svc = getContainer().notificationService();
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
  const svc = getContainer().notificationService();
  await svc.delete(req.params.id);
  res.json({ success: true, message: 'Notification deleted' });
});

export const deleteMultipleNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of notification IDs required' });
  }
  const svc = getContainer().notificationService();
  const count = await svc.deleteMultiple(ids);
  res.json({ success: true, message: `${count} notifications deleted` });
});

export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const templates = await svc.getTemplates(req.query.activeOnly !== 'false', propertyId);
  res.json({ success: true, data: templates });
});

export const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
  const template = await svc.getTemplateById(req.params.id);
  if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
  res.json({ success: true, data: template });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { name, title, message, type = 'info', target_type = 'all', priority = 'normal', actions, variables, is_active = true } = req.body;
  if (!name || !title || !message) {
    return res.status(400).json({ success: false, error: 'Name, title, and message are required' });
  }
  const svc = getContainer().notificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const template = await svc.createTemplate({ name, title, message, type, targetType: target_type, priority, actions, variables: variables || [], isActive: is_active, propertyId });
  res.status(201).json({ success: true, data: template });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
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
  const svc = getContainer().notificationService();
  await svc.deleteTemplate(req.params.id);
  res.json({ success: true, message: 'Template deleted' });
});

export const sendFromTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { variables = {}, target_user_ids, scheduled_for } = req.body;
  const svc = getContainer().notificationService();
  const broadcast = await svc.sendFromTemplate(req.params.id, variables, {
    targetUserIds: target_user_ids,
    scheduledFor: scheduled_for,
    createdBy: req.user?.userId || '',
  });
  res.status(201).json({ success: true, data: broadcast });
});

export const getBroadcasts = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
  const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
  const broadcasts = await svc.getBroadcasts(req.query.target_type as any, propertyId);
  res.json({ success: true, data: broadcasts });
});

export const getValidPriorities = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
  res.json({ success: true, data: svc.getValidPriorities() });
});

export const processScheduledNotifications = asyncHandler(async (req: Request, res: Response) => {
  const svc = getContainer().notificationService();
  const count = await svc.processScheduledNotifications();
  res.json({ success: true, message: `${count} scheduled notifications processed` });
});
