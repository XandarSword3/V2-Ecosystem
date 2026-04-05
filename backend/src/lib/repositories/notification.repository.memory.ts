/**
 * In-Memory Notification Repository
 * Test double for NotificationRepository using in-memory data structures.
 */

import type {
  NotificationRepository,
  Notification,
  NotificationFilters,
  NotificationTargetType,
  BroadcastNotification,
  NotificationTemplate,
} from '../container/types.js';

export function createInMemoryNotificationRepository(): NotificationRepository & {
  addNotification(n: Notification): void;
  getAllNotifications(): Notification[];
  clear(): void;
  reset(): void;
} {
  const notifications = new Map<string, Notification>();
  const broadcasts = new Map<string, BroadcastNotification>();
  const templates = new Map<string, NotificationTemplate>();

  return {
    addNotification(n: Notification) {
      notifications.set(n.id, n);
    },
    getAllNotifications(): Notification[] {
      return [...notifications.values()];
    },
    clear() {
      notifications.clear();
      broadcasts.clear();
      templates.clear();
    },
    reset() {
      notifications.clear();
      broadcasts.clear();
      templates.clear();
    },

    async create(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const notification: Notification = { ...data, id, created_at: now } as Notification;
      notifications.set(id, notification);
      return notification;
    },
    async getById(id) {
      return notifications.get(id) ?? null;
    },
    async getByUserId(userId, filters) {
      let result = [...notifications.values()].filter(n => n.user_id === userId);
      if (filters?.type) result = result.filter(n => n.type === filters.type);
      if (filters?.isRead !== undefined) result = result.filter(n => n.is_read === filters.isRead);
      if (filters?.channel) result = result.filter(n => n.channel === filters.channel);
      if (filters?.priority) result = result.filter(n => n.priority === filters.priority);
      return result;
    },
    async getAll(filters, pagination) {
      let result = [...notifications.values()];
      if (filters?.userId) result = result.filter(n => n.user_id === filters.userId);
      if (filters?.type) result = result.filter(n => n.type === filters.type);
      if (filters?.targetType) result = result.filter(n => n.target_type === filters.targetType);
      if (filters?.isRead !== undefined) result = result.filter(n => n.is_read === filters.isRead);
      if (filters?.channel) result = result.filter(n => n.channel === filters.channel);
      if (filters?.scheduled) result = result.filter(n => !!n.scheduled_for);
      if (filters?.sent !== undefined) result = result.filter(n => filters.sent ? !!n.sent_at : !n.sent_at);
      const total = result.length;
      if (pagination) {
        result = result.slice(pagination.offset, pagination.offset + pagination.limit);
      }
      return { notifications: result, total };
    },
    async markAsRead(id) {
      const existing = notifications.get(id);
      if (!existing) throw new Error(`Notification ${id} not found`);
      const updated = { ...existing, is_read: true, read_at: new Date().toISOString() };
      notifications.set(id, updated);
      return updated;
    },
    async markAllAsRead(userId) {
      let count = 0;
      for (const [id, n] of notifications) {
        if (n.user_id === userId && !n.is_read) {
          notifications.set(id, { ...n, is_read: true, read_at: new Date().toISOString() });
          count++;
        }
      }
      return count;
    },
    async delete(id) {
      notifications.delete(id);
    },
    async deleteExpired() {
      const now = new Date().toISOString();
      let count = 0;
      for (const [id, n] of notifications) {
        if (n.expires_at && n.expires_at < now) {
          notifications.delete(id);
          count++;
        }
      }
      return count;
    },
    async deleteMultiple(ids) {
      let count = 0;
      for (const id of ids) {
        if (notifications.delete(id)) count++;
      }
      return count;
    },
    async createBroadcast(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const broadcast: BroadcastNotification = { ...data, id, created_at: now } as BroadcastNotification;
      broadcasts.set(id, broadcast);
      return broadcast;
    },
    async getBroadcasts(targetType) {
      let result = [...broadcasts.values()];
      if (targetType) result = result.filter(b => b.target_type === targetType);
      return result;
    },
    async getBroadcastById(id) {
      return broadcasts.get(id) ?? null;
    },
    async updateBroadcast(id, data) {
      const existing = broadcasts.get(id);
      if (!existing) throw new Error(`Broadcast ${id} not found`);
      const updated = { ...existing, ...data };
      broadcasts.set(id, updated);
      return updated;
    },
    async getScheduledNotifications() {
      const now = new Date().toISOString();
      return [...notifications.values()].filter(n => n.scheduled_for && !n.sent_at && n.scheduled_for <= now);
    },
    async getScheduledBroadcasts() {
      const now = new Date().toISOString();
      return [...broadcasts.values()].filter(b => b.scheduled_for && !b.sent_at && b.scheduled_for <= now);
    },
    async createTemplate(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const template: NotificationTemplate = { ...data, id, created_at: now, updated_at: now } as NotificationTemplate;
      templates.set(id, template);
      return template;
    },
    async getTemplates(activeOnly) {
      let result = [...templates.values()];
      if (activeOnly) result = result.filter(t => t.is_active);
      return result;
    },
    async getTemplateById(id) {
      return templates.get(id) ?? null;
    },
    async updateTemplate(id, data) {
      const existing = templates.get(id);
      if (!existing) throw new Error(`Template ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      templates.set(id, updated);
      return updated;
    },
    async deleteTemplate(id) {
      templates.delete(id);
    },
  };
}
