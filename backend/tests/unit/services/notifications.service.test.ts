/**
 * Notification Service Unit Tests
 * 
 * Tests the real database operations and business logic of NotificationService:
 * - getForUser with unreadOnly, type, limit, property scoping, and error handling
 * - markAsRead and markAllAsRead with user and property scoping
 * - broadcast (single insert, multi-recipient notifications, priority defaults)
 * - create single in-app notification
 * - delete and deleteMultiple notifications
 * - template management (CRUD: getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate)
 * - sendFromTemplate variable interpolation and broadcast delegation
 * - getBroadcasts with filtering
 * - processScheduledNotifications marking sent_at
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function createChainableMock(defaultData: any = null, error: any = null) {
  const chain: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'in', 'lte', 'is'];
  methods.forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockImplementation(() => {
    return Promise.resolve({ data: defaultData, error });
  });
  chain.then = (resolve: any) => resolve({ data: defaultData, error });
  return chain;
}

let mockChain: any;

const mockSupabase = {
  from: vi.fn(() => mockChain),
};

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { notificationService } from '../../../src/services/notifications.service.js';

describe('NotificationService', () => {
  const tenantId = 'tenant-123';
  const propertyId = 'prop-456';
  const userId = 'user-789';

  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChainableMock([]);
    mockSupabase.from = vi.fn(() => mockChain);
  });

  describe('getForUser', () => {
    it('fetches notifications with property and user scoping', async () => {
      const mockNotifs = [
        { id: 'notif-1', user_id: userId, property_id: propertyId, title: 'Welcome', read: false },
      ];
      mockChain = createChainableMock(mockNotifs);

      const result = await notificationService.getForUser(userId, { propertyId });

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockNotifs);
    });

    it('applies unreadOnly, type, and limit filters when provided', async () => {
      mockChain = createChainableMock([]);

      await notificationService.getForUser(userId, {
        propertyId,
        unreadOnly: true,
        type: 'booking_update',
        limit: 10,
      });

      expect(mockChain.eq).toHaveBeenCalledWith('read', false);
      expect(mockChain.eq).toHaveBeenCalledWith('type', 'booking_update');
      expect(mockChain.limit).toHaveBeenCalledWith(10);
    });

    it('returns empty array and logs error on query failure', async () => {
      mockChain = createChainableMock(null, { message: 'Database error' });

      const result = await notificationService.getForUser(userId, { propertyId });

      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('updates read status with user and property scoping', async () => {
      const updatedNotif = { id: 'notif-1', user_id: userId, property_id: propertyId, read: true };
      mockChain = createChainableMock(updatedNotif);

      const result = await notificationService.markAsRead('notif-1', userId, propertyId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ read: true, read_at: expect.any(String) })
      );
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'notif-1');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(result).toEqual(updatedNotif);
    });

    it('returns null when update fails', async () => {
      mockChain = createChainableMock(null, { message: 'Record not found' });

      const result = await notificationService.markAsRead('notif-none', userId, propertyId);

      expect(result).toBeNull();
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read and returns count', async () => {
      const readNotifs = [{ id: 'n-1' }, { id: 'n-2' }, { id: 'n-3' }];
      mockChain = createChainableMock(readNotifs);

      const count = await notificationService.markAllAsRead(userId, propertyId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ read: true })
      );
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(mockChain.eq).toHaveBeenCalledWith('read', false);
      expect(mockChain.select).toHaveBeenCalledWith('id');
      expect(count).toBe(3);
    });

    it('returns 0 when update error occurs', async () => {
      mockChain = createChainableMock(null, { message: 'DB Error' });

      const count = await notificationService.markAllAsRead(userId, propertyId);

      expect(count).toBe(0);
    });
  });

  describe('create (single in-app notification)', () => {
    it('inserts a single notification with default priority', async () => {
      const mockCreated = {
        id: 'notif-1',
        user_id: userId,
        type: 'alert',
        title: 'Heads Up',
        message: 'Your order is ready',
        channel: 'in_app',
        priority: 'normal',
        target_type: 'customer',
        target_id: 'order-1',
        actions: [],
        read: false,
        property_id: propertyId,
        tenant_id: tenantId,
      };
      mockChain = createChainableMock(mockCreated);

      const result = await notificationService.create({
        userId,
        type: 'alert',
        title: 'Heads Up',
        message: 'Your order is ready',
        targetType: 'customer',
        targetId: 'order-1',
        propertyId,
        tenantId,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          type: 'alert',
          title: 'Heads Up',
          channel: 'in_app',
          priority: 'normal',
          read: false,
          property_id: propertyId,
          tenant_id: tenantId,
        })
      );
      expect(result).toEqual(mockCreated);
    });

    it('returns null on insert error', async () => {
      mockChain = createChainableMock(null, { message: 'Insert constraint error' });

      const result = await notificationService.create({
        userId,
        type: 'alert',
        title: 'Fail',
        message: 'Fail',
        propertyId,
        tenantId,
      });

      expect(result).toBeNull();
    });
  });

  describe('broadcast', () => {
    it('creates broadcast row and dispatches individual user notifications', async () => {
      const mockBroadcast = {
        id: 'broadcast-1',
        title: 'Maintenance',
        message: 'Scheduled downtime at midnight',
        priority: 'high',
        property_id: propertyId,
        tenant_id: tenantId,
      };

      const fromCalls: string[] = [];
      const broadcastChain = createChainableMock(mockBroadcast);
      const notifsChain = createChainableMock([]);

      mockSupabase.from = vi.fn((table: string) => {
        fromCalls.push(table);
        if (table === 'notification_broadcasts') return broadcastChain;
        if (table === 'notifications') return notifsChain;
        return createChainableMock([]);
      });

      const result = await notificationService.broadcast({
        title: 'Maintenance',
        message: 'Scheduled downtime at midnight',
        priority: 'high',
        targetUserIds: ['user-1', 'user-2'],
        propertyId,
        tenantId,
      });

      expect(fromCalls).toContain('notification_broadcasts');
      expect(fromCalls).toContain('notifications');
      expect(broadcastChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Maintenance',
          message: 'Scheduled downtime at midnight',
          priority: 'high',
          channel: 'in_app',
          property_id: propertyId,
          tenant_id: tenantId,
        })
      );
      expect(notifsChain.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'user-1', title: 'Maintenance', channel: 'in_app' }),
          expect.objectContaining({ user_id: 'user-2', title: 'Maintenance', channel: 'in_app' }),
        ])
      );
      expect(result).toEqual(mockBroadcast);
    });

    it('logs error if creating individual notifications in broadcast encounters an error', async () => {
      const mockBroadcast = { id: 'broadcast-1' };
      const broadcastChain = createChainableMock(mockBroadcast);
      const notifsChain = createChainableMock(null, { message: 'Insert notifications failed' });

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'notification_broadcasts') return broadcastChain;
        if (table === 'notifications') return notifsChain;
        return createChainableMock([]);
      });

      const result = await notificationService.broadcast({
        title: 'Maintenance',
        message: 'Notice',
        targetUserIds: ['user-1'],
        propertyId,
        tenantId,
      });

      expect(result).toEqual(mockBroadcast);
    });

    it('throws error when broadcast insertion fails', async () => {
      mockChain = createChainableMock(null, { message: 'Broadcast insert failed' });
      mockSupabase.from = vi.fn().mockReturnValue(mockChain);

      await expect(
        notificationService.broadcast({
          title: 'Test',
          message: 'Test msg',
          propertyId,
          tenantId,
        })
      ).rejects.toEqual({ message: 'Broadcast insert failed' });
    });
  });

  describe('delete & deleteMultiple', () => {
    it('deletes a single notification by id with user and property scoping', async () => {
      mockChain = createChainableMock(null);

      await notificationService.delete('notif-1', userId, propertyId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'notif-1');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
    });

    it('throws error when delete fails', async () => {
      mockChain = createChainableMock(null, { message: 'Delete error' });

      await expect(
        notificationService.delete('notif-1', userId, propertyId)
      ).rejects.toEqual({ message: 'Delete error' });
    });

    it('deletes multiple notifications and returns count', async () => {
      mockChain = createChainableMock(null);

      const count = await notificationService.deleteMultiple(['n-1', 'n-2'], userId, propertyId);

      expect(mockChain.in).toHaveBeenCalledWith('id', ['n-1', 'n-2']);
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(count).toBe(2);
    });

    it('returns 0 when deleteMultiple encounters an error', async () => {
      mockChain = createChainableMock(null, { message: 'Bulk delete error' });

      const count = await notificationService.deleteMultiple(['n-1'], userId, propertyId);

      expect(count).toBe(0);
    });
  });

  describe('Templates Management', () => {
    it('getTemplates returns active templates by default', async () => {
      const templates = [
        { id: 'tmpl-1', name: 'Order Ready', is_active: true },
      ];
      mockChain = createChainableMock(templates);

      const result = await notificationService.getTemplates(true, propertyId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toEqual(templates);
    });

    it('getTemplates returns all templates if activeOnly is false', async () => {
      mockChain = createChainableMock([]);

      await notificationService.getTemplates(false, propertyId);

      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(mockChain.eq).not.toHaveBeenCalledWith('is_active', true);
    });

    it('getTemplates returns empty array on error', async () => {
      mockChain = createChainableMock(null, { message: 'Database error' });

      const result = await notificationService.getTemplates(true, propertyId);

      expect(result).toEqual([]);
    });

    it('getTemplateById returns single template', async () => {
      const tmpl = { id: 'tmpl-1', name: 'Tmpl', property_id: propertyId };
      mockChain = createChainableMock(tmpl);

      const result = await notificationService.getTemplateById('tmpl-1', propertyId);

      expect(mockChain.eq).toHaveBeenCalledWith('id', 'tmpl-1');
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(result).toEqual(tmpl);
    });

    it('getTemplateById returns null on error', async () => {
      mockChain = createChainableMock(null, { message: 'Not found' });

      const result = await notificationService.getTemplateById('tmpl-missing', propertyId);

      expect(result).toBeNull();
    });

    it('createTemplate inserts new notification template', async () => {
      const newTmpl = { id: 'tmpl-new', name: 'Check-in Notice' };
      mockChain = createChainableMock(newTmpl);

      const result = await notificationService.createTemplate({
        name: 'Check-in Notice',
        title: 'Welcome {guestName}',
        message: 'Your room is ready',
        propertyId,
        tenantId,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Check-in Notice',
          title_template: 'Welcome {guestName}',
          body_template: 'Your room is ready',
          channel: 'in_app',
          property_id: propertyId,
          tenant_id: tenantId,
        })
      );
      expect(result).toEqual(newTmpl);
    });

    it('createTemplate throws error when insertion fails', async () => {
      mockChain = createChainableMock(null, { message: 'Insert failed' });

      await expect(
        notificationService.createTemplate({
          name: 'Failing Template',
          title: 'Title',
          message: 'Body',
          propertyId,
          tenantId,
        })
      ).rejects.toEqual({ message: 'Insert failed' });
    });

    it('updateTemplate updates specified template fields', async () => {
      const updatedTmpl = { id: 'tmpl-1', name: 'Updated Name' };
      mockChain = createChainableMock(updatedTmpl);

      const result = await notificationService.updateTemplate('tmpl-1', {
        name: 'Updated Name',
        title: 'New Title',
        propertyId,
      });

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          title_template: 'New Title',
          updated_at: expect.any(String),
        })
      );
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'tmpl-1');
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(result).toEqual(updatedTmpl);
    });

    it('updateTemplate returns null on error', async () => {
      mockChain = createChainableMock(null, { message: 'Update failed' });

      const result = await notificationService.updateTemplate('tmpl-1', {
        name: 'New Name',
        propertyId,
      });

      expect(result).toBeNull();
    });

    it('deleteTemplate deletes specified template', async () => {
      mockChain = createChainableMock(null);

      await notificationService.deleteTemplate('tmpl-1', propertyId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'tmpl-1');
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
    });

    it('deleteTemplate throws error on failure', async () => {
      mockChain = createChainableMock(null, { message: 'Delete template failed' });

      await expect(
        notificationService.deleteTemplate('tmpl-1', propertyId)
      ).rejects.toEqual({ message: 'Delete template failed' });
    });
  });

  describe('sendFromTemplate', () => {
    it('interpolates template variables and invokes broadcast', async () => {
      const mockTemplate = {
        id: 'tmpl-1',
        name: 'Table Ready',
        titleTemplate: 'Table ready for {customer}',
        bodyTemplate: 'Please arrive at {time} for table {tableNumber}',
        type: 'table_status',
      };

      vi.spyOn(notificationService, 'getTemplateById').mockResolvedValue(mockTemplate as any);
      const broadcastSpy = vi.spyOn(notificationService, 'broadcast').mockResolvedValue({ id: 'bc-1' } as any);

      const result = await notificationService.sendFromTemplate(
        'tmpl-1',
        { customer: 'Alice', time: '7:30 PM', tableNumber: '12' },
        {
          targetUserIds: ['user-1'],
          propertyId,
          tenantId,
        }
      );

      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Table ready for Alice',
          message: 'Please arrive at 7:30 PM for table 12',
          type: 'table_status',
          targetUserIds: ['user-1'],
          propertyId,
          tenantId,
        })
      );
      expect(result).toEqual({ id: 'bc-1' });
    });

    it('throws error when template is not found', async () => {
      vi.spyOn(notificationService, 'getTemplateById').mockResolvedValue(null);

      await expect(
        notificationService.sendFromTemplate('tmpl-missing', {}, { propertyId, tenantId })
      ).rejects.toThrow('Template not found');
    });
  });

  describe('getBroadcasts & processScheduledNotifications', () => {
    it('fetches broadcasts with optional targetType filter', async () => {
      const broadcasts = [{ id: 'bc-1', title: 'Sale!' }];
      mockChain = createChainableMock(broadcasts);

      const result = await notificationService.getBroadcasts('customer', propertyId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_broadcasts');
      expect(mockChain.eq).toHaveBeenCalledWith('property_id', propertyId);
      expect(mockChain.eq).toHaveBeenCalledWith('target_type', 'customer');
      expect(result).toEqual(broadcasts);
    });

    it('returns empty array when getBroadcasts fails', async () => {
      mockChain = createChainableMock(null, { message: 'DB error' });

      const result = await notificationService.getBroadcasts(undefined, propertyId);

      expect(result).toEqual([]);
    });

    it('returns valid priority values', () => {
      const priorities = notificationService.getValidPriorities();
      expect(priorities).toEqual(['low', 'normal', 'high', 'critical']);
    });

    it('processScheduledNotifications finds pending scheduled items and marks them sent', async () => {
      const scheduledItems = [
        { id: 'sched-1', scheduled_for: '2026-01-01T00:00:00Z', sent_at: null },
        { id: 'sched-2', scheduled_for: '2026-01-01T01:00:00Z', sent_at: null },
      ];

      const selectChain = createChainableMock(scheduledItems);
      const updateChain = createChainableMock(null);

      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) return selectChain;
        return updateChain;
      });

      const count = await notificationService.processScheduledNotifications(propertyId);

      expect(selectChain.lte).toHaveBeenCalledWith('scheduled_for', expect.any(String));
      expect(selectChain.is).toHaveBeenCalledWith('sent_at', null);
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ sent_at: expect.any(String) })
      );
      expect(updateChain.in).toHaveBeenCalledWith('id', ['sched-1', 'sched-2']);
      expect(count).toBe(2);
    });

    it('processScheduledNotifications returns 0 when fetch fails', async () => {
      mockChain = createChainableMock(null, { message: 'Fetch error' });

      const count = await notificationService.processScheduledNotifications(propertyId);

      expect(count).toBe(0);
    });

    it('processScheduledNotifications returns 0 when no scheduled items found', async () => {
      mockChain = createChainableMock([]);

      const count = await notificationService.processScheduledNotifications(propertyId);

      expect(count).toBe(0);
    });

    it('processScheduledNotifications returns 0 when batch update fails', async () => {
      const scheduledItems = [{ id: 'sched-1', scheduled_for: '2026-01-01T00:00:00Z', sent_at: null }];
      const selectChain = createChainableMock(scheduledItems);
      const updateChain = createChainableMock(null, { message: 'Update error' });

      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) return selectChain;
        return updateChain;
      });

      const count = await notificationService.processScheduledNotifications(propertyId);

      expect(count).toBe(0);
    });
  });
});
