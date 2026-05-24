import type { NotificationType, NotificationTargetType, NotificationPriority } from '../container/types.js';

const VALID_PRIORITIES: NotificationPriority[] = ['low', 'normal', 'high', 'urgent'];

function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] !== undefined ? variables[key] : match);
}

export function createNotificationService(deps: { notificationRepository: any; socketEmitter?: any; logger?: any }) {
  const { notificationRepository, socketEmitter, logger } = deps;

  function emitNotification(userId: string | undefined, notification: any): void {
    if (!socketEmitter) return;
    if (userId) {
      socketEmitter.emitToRoom(`user:${userId}`, 'notification:new', notification);
    } else {
      socketEmitter.emitToRoom('notifications', 'notification:broadcast', notification);
    }
  }

  const service = {
    async create(input: any): Promise<any> {
      const type = input.type || 'info';
      const targetType = input.targetType || 'user';
      const channel = input.channel || 'in_app';
      const priority = input.priority || 'normal';
      const isScheduled = !!input.scheduledFor;
      const notification = await notificationRepository.create({
        user_id: input.userId ?? null,
        property_id: input.propertyId ?? null,
        title: input.title.trim(),
        message: input.message.trim(),
        type, target_type: targetType, channel, priority,
        is_read: false,
        data: input.data, actions: input.actions,
        scheduled_for: input.scheduledFor,
        sent_at: isScheduled ? undefined : new Date().toISOString(),
        expires_at: input.expiresIn ? new Date(Date.now() + input.expiresIn).toISOString() : undefined,
      });
      if (!isScheduled) emitNotification(input.userId, notification);
      return notification;
    },

    async getById(id: string): Promise<any | null> {
      return notificationRepository.getById(id);
    },

    async getForUser(userId: string, options?: { unreadOnly?: boolean; type?: NotificationType; limit?: number; propertyId?: string }): Promise<any[]> {
      const filters: any = {};
      if (options?.unreadOnly) filters.isRead = false;
      if (options?.type) filters.type = options.type;
      if (options?.propertyId) filters.propertyId = options.propertyId;
      const notifications = await notificationRepository.getByUserId(userId, filters);
      return options?.limit ? notifications.slice(0, options.limit) : notifications;
    },

    async getAll(options?: { filters?: any; limit?: number; offset?: number }): Promise<{ notifications: any[]; total: number }> {
      const { filters, limit = 50, offset = 0 } = options || {};
      return notificationRepository.getAll(filters, { limit, offset });
    },

    async markAsRead(id: string): Promise<any> {
      const existing = await notificationRepository.getById(id);
      if (!existing) throw new Error('Notification not found');
      if (existing.is_read) return existing;
      const updated = await notificationRepository.markAsRead(id);
      if (existing.user_id && socketEmitter) socketEmitter.emitToRoom(`user:${existing.user_id}`, 'notification:read', { id });
      return updated;
    },

    async markAllAsRead(userId: string): Promise<number> {
      const count = await notificationRepository.markAllAsRead(userId);
      if (socketEmitter) socketEmitter.emitToRoom(`user:${userId}`, 'notification:all-read', { count });
      return count;
    },

    async delete(id: string): Promise<void> {
      await notificationRepository.delete(id);
    },

    async deleteExpired(): Promise<number> {
      return notificationRepository.deleteExpired();
    },

    async deleteMultiple(ids: string[]): Promise<number> {
      return notificationRepository.deleteMultiple(ids);
    },

    async broadcast(input: any): Promise<any> {
      const type = input.type || 'info';
      const targetType = input.targetType || 'all';
      const priority = input.priority || 'normal';
      const isScheduled = !!input.scheduledFor;
      const broadcast = await notificationRepository.createBroadcast({
        property_id: input.propertyId ?? null,
        title: input.title.trim(),
        message: input.message.trim(),
        type, target_type: targetType, priority,
        target_user_ids: input.targetUserIds,
        actions: input.actions,
        scheduled_for: input.scheduledFor,
        sent_at: isScheduled ? undefined : new Date().toISOString(),
        created_by: input.createdBy,
      });
      if (!isScheduled && socketEmitter) {
        if (input.targetUserIds?.length > 0) {
          for (const uid of input.targetUserIds) socketEmitter.emitToRoom(`user:${uid}`, 'notification:broadcast', broadcast);
        } else {
          socketEmitter.emitToRoom(targetType === 'all' ? 'notifications' : `role:${targetType}`, 'notification:broadcast', broadcast);
        }
      }
      return broadcast;
    },

    async getBroadcasts(targetType?: NotificationTargetType, propertyId?: string): Promise<any[]> {
      return notificationRepository.getBroadcasts(targetType, propertyId);
    },

    async getTemplates(activeOnly = true, propertyId?: string): Promise<any[]> {
      return notificationRepository.getTemplates(activeOnly, propertyId);
    },

    async getTemplateById(id: string): Promise<any | null> {
      return notificationRepository.getTemplateById(id);
    },

    async createTemplate(input: any): Promise<any> {
      const extractVariables = (text: string) => (text.match(/\{\{(\w+)\}\}/g) || []).map((m: string) => m.replace(/\{\{|\}\}/g, ''));
      const variables = input.variables || [...extractVariables(input.title), ...extractVariables(input.message)].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
      return notificationRepository.createTemplate({
        property_id: input.propertyId ?? null,
        name: input.name.trim(), title: input.title.trim(), message: input.message.trim(),
        type: input.type || 'info', target_type: input.targetType || 'all',
        priority: input.priority, actions: input.actions, variables, is_active: true,
      });
    },

    async updateTemplate(id: string, data: any): Promise<any> {
      return notificationRepository.updateTemplate(id, {
        ...data,
        target_type: data.targetType,
        property_id: data.propertyId,
      });
    },

    async deleteTemplate(id: string): Promise<void> {
      return notificationRepository.deleteTemplate(id);
    },

    async sendFromTemplate(templateId: string, variables: Record<string, string>, options?: { userId?: string; targetUserIds?: string[]; createdBy?: string; scheduledFor?: string }): Promise<any> {
      const template = await service.getTemplateById(templateId);
      if (!template) throw new Error('Template not found');
      const title = interpolateTemplate(template.title, variables);
      const message = interpolateTemplate(template.message, variables);
      if (options?.userId) {
        return service.create({ userId: options.userId, title, message, type: template.type, targetType: template.target_type, priority: template.priority, actions: template.actions, scheduledFor: options.scheduledFor });
      }
      return service.broadcast({ title, message, type: template.type, targetType: template.target_type, priority: template.priority, actions: template.actions, targetUserIds: options?.targetUserIds, scheduledFor: options?.scheduledFor, createdBy: options?.createdBy || '' });
    },

    async processScheduledNotifications(): Promise<number> {
      const scheduled = await notificationRepository.getScheduledNotifications();
      let processed = 0;
      for (const n of scheduled) {
        if (n.scheduled_for && new Date(n.scheduled_for) <= new Date()) {
          emitNotification(n.user_id ?? undefined, n);
          processed++;
        }
      }
      const broadcasts = await notificationRepository.getScheduledBroadcasts();
      for (const b of broadcasts) {
        if (b.scheduled_for && new Date(b.scheduled_for) <= new Date()) {
          if (socketEmitter) {
            if (b.target_user_ids?.length > 0) {
              for (const uid of b.target_user_ids) socketEmitter.emitToRoom(`user:${uid}`, 'notification:broadcast', b);
            } else {
              socketEmitter.emitToRoom(b.target_type === 'all' ? 'notifications' : `role:${b.target_type}`, 'notification:broadcast', b);
            }
          }
          processed++;
        }
      }
      logger?.info(`Processed ${processed} scheduled notifications`);
      return processed;
    },

    getValidPriorities(): NotificationPriority[] {
      return [...VALID_PRIORITIES];
    },
  };

  return service;
}

export type NotificationService = ReturnType<typeof createNotificationService>;
