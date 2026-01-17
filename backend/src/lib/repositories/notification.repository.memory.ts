/**
 * In-memory Notification Repository for testing
 * Provides a test double for NotificationRepository
 */

import type { 
  Notification, 
  BroadcastNotification,
  NotificationTemplate, 
  NotificationFilters, 
  NotificationTargetType,
  NotificationRepository 
} from '../container/types.js';

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createInMemoryNotificationRepository(): NotificationRepository & {
  // Test helpers
  addNotification(notification: Notification): void;
  addBroadcast(broadcast: BroadcastNotification): void;
  addTemplate(template: NotificationTemplate): void;
  clear(): void;
  getAllNotifications(): Notification[];
  getAllBroadcasts(): BroadcastNotification[];
  getAllTemplates(): NotificationTemplate[];
} {
  const notifications: Map<string, Notification> = new Map();
  const broadcasts: Map<string, BroadcastNotification> = new Map();
  const templates: Map<string, NotificationTemplate> = new Map();

  return {
    async create(data: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
      const notification: Notification = {
        id: generateId(),
        user_id: data.user_id ?? null,
        title: data.title,
        message: data.message,
        type: data.type,
        target_type: data.target_type,
        channel: data.channel,
        priority: data.priority ?? 'normal',
        is_read: data.is_read,
        read_at: data.read_at ?? null,
        data: data.data ?? null,
        actions: data.actions ?? null,
        scheduled_for: data.scheduled_for ?? null,
        sent_at: data.sent_at ?? null,
        created_at: new Date().toISOString(),
        expires_at: data.expires_at ?? null
      };
      notifications.set(notification.id, notification);
      return notification;
    },

    async getById(id: string): Promise<Notification | null> {
      return notifications.get(id) || null;
    },

    async getByUserId(userId: string, filters?: NotificationFilters): Promise<Notification[]> {
      let results = Array.from(notifications.values()).filter(n => n.user_id === userId);

      if (filters) {
        if (filters.type) {
          results = results.filter(n => n.type === filters.type);
        }
        if (filters.isRead !== undefined) {
          results = results.filter(n => n.is_read === filters.isRead);
        }
        if (filters.channel) {
          results = results.filter(n => n.channel === filters.channel);
        }
      }

      // Sort by created_at descending
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return results;
    },

    async getAll(
      filters?: NotificationFilters,
      pagination?: { limit: number; offset: number }
    ): Promise<{ notifications: Notification[]; total: number }> {
      let results = Array.from(notifications.values());

      if (filters) {
        if (filters.userId) {
          results = results.filter(n => n.user_id === filters.userId);
        }
        if (filters.type) {
          results = results.filter(n => n.type === filters.type);
        }
        if (filters.targetType) {
          results = results.filter(n => n.target_type === filters.targetType);
        }
        if (filters.isRead !== undefined) {
          results = results.filter(n => n.is_read === filters.isRead);
        }
        if (filters.channel) {
          results = results.filter(n => n.channel === filters.channel);
        }
      }

      // Sort by created_at descending
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = results.length;

      if (pagination) {
        results = results.slice(pagination.offset, pagination.offset + pagination.limit);
      }

      return { notifications: results, total };
    },

    async markAsRead(id: string): Promise<Notification> {
      const notification = notifications.get(id);
      if (!notification) {
        throw new Error('Notification not found');
      }

      const updated: Notification = {
        ...notification,
        is_read: true,
        read_at: new Date().toISOString()
      };
      notifications.set(id, updated);
      return updated;
    },

    async markAllAsRead(userId: string): Promise<number> {
      let count = 0;
      const now = new Date().toISOString();

      for (const [id, notification] of notifications.entries()) {
        if (notification.user_id === userId && !notification.is_read) {
          notifications.set(id, {
            ...notification,
            is_read: true,
            read_at: now
          });
          count++;
        }
      }

      return count;
    },

    async delete(id: string): Promise<void> {
      notifications.delete(id);
    },

    async deleteExpired(): Promise<number> {
      const now = new Date();
      let count = 0;

      for (const [id, notification] of notifications.entries()) {
        if (notification.expires_at && new Date(notification.expires_at) < now) {
          notifications.delete(id);
          count++;
        }
      }

      return count;
    },

    async deleteMultiple(ids: string[]): Promise<number> {
      let count = 0;
      for (const id of ids) {
        if (notifications.delete(id)) {
          count++;
        }
      }
      return count;
    },

    async createBroadcast(data: Omit<BroadcastNotification, 'id' | 'created_at'>): Promise<BroadcastNotification> {
      const broadcast: BroadcastNotification = {
        id: generateId(),
        title: data.title,
        message: data.message,
        type: data.type,
        target_type: data.target_type,
        priority: data.priority ?? 'normal',
        target_user_ids: data.target_user_ids,
        actions: data.actions,
        scheduled_for: data.scheduled_for ?? null,
        sent_at: data.sent_at ?? null,
        delivery_count: 0,
        read_count: 0,
        created_by: data.created_by,
        created_at: new Date().toISOString()
      };
      broadcasts.set(broadcast.id, broadcast);
      return broadcast;
    },

    async getBroadcasts(targetType?: NotificationTargetType): Promise<BroadcastNotification[]> {
      let results = Array.from(broadcasts.values());

      if (targetType) {
        results = results.filter(b => b.target_type === targetType || b.target_type === 'all');
      }

      // Sort by created_at descending
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return results;
    },

    async getBroadcastById(id: string): Promise<BroadcastNotification | null> {
      return broadcasts.get(id) || null;
    },

    async updateBroadcast(id: string, data: Partial<BroadcastNotification>): Promise<BroadcastNotification> {
      const existing = broadcasts.get(id);
      if (!existing) {
        throw new Error('Broadcast not found');
      }
      const updated = { ...existing, ...data };
      broadcasts.set(id, updated);
      return updated;
    },

    async getScheduledNotifications(): Promise<Notification[]> {
      return Array.from(notifications.values()).filter(n => 
        n.scheduled_for && !n.sent_at && new Date(n.scheduled_for) <= new Date()
      );
    },

    async getScheduledBroadcasts(): Promise<BroadcastNotification[]> {
      return Array.from(broadcasts.values()).filter(b => 
        b.scheduled_for && !b.sent_at && new Date(b.scheduled_for) <= new Date()
      );
    },

    // Template methods
    async createTemplate(data: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationTemplate> {
      const template: NotificationTemplate = {
        id: generateId(),
        name: data.name,
        title: data.title,
        message: data.message,
        type: data.type,
        target_type: data.target_type,
        priority: data.priority,
        actions: data.actions,
        variables: data.variables,
        is_active: data.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      templates.set(template.id, template);
      return template;
    },

    async getTemplates(activeOnly = true): Promise<NotificationTemplate[]> {
      let results = Array.from(templates.values());
      if (activeOnly) {
        results = results.filter(t => t.is_active);
      }
      return results.sort((a, b) => a.name.localeCompare(b.name));
    },

    async getTemplateById(id: string): Promise<NotificationTemplate | null> {
      return templates.get(id) || null;
    },

    async updateTemplate(id: string, data: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
      const existing = templates.get(id);
      if (!existing) {
        throw new Error('Template not found');
      }
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      templates.set(id, updated);
      return updated;
    },

    async deleteTemplate(id: string): Promise<void> {
      templates.delete(id);
    },

    // Test helpers
    addNotification(notification: Notification): void {
      notifications.set(notification.id, notification);
    },

    addBroadcast(broadcast: BroadcastNotification): void {
      broadcasts.set(broadcast.id, broadcast);
    },

    addTemplate(template: NotificationTemplate): void {
      templates.set(template.id, template);
    },

    clear(): void {
      notifications.clear();
      broadcasts.clear();
      templates.clear();
    },

    getAllNotifications(): Notification[] {
      return Array.from(notifications.values());
    },

    getAllBroadcasts(): BroadcastNotification[] {
      return Array.from(broadcasts.values());
    },

    getAllTemplates(): NotificationTemplate[] {
      return Array.from(templates.values());
    }
  };
}
