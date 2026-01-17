/**
 * Notification Service - DI-based notification management
 * Handles creating, sending, and managing notifications
 */

import type { 
  Notification, 
  BroadcastNotification,
  NotificationTemplate,
  NotificationType, 
  NotificationTargetType, 
  NotificationChannel,
  NotificationPriority,
  NotificationAction,
  NotificationFilters,
  NotificationRepository, 
  SocketEmitter,
  LoggerService
} from '../container/types.js';

// ============================================
// TYPES
// ============================================

export interface NotificationServiceDependencies {
  notificationRepository: NotificationRepository;
  socketEmitter?: SocketEmitter;
  logger?: LoggerService;
}

export interface CreateNotificationInput {
  userId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  targetType?: NotificationTargetType;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  scheduledFor?: string; // ISO date string for scheduling
  expiresIn?: number; // milliseconds
}

export interface BroadcastInput {
  title: string;
  message: string;
  type?: NotificationType;
  targetType?: NotificationTargetType;
  priority?: NotificationPriority;
  targetUserIds?: string[];
  actions?: NotificationAction[];
  scheduledFor?: string;
  createdBy: string;
}

export interface CreateTemplateInput {
  name: string;
  title: string;
  message: string;
  type?: NotificationType;
  targetType?: NotificationTargetType;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
  variables?: string[];
  isActive?: boolean;
}

// Valid types for validation
const VALID_TYPES: NotificationType[] = ['info', 'warning', 'error', 'success'];
const VALID_TARGET_TYPES: NotificationTargetType[] = ['all', 'admin', 'staff', 'user', 'customer'];
const VALID_CHANNELS: NotificationChannel[] = ['in_app', 'email', 'sms', 'push'];
const VALID_PRIORITIES: NotificationPriority[] = ['low', 'normal', 'high', 'urgent'];

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// CUSTOM ERROR
// ============================================

export class NotificationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'NotificationServiceError';
  }
}

// ============================================
// VALIDATION
// ============================================

function validateTitle(title: string): void {
  if (!title || typeof title !== 'string') {
    throw new NotificationServiceError('Title is required', 'INVALID_TITLE');
  }
  
  const trimmed = title.trim();
  if (trimmed.length < 2 || trimmed.length > 200) {
    throw new NotificationServiceError('Title must be between 2 and 200 characters', 'INVALID_TITLE_LENGTH');
  }
}

function validateMessage(message: string): void {
  if (!message || typeof message !== 'string') {
    throw new NotificationServiceError('Message is required', 'INVALID_MESSAGE');
  }
  
  const trimmed = message.trim();
  if (trimmed.length < 2 || trimmed.length > 2000) {
    throw new NotificationServiceError('Message must be between 2 and 2000 characters', 'INVALID_MESSAGE_LENGTH');
  }
}

function validateUserId(userId: string | undefined): void {
  if (userId !== undefined) {
    if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      throw new NotificationServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }
  }
}

function validateType(type: string): asserts type is NotificationType {
  if (!VALID_TYPES.includes(type as NotificationType)) {
    throw new NotificationServiceError(
      `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
      'INVALID_TYPE'
    );
  }
}

function validateTargetType(targetType: string): asserts targetType is NotificationTargetType {
  if (!VALID_TARGET_TYPES.includes(targetType as NotificationTargetType)) {
    throw new NotificationServiceError(
      `Invalid target type. Must be one of: ${VALID_TARGET_TYPES.join(', ')}`,
      'INVALID_TARGET_TYPE'
    );
  }
}

function validateChannel(channel: string): asserts channel is NotificationChannel {
  if (!VALID_CHANNELS.includes(channel as NotificationChannel)) {
    throw new NotificationServiceError(
      `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`,
      'INVALID_CHANNEL'
    );
  }
}

function validatePriority(priority: string): asserts priority is NotificationPriority {
  if (!VALID_PRIORITIES.includes(priority as NotificationPriority)) {
    throw new NotificationServiceError(
      `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      'INVALID_PRIORITY'
    );
  }
}

function validateScheduledFor(scheduledFor: string | undefined): void {
  if (scheduledFor) {
    const date = new Date(scheduledFor);
    if (isNaN(date.getTime())) {
      throw new NotificationServiceError('Invalid scheduled date format', 'INVALID_SCHEDULED_DATE');
    }
    if (date.getTime() < Date.now()) {
      throw new NotificationServiceError('Scheduled date must be in the future', 'INVALID_SCHEDULED_DATE');
    }
  }
}

function validateActions(actions: NotificationAction[] | undefined): void {
  if (actions) {
    if (!Array.isArray(actions)) {
      throw new NotificationServiceError('Actions must be an array', 'INVALID_ACTIONS');
    }
    for (const action of actions) {
      if (!action.label || typeof action.label !== 'string') {
        throw new NotificationServiceError('Action label is required', 'INVALID_ACTION_LABEL');
      }
      if (!action.url || typeof action.url !== 'string') {
        throw new NotificationServiceError('Action URL is required', 'INVALID_ACTION_URL');
      }
      if (action.style && !['primary', 'secondary', 'danger'].includes(action.style)) {
        throw new NotificationServiceError('Invalid action style', 'INVALID_ACTION_STYLE');
      }
    }
  }
}

function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

function validatePagination(limit?: number, offset?: number): void {
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new NotificationServiceError('Limit must be between 1 and 100', 'INVALID_LIMIT');
    }
  }
  
  if (offset !== undefined) {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new NotificationServiceError('Offset must be a non-negative integer', 'INVALID_OFFSET');
    }
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createNotificationService(deps: NotificationServiceDependencies) {
  const { notificationRepository, socketEmitter, logger } = deps;

  function emitNotification(userId: string | undefined, notification: Notification): void {
    if (socketEmitter) {
      if (userId) {
        socketEmitter.emitToRoom(`user:${userId}`, 'notification:new', notification);
      } else {
        socketEmitter.emitToRoom('notifications', 'notification:broadcast', notification);
      }
    }
  }

  return {
    /**
     * Create a new notification
     */
    async create(input: CreateNotificationInput): Promise<Notification> {
      validateTitle(input.title);
      validateMessage(input.message);
      validateUserId(input.userId);
      
      const type = input.type || 'info';
      const targetType = input.targetType || 'user';
      const channel = input.channel || 'in_app';
      
      validateType(type);
      validateTargetType(targetType);
      validateChannel(channel);
      
      let expiresAt: string | undefined;
      if (input.expiresIn && input.expiresIn > 0) {
        expiresAt = new Date(Date.now() + input.expiresIn).toISOString();
      }
      
      const priority = input.priority || 'normal';
      if (input.priority) validatePriority(priority);
      validateScheduledFor(input.scheduledFor);
      validateActions(input.actions);

      // If scheduled, don't emit now
      const isScheduled = !!input.scheduledFor;
      
      const notification = await notificationRepository.create({
        user_id: input.userId,
        title: input.title.trim(),
        message: input.message.trim(),
        type,
        target_type: targetType,
        channel,
        priority,
        is_read: false,
        data: input.data,
        actions: input.actions,
        scheduled_for: input.scheduledFor,
        sent_at: isScheduled ? undefined : new Date().toISOString(),
        expires_at: expiresAt
      });
      
      // Only emit if not scheduled
      if (!isScheduled) {
        emitNotification(input.userId, notification);
      }
      logger?.debug(`Notification created: ${notification.id}${isScheduled ? ' (scheduled)' : ''}`);
      
      return notification;
    },

    /**
     * Get notification by ID
     */
    async getById(id: string): Promise<Notification | null> {
      if (!id || typeof id !== 'string') {
        throw new NotificationServiceError('Notification ID is required', 'INVALID_ID');
      }
      
      return notificationRepository.getById(id);
    },

    /**
     * Get notifications for a user
     */
    async getForUser(userId: string, options?: {
      unreadOnly?: boolean;
      type?: NotificationType;
      limit?: number;
    }): Promise<Notification[]> {
      validateUserId(userId);
      if (!userId) {
        throw new NotificationServiceError('User ID is required', 'INVALID_USER_ID');
      }
      
      if (options?.type) {
        validateType(options.type);
      }
      
      const filters: NotificationFilters = {};
      if (options?.unreadOnly) {
        filters.isRead = false;
      }
      if (options?.type) {
        filters.type = options.type;
      }
      
      const notifications = await notificationRepository.getByUserId(userId, filters);
      
      if (options?.limit && options.limit > 0) {
        return notifications.slice(0, options.limit);
      }
      
      return notifications;
    },

    /**
     * Get all notifications with filters
     */
    async getAll(options?: {
      filters?: NotificationFilters;
      limit?: number;
      offset?: number;
    }): Promise<{ notifications: Notification[]; total: number }> {
      const { filters, limit = 50, offset = 0 } = options || {};
      
      validatePagination(limit, offset);
      
      if (filters?.type) {
        validateType(filters.type);
      }
      if (filters?.targetType) {
        validateTargetType(filters.targetType);
      }
      if (filters?.channel) {
        validateChannel(filters.channel);
      }
      
      return notificationRepository.getAll(filters, { limit, offset });
    },

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId: string): Promise<number> {
      validateUserId(userId);
      if (!userId) {
        throw new NotificationServiceError('User ID is required', 'INVALID_USER_ID');
      }
      
      const notifications = await notificationRepository.getByUserId(userId, { isRead: false });
      return notifications.length;
    },

    /**
     * Mark notification as read
     */
    async markAsRead(id: string): Promise<Notification> {
      if (!id || typeof id !== 'string') {
        throw new NotificationServiceError('Notification ID is required', 'INVALID_ID');
      }
      
      const existing = await notificationRepository.getById(id);
      if (!existing) {
        throw new NotificationServiceError('Notification not found', 'NOT_FOUND', 404);
      }
      
      if (existing.is_read) {
        return existing; // Already read
      }
      
      const updated = await notificationRepository.markAsRead(id);
      
      if (existing.user_id && socketEmitter) {
        socketEmitter.emitToRoom(`user:${existing.user_id}`, 'notification:read', { id });
      }
      
      return updated;
    },

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string): Promise<number> {
      validateUserId(userId);
      if (!userId) {
        throw new NotificationServiceError('User ID is required', 'INVALID_USER_ID');
      }
      
      const count = await notificationRepository.markAllAsRead(userId);
      
      if (socketEmitter) {
        socketEmitter.emitToRoom(`user:${userId}`, 'notification:all-read', { count });
      }
      
      logger?.debug(`Marked ${count} notifications as read for user ${userId}`);
      
      return count;
    },

    /**
     * Delete a notification
     */
    async delete(id: string): Promise<void> {
      if (!id || typeof id !== 'string') {
        throw new NotificationServiceError('Notification ID is required', 'INVALID_ID');
      }
      
      const existing = await notificationRepository.getById(id);
      if (!existing) {
        throw new NotificationServiceError('Notification not found', 'NOT_FOUND', 404);
      }
      
      await notificationRepository.delete(id);
      
      logger?.debug(`Notification deleted: ${id}`);
    },

    /**
     * Delete expired notifications
     */
    async deleteExpired(): Promise<number> {
      const count = await notificationRepository.deleteExpired();
      
      logger?.info(`Deleted ${count} expired notifications`);
      
      return count;
    },

    /**
     * Broadcast a notification to multiple users
     */
    async broadcast(input: BroadcastInput): Promise<BroadcastNotification> {
      validateTitle(input.title);
      validateMessage(input.message);
      validateUserId(input.createdBy);
      
      if (!input.createdBy) {
        throw new NotificationServiceError('Created by user ID is required', 'INVALID_CREATED_BY');
      }
      
      const type = input.type || 'info';
      const targetType = input.targetType || 'all';
      const priority = input.priority || 'normal';
      
      validateType(type);
      validateTargetType(targetType);
      if (input.priority) validatePriority(priority);
      validateScheduledFor(input.scheduledFor);
      validateActions(input.actions);
      
      // Validate target user IDs if provided
      if (input.targetUserIds) {
        for (const uid of input.targetUserIds) {
          if (!UUID_REGEX.test(uid)) {
            throw new NotificationServiceError('Invalid target user ID format', 'INVALID_TARGET_USER_ID');
          }
        }
      }

      const isScheduled = !!input.scheduledFor;
      
      const broadcast = await notificationRepository.createBroadcast({
        title: input.title.trim(),
        message: input.message.trim(),
        type,
        target_type: targetType,
        priority,
        target_user_ids: input.targetUserIds,
        actions: input.actions,
        scheduled_for: input.scheduledFor,
        sent_at: isScheduled ? undefined : new Date().toISOString(),
        created_by: input.createdBy
      });
      
      // Only emit if not scheduled
      if (!isScheduled && socketEmitter) {
        if (input.targetUserIds && input.targetUserIds.length > 0) {
          // Send to specific users
          for (const userId of input.targetUserIds) {
            socketEmitter.emitToRoom(`user:${userId}`, 'notification:broadcast', broadcast);
          }
        } else {
          // Send to role/all
          const room = targetType === 'all' ? 'notifications' : `role:${targetType}`;
          socketEmitter.emitToRoom(room, 'notification:broadcast', broadcast);
        }
      }
      
      logger?.info(`Broadcast notification ${isScheduled ? 'scheduled' : 'sent'} to ${targetType}: ${broadcast.id}`);
      
      return broadcast;
    },

    /**
     * Get broadcast notifications
     */
    async getBroadcasts(targetType?: NotificationTargetType): Promise<BroadcastNotification[]> {
      if (targetType) {
        validateTargetType(targetType);
      }
      
      return notificationRepository.getBroadcasts(targetType);
    },

    /**
     * Delete multiple notifications
     */
    async deleteMultiple(ids: string[]): Promise<number> {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new NotificationServiceError('IDs array is required', 'INVALID_IDS');
      }
      
      for (const id of ids) {
        if (!id || typeof id !== 'string') {
          throw new NotificationServiceError('Invalid notification ID in array', 'INVALID_ID');
        }
      }
      
      const count = await notificationRepository.deleteMultiple(ids);
      logger?.debug(`Deleted ${count} notifications`);
      
      return count;
    },

    // ============================================
    // TEMPLATE METHODS
    // ============================================

    /**
     * Create a notification template
     */
    async createTemplate(input: CreateTemplateInput): Promise<NotificationTemplate> {
      if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 2) {
        throw new NotificationServiceError('Template name is required', 'INVALID_TEMPLATE_NAME');
      }
      
      validateTitle(input.title);
      validateMessage(input.message);
      
      const type = input.type || 'info';
      const targetType = input.targetType || 'all';
      
      validateType(type);
      validateTargetType(targetType);
      if (input.priority) validatePriority(input.priority);
      validateActions(input.actions);
      
      // Extract variables from title and message
      const extractVariables = (text: string): string[] => {
        const matches = text.match(/\{\{(\w+)\}\}/g) || [];
        return matches.map(m => m.replace(/\{\{|\}\}/g, ''));
      };
      
      const variables = input.variables || [
        ...extractVariables(input.title),
        ...extractVariables(input.message)
      ].filter((v, i, arr) => arr.indexOf(v) === i);
      
      return notificationRepository.createTemplate({
        name: input.name.trim(),
        title: input.title.trim(),
        message: input.message.trim(),
        type,
        target_type: targetType,
        priority: input.priority,
        actions: input.actions,
        variables,
        is_active: true
      });
    },

    /**
     * Get all templates
     */
    async getTemplates(activeOnly = true): Promise<NotificationTemplate[]> {
      return notificationRepository.getTemplates(activeOnly);
    },

    /**
     * Get template by ID
     */
    async getTemplateById(id: string): Promise<NotificationTemplate | null> {
      if (!id || typeof id !== 'string') {
        throw new NotificationServiceError('Template ID is required', 'INVALID_ID');
      }
      return notificationRepository.getTemplateById(id);
    },

    /**
     * Update a template
     */
    async updateTemplate(id: string, data: Partial<CreateTemplateInput>): Promise<NotificationTemplate> {
      if (!id || typeof id !== 'string') {
        throw new NotificationServiceError('Template ID is required', 'INVALID_ID');
      }
      
      const existing = await notificationRepository.getTemplateById(id);
      if (!existing) {
        throw new NotificationServiceError('Template not found', 'NOT_FOUND', 404);
      }
      
      if (data.title) validateTitle(data.title);
      if (data.message) validateMessage(data.message);
      if (data.type) validateType(data.type);
      if (data.targetType) validateTargetType(data.targetType);
      if (data.priority) validatePriority(data.priority);
      if (data.actions) validateActions(data.actions);
      
      return notificationRepository.updateTemplate(id, {
        ...data,
        target_type: data.targetType
      });
    },

    /**
     * Delete a template
     */
    async deleteTemplate(id: string): Promise<void> {
      if (!id || typeof id !== 'string') {
        throw new NotificationServiceError('Template ID is required', 'INVALID_ID');
      }
      
      const existing = await notificationRepository.getTemplateById(id);
      if (!existing) {
        throw new NotificationServiceError('Template not found', 'NOT_FOUND', 404);
      }
      
      await notificationRepository.deleteTemplate(id);
      logger?.debug(`Template deleted: ${id}`);
    },

    /**
     * Send notification from template
     */
    async sendFromTemplate(
      templateId: string,
      variables: Record<string, string>,
      options?: {
        userId?: string;
        targetUserIds?: string[];
        createdBy?: string;
        scheduledFor?: string;
      }
    ): Promise<Notification | BroadcastNotification> {
      const template = await this.getTemplateById(templateId);
      if (!template) {
        throw new NotificationServiceError('Template not found', 'NOT_FOUND', 404);
      }
      
      const title = interpolateTemplate(template.title, variables);
      const message = interpolateTemplate(template.message, variables);
      
      if (options?.userId) {
        // Single user notification
        return this.create({
          userId: options.userId,
          title,
          message,
          type: template.type,
          targetType: template.target_type,
          priority: template.priority,
          actions: template.actions,
          scheduledFor: options.scheduledFor
        });
      } else if (options?.createdBy) {
        // Broadcast
        return this.broadcast({
          title,
          message,
          type: template.type,
          targetType: template.target_type,
          priority: template.priority,
          actions: template.actions,
          targetUserIds: options.targetUserIds,
          scheduledFor: options.scheduledFor,
          createdBy: options.createdBy
        });
      } else {
        throw new NotificationServiceError('Either userId or createdBy is required', 'MISSING_RECIPIENT');
      }
    },

    /**
     * Process scheduled notifications
     */
    async processScheduledNotifications(): Promise<number> {
      const scheduled = await notificationRepository.getScheduledNotifications();
      let processed = 0;
      
      for (const notification of scheduled) {
        if (notification.scheduled_for && new Date(notification.scheduled_for) <= new Date()) {
          // Time to send
          emitNotification(notification.user_id ?? undefined, notification);
          // Mark as sent (update sent_at would be done via repo)
          processed++;
        }
      }
      
      const scheduledBroadcasts = await notificationRepository.getScheduledBroadcasts();
      for (const broadcast of scheduledBroadcasts) {
        if (broadcast.scheduled_for && new Date(broadcast.scheduled_for) <= new Date()) {
          if (socketEmitter) {
            if (broadcast.target_user_ids && broadcast.target_user_ids.length > 0) {
              for (const userId of broadcast.target_user_ids) {
                socketEmitter.emitToRoom(`user:${userId}`, 'notification:broadcast', broadcast);
              }
            } else {
              const room = broadcast.target_type === 'all' ? 'notifications' : `role:${broadcast.target_type}`;
              socketEmitter.emitToRoom(room, 'notification:broadcast', broadcast);
            }
          }
          processed++;
        }
      }
      
      logger?.info(`Processed ${processed} scheduled notifications`);
      return processed;
    },

    // ============================================
    // CONVENIENCE METHODS
    // ============================================

    /**
     * Send an info notification
     */
    async sendInfo(userId: string, title: string, message: string): Promise<Notification> {
      return this.create({ userId, title, message, type: 'info' });
    },

    /**
     * Send a success notification
     */
    async sendSuccess(userId: string, title: string, message: string): Promise<Notification> {
      return this.create({ userId, title, message, type: 'success' });
    },

    /**
     * Send a warning notification
     */
    async sendWarning(userId: string, title: string, message: string): Promise<Notification> {
      return this.create({ userId, title, message, type: 'warning' });
    },

    /**
     * Send an error notification
     */
    async sendError(userId: string, title: string, message: string): Promise<Notification> {
      return this.create({ userId, title, message, type: 'error' });
    },

    /**
     * Send order notification
     */
    async sendOrderNotification(
      userId: string,
      orderNumber: string,
      status: string
    ): Promise<Notification> {
      return this.create({
        userId,
        title: 'Order Update',
        message: `Order #${orderNumber} status: ${status}`,
        type: status === 'completed' ? 'success' : 'info',
        data: { orderNumber, status }
      });
    },

    /**
     * Send booking notification
     */
    async sendBookingNotification(
      userId: string,
      bookingId: string,
      status: string
    ): Promise<Notification> {
      return this.create({
        userId,
        title: 'Booking Update',
        message: `Your booking has been ${status}`,
        type: status === 'confirmed' ? 'success' : 'info',
        data: { bookingId, status }
      });
    },

    /**
     * Get valid notification types
     */
    getValidTypes(): NotificationType[] {
      return [...VALID_TYPES];
    },

    /**
     * Get valid target types
     */
    getValidTargetTypes(): NotificationTargetType[] {
      return [...VALID_TARGET_TYPES];
    },

    /**
     * Get valid channels
     */
    getValidChannels(): NotificationChannel[] {
      return [...VALID_CHANNELS];
    },

    /**
     * Get valid priorities
     */
    getValidPriorities(): NotificationPriority[] {
      return [...VALID_PRIORITIES];
    }
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
