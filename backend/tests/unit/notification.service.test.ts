/**
 * Notification Service Tests
 * Tests for DI-based notification management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNotificationService, NotificationServiceError } from '../../src/lib/services/notification.service.js';
import { createInMemoryNotificationRepository } from '../../src/lib/repositories/notification.repository.memory.js';
import type { Notification, NotificationType, NotificationTargetType, NotificationChannel, SocketEmitter, LoggerService } from '../../src/lib/container/types.js';

describe('NotificationService', () => {
  let notificationRepository: ReturnType<typeof createInMemoryNotificationRepository>;
  let socketEmitter: SocketEmitter;
  let logger: LoggerService;
  let service: ReturnType<typeof createNotificationService>;

  const validUserId = '550e8400-e29b-41d4-a716-446655440000';
  const validUserId2 = '550e8400-e29b-41d4-a716-446655440001';

  const mockNotification: Notification = {
    id: 'notif-123',
    user_id: validUserId,
    title: 'Test Notification',
    message: 'This is a test notification',
    type: 'info',
    target_type: 'user',
    channel: 'in_app',
    is_read: false,
    read_at: null,
    data: null,
    created_at: '2024-01-01T10:00:00Z',
    expires_at: null
  };

  beforeEach(() => {
    notificationRepository = createInMemoryNotificationRepository();
    socketEmitter = {
      emitToUnit: vi.fn(),
      emitToRoom: vi.fn()
    };
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    service = createNotificationService({ notificationRepository, socketEmitter, logger });
  });

  // ============================================
  // create Tests
  // ============================================

  describe('create', () => {
    it('should create a notification', async () => {
      const result = await service.create({
        userId: validUserId,
        title: 'New Order',
        message: 'Your order has been placed'
      });

      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(validUserId);
      expect(result.title).toBe('New Order');
      expect(result.message).toBe('Your order has been placed');
      expect(result.type).toBe('info');
      expect(result.is_read).toBe(false);
    });

    it('should create with custom type and channel', async () => {
      const result = await service.create({
        userId: validUserId,
        title: 'Warning',
        message: 'Low inventory alert',
        type: 'warning',
        channel: 'email'
      });

      expect(result.type).toBe('warning');
      expect(result.channel).toBe('email');
    });

    it('should create with custom data', async () => {
      const result = await service.create({
        userId: validUserId,
        title: 'Order Update',
        message: 'Order shipped',
        data: { orderId: '123', trackingNumber: 'ABC' }
      });

      expect(result.data).toEqual({ orderId: '123', trackingNumber: 'ABC' });
    });

    it('should create with expiration', async () => {
      const result = await service.create({
        userId: validUserId,
        title: 'Limited Time',
        message: 'Offer expires soon',
        expiresIn: 3600000 // 1 hour
      });

      expect(result.expires_at).toBeDefined();
      expect(new Date(result.expires_at!).getTime()).toBeGreaterThan(Date.now());
    });

    it('should emit socket event on create', async () => {
      await service.create({
        userId: validUserId,
        title: 'Test',
        message: 'Test message'
      });

      expect(socketEmitter.emitToRoom).toHaveBeenCalledWith(
        `user:${validUserId}`,
        'notification:new',
        expect.any(Object)
      );
    });

    it('should trim whitespace from title and message', async () => {
      const result = await service.create({
        userId: validUserId,
        title: '  Trimmed Title  ',
        message: '  Trimmed Message  '
      });

      expect(result.title).toBe('Trimmed Title');
      expect(result.message).toBe('Trimmed Message');
    });

    it('should throw for empty title', async () => {
      await expect(service.create({
        userId: validUserId,
        title: '',
        message: 'Valid message'
      })).rejects.toThrow('Title is required');
    });

    it('should throw for title too short or long', async () => {
      await expect(service.create({
        userId: validUserId,
        title: 'A',
        message: 'Valid message'
      })).rejects.toThrow('between 2 and 200');

      await expect(service.create({
        userId: validUserId,
        title: 'A'.repeat(201),
        message: 'Valid message'
      })).rejects.toThrow('between 2 and 200');
    });

    it('should throw for empty message', async () => {
      await expect(service.create({
        userId: validUserId,
        title: 'Valid Title',
        message: ''
      })).rejects.toThrow('Message is required');
    });

    it('should throw for message too short or long', async () => {
      await expect(service.create({
        userId: validUserId,
        title: 'Valid Title',
        message: 'A'
      })).rejects.toThrow('between 2 and 2000');

      await expect(service.create({
        userId: validUserId,
        title: 'Valid Title',
        message: 'A'.repeat(2001)
      })).rejects.toThrow('between 2 and 2000');
    });

    it('should throw for invalid user ID', async () => {
      await expect(service.create({
        userId: 'invalid-uuid',
        title: 'Test',
        message: 'Test message'
      })).rejects.toThrow('Invalid user ID format');
    });

    it('should throw for invalid type', async () => {
      await expect(service.create({
        userId: validUserId,
        title: 'Test',
        message: 'Test message',
        type: 'invalid' as NotificationType
      })).rejects.toThrow('Invalid type');
    });

    it('should throw for invalid target type', async () => {
      await expect(service.create({
        userId: validUserId,
        title: 'Test',
        message: 'Test message',
        targetType: 'invalid' as NotificationTargetType
      })).rejects.toThrow('Invalid target type');
    });

    it('should throw for invalid channel', async () => {
      await expect(service.create({
        userId: validUserId,
        title: 'Test',
        message: 'Test message',
        channel: 'invalid' as NotificationChannel
      })).rejects.toThrow('Invalid channel');
    });

    it.each(['info', 'warning', 'error', 'success'] as NotificationType[])(
      'should accept valid type: %s',
      async (type) => {
        const result = await service.create({
          userId: validUserId,
          title: 'Test',
          message: 'Test message',
          type
        });
        expect(result.type).toBe(type);
      }
    );

    it.each(['in_app', 'email', 'sms', 'push'] as NotificationChannel[])(
      'should accept valid channel: %s',
      async (channel) => {
        const result = await service.create({
          userId: validUserId,
          title: 'Test',
          message: 'Test message',
          channel
        });
        expect(result.channel).toBe(channel);
      }
    );
  });

  // ============================================
  // getById Tests
  // ============================================

  describe('getById', () => {
    it('should return notification by ID', async () => {
      notificationRepository.addNotification(mockNotification);

      const result = await service.getById('notif-123');

      expect(result).toMatchObject({
        id: 'notif-123',
        title: 'Test Notification'
      });
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw for empty ID', async () => {
      await expect(service.getById('')).rejects.toThrow('Notification ID is required');
    });
  });

  // ============================================
  // getForUser Tests
  // ============================================

  describe('getForUser', () => {
    beforeEach(() => {
      notificationRepository.addNotification(mockNotification);
      notificationRepository.addNotification({
        ...mockNotification,
        id: 'notif-124',
        is_read: true,
        type: 'warning'
      });
      notificationRepository.addNotification({
        ...mockNotification,
        id: 'notif-125',
        user_id: validUserId2
      });
    });

    it('should return notifications for a user', async () => {
      const result = await service.getForUser(validUserId);

      expect(result).toHaveLength(2);
      expect(result.every(n => n.user_id === validUserId)).toBe(true);
    });

    it('should filter unread only', async () => {
      const result = await service.getForUser(validUserId, { unreadOnly: true });

      expect(result).toHaveLength(1);
      expect(result[0].is_read).toBe(false);
    });

    it('should filter by type', async () => {
      const result = await service.getForUser(validUserId, { type: 'warning' });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('warning');
    });

    it('should limit results', async () => {
      const result = await service.getForUser(validUserId, { limit: 1 });

      expect(result).toHaveLength(1);
    });

    it('should throw for missing user ID', async () => {
      await expect(service.getForUser('')).rejects.toThrow('Invalid user ID format');
    });

    it('should throw for invalid user ID', async () => {
      await expect(service.getForUser('invalid')).rejects.toThrow('Invalid user ID format');
    });
  });

  // ============================================
  // getAll Tests
  // ============================================

  describe('getAll', () => {
    beforeEach(() => {
      notificationRepository.addNotification(mockNotification);
      notificationRepository.addNotification({
        ...mockNotification,
        id: 'notif-124',
        type: 'warning',
        target_type: 'admin'
      });
      notificationRepository.addNotification({
        ...mockNotification,
        id: 'notif-125',
        is_read: true
      });
    });

    it('should return all notifications with total', async () => {
      const result = await service.getAll();

      expect(result.total).toBe(3);
      expect(result.notifications).toHaveLength(3);
    });

    it('should filter by type', async () => {
      const result = await service.getAll({
        filters: { type: 'warning' }
      });

      expect(result.notifications.every(n => n.type === 'warning')).toBe(true);
    });

    it('should filter by target type', async () => {
      const result = await service.getAll({
        filters: { targetType: 'admin' }
      });

      expect(result.notifications.every(n => n.target_type === 'admin')).toBe(true);
    });

    it('should filter by read status', async () => {
      const result = await service.getAll({
        filters: { isRead: true }
      });

      expect(result.notifications.every(n => n.is_read === true)).toBe(true);
    });

    it('should apply pagination', async () => {
      const result = await service.getAll({ limit: 2, offset: 0 });

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('should throw for invalid limit', async () => {
      await expect(service.getAll({ limit: 0 })).rejects.toThrow('Limit must be between 1 and 100');
      await expect(service.getAll({ limit: 101 })).rejects.toThrow('Limit must be between 1 and 100');
    });

    it('should throw for invalid offset', async () => {
      await expect(service.getAll({ offset: -1 })).rejects.toThrow('Offset must be a non-negative integer');
    });
  });

  // ============================================
  // getUnreadCount Tests
  // ============================================

  describe('getUnreadCount', () => {
    beforeEach(() => {
      notificationRepository.addNotification(mockNotification);
      notificationRepository.addNotification({ ...mockNotification, id: 'n2' });
      notificationRepository.addNotification({ ...mockNotification, id: 'n3', is_read: true });
    });

    it('should return unread count', async () => {
      const count = await service.getUnreadCount(validUserId);

      expect(count).toBe(2);
    });

    it('should return 0 for user with no notifications', async () => {
      const count = await service.getUnreadCount(validUserId2);

      expect(count).toBe(0);
    });

    it('should throw for invalid user ID', async () => {
      await expect(service.getUnreadCount('invalid')).rejects.toThrow('Invalid user ID format');
    });
  });

  // ============================================
  // markAsRead Tests
  // ============================================

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      notificationRepository.addNotification(mockNotification);

      const result = await service.markAsRead('notif-123');

      expect(result.is_read).toBe(true);
      expect(result.read_at).toBeDefined();
    });

    it('should emit socket event', async () => {
      notificationRepository.addNotification(mockNotification);

      await service.markAsRead('notif-123');

      expect(socketEmitter.emitToRoom).toHaveBeenCalledWith(
        `user:${validUserId}`,
        'notification:read',
        { id: 'notif-123' }
      );
    });

    it('should return already read notification without changes', async () => {
      notificationRepository.addNotification({
        ...mockNotification,
        is_read: true,
        read_at: '2024-01-01T12:00:00Z'
      });

      const result = await service.markAsRead('notif-123');

      expect(result.is_read).toBe(true);
    });

    it('should throw for non-existent notification', async () => {
      await expect(service.markAsRead('nonexistent'))
        .rejects.toThrow('Notification not found');
    });

    it('should throw for empty ID', async () => {
      await expect(service.markAsRead('')).rejects.toThrow('Notification ID is required');
    });
  });

  // ============================================
  // markAllAsRead Tests
  // ============================================

  describe('markAllAsRead', () => {
    beforeEach(() => {
      notificationRepository.addNotification(mockNotification);
      notificationRepository.addNotification({ ...mockNotification, id: 'n2' });
      notificationRepository.addNotification({ ...mockNotification, id: 'n3', is_read: true });
    });

    it('should mark all unread as read', async () => {
      const count = await service.markAllAsRead(validUserId);

      expect(count).toBe(2);
    });

    it('should emit socket event', async () => {
      await service.markAllAsRead(validUserId);

      expect(socketEmitter.emitToRoom).toHaveBeenCalledWith(
        `user:${validUserId}`,
        'notification:all-read',
        { count: 2 }
      );
    });

    it('should return 0 if all already read', async () => {
      notificationRepository.clear();
      notificationRepository.addNotification({ ...mockNotification, is_read: true });

      const count = await service.markAllAsRead(validUserId);

      expect(count).toBe(0);
    });

    it('should throw for invalid user ID', async () => {
      await expect(service.markAllAsRead('invalid')).rejects.toThrow('Invalid user ID format');
    });
  });

  // ============================================
  // delete Tests
  // ============================================

  describe('delete', () => {
    it('should delete notification', async () => {
      notificationRepository.addNotification(mockNotification);

      await service.delete('notif-123');

      const result = await service.getById('notif-123');
      expect(result).toBeNull();
    });

    it('should throw for non-existent notification', async () => {
      await expect(service.delete('nonexistent'))
        .rejects.toThrow('Notification not found');
    });

    it('should throw for empty ID', async () => {
      await expect(service.delete('')).rejects.toThrow('Notification ID is required');
    });
  });

  // ============================================
  // deleteExpired Tests
  // ============================================

  describe('deleteExpired', () => {
    it('should delete expired notifications', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      notificationRepository.addNotification({
        ...mockNotification,
        expires_at: pastDate
      });
      notificationRepository.addNotification({
        ...mockNotification,
        id: 'n2',
        expires_at: null
      });

      const count = await service.deleteExpired();

      expect(count).toBe(1);
      expect(notificationRepository.getAllNotifications()).toHaveLength(1);
    });

    it('should log deletion count', async () => {
      await service.deleteExpired();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted')
      );
    });
  });

  // ============================================
  // broadcast Tests
  // ============================================

  describe('broadcast', () => {
    it('should create a broadcast notification', async () => {
      const result = await service.broadcast({
        title: 'System Update',
        message: 'Scheduled maintenance tonight',
        createdBy: validUserId
      });

      expect(result.id).toBeDefined();
      expect(result.title).toBe('System Update');
      expect(result.target_type).toBe('all');
    });

    it('should broadcast to specific target', async () => {
      const result = await service.broadcast({
        title: 'Admin Alert',
        message: 'New user registered',
        targetType: 'admin',
        createdBy: validUserId
      });

      expect(result.target_type).toBe('admin');
    });

    it('should emit socket event', async () => {
      await service.broadcast({
        title: 'Test',
        message: 'Test broadcast',
        createdBy: validUserId
      });

      expect(socketEmitter.emitToRoom).toHaveBeenCalledWith(
        'notifications',
        'notification:broadcast',
        expect.any(Object)
      );
    });

    it('should throw for missing createdBy', async () => {
      await expect(service.broadcast({
        title: 'Test',
        message: 'Test',
        createdBy: ''
      })).rejects.toThrow('Invalid user ID format');
    });
  });

  // ============================================
  // getBroadcasts Tests
  // ============================================

  describe('getBroadcasts', () => {
    beforeEach(async () => {
      await service.broadcast({
        title: 'All Users',
        message: 'Message for all',
        targetType: 'all',
        createdBy: validUserId
      });
      await service.broadcast({
        title: 'Admin Only',
        message: 'Admin message',
        targetType: 'admin',
        createdBy: validUserId
      });
    });

    it('should return all broadcasts', async () => {
      const result = await service.getBroadcasts();

      expect(result).toHaveLength(2);
    });

    it('should filter by target type', async () => {
      const result = await service.getBroadcasts('admin');

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw for invalid target type', async () => {
      await expect(service.getBroadcasts('invalid' as NotificationTargetType))
        .rejects.toThrow('Invalid target type');
    });
  });

  // ============================================
  // Convenience Methods Tests
  // ============================================

  describe('sendInfo', () => {
    it('should create info notification', async () => {
      const result = await service.sendInfo(validUserId, 'Info', 'Info message');

      expect(result.type).toBe('info');
    });
  });

  describe('sendSuccess', () => {
    it('should create success notification', async () => {
      const result = await service.sendSuccess(validUserId, 'Success', 'Success message');

      expect(result.type).toBe('success');
    });
  });

  describe('sendWarning', () => {
    it('should create warning notification', async () => {
      const result = await service.sendWarning(validUserId, 'Warning', 'Warning message');

      expect(result.type).toBe('warning');
    });
  });

  describe('sendError', () => {
    it('should create error notification', async () => {
      const result = await service.sendError(validUserId, 'Error', 'Error message');

      expect(result.type).toBe('error');
    });
  });

  describe('sendOrderNotification', () => {
    it('should create order notification with data', async () => {
      const result = await service.sendOrderNotification(validUserId, 'ORD-123', 'completed');

      expect(result.title).toBe('Order Update');
      expect(result.type).toBe('success');
      expect(result.data).toEqual({ orderNumber: 'ORD-123', status: 'completed' });
    });

    it('should use info type for non-completed status', async () => {
      const result = await service.sendOrderNotification(validUserId, 'ORD-123', 'pending');

      expect(result.type).toBe('info');
    });
  });

  describe('sendBookingNotification', () => {
    it('should create booking notification', async () => {
      const result = await service.sendBookingNotification(validUserId, 'BK-123', 'confirmed');

      expect(result.title).toBe('Booking Update');
      expect(result.type).toBe('success');
      expect(result.data).toEqual({ bookingId: 'BK-123', status: 'confirmed' });
    });
  });

  // ============================================
  // Utility Methods Tests
  // ============================================

  describe('getValidTypes', () => {
    it('should return all valid types', () => {
      const types = service.getValidTypes();

      expect(types).toContain('info');
      expect(types).toContain('warning');
      expect(types).toContain('error');
      expect(types).toContain('success');
    });
  });

  describe('getValidTargetTypes', () => {
    it('should return all valid target types', () => {
      const types = service.getValidTargetTypes();

      expect(types).toContain('all');
      expect(types).toContain('admin');
      expect(types).toContain('staff');
      expect(types).toContain('user');
    });
  });

  describe('getValidChannels', () => {
    it('should return all valid channels', () => {
      const channels = service.getValidChannels();

      expect(channels).toContain('in_app');
      expect(channels).toContain('email');
      expect(channels).toContain('sms');
      expect(channels).toContain('push');
    });
  });

  // ============================================
  // NotificationServiceError Tests
  // ============================================

  describe('NotificationServiceError', () => {
    it('should have correct properties', () => {
      const error = new NotificationServiceError('Test error', 'TEST_CODE', 404);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotificationServiceError');
    });

    it('should default to 400 status code', () => {
      const error = new NotificationServiceError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(400);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should work without socket emitter', async () => {
      const serviceWithoutSocket = createNotificationService({ notificationRepository });

      const result = await serviceWithoutSocket.create({
        userId: validUserId,
        title: 'Test',
        message: 'Test message'
      });

      expect(result.id).toBeDefined();
    });

    it('should work without logger', async () => {
      const serviceWithoutLogger = createNotificationService({ notificationRepository, socketEmitter });

      await serviceWithoutLogger.markAllAsRead(validUserId);
      await serviceWithoutLogger.deleteExpired();
      // Should not throw
    });

    it('should handle concurrent creates', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.create({
          userId: validUserId,
          title: `Notification ${i}`,
          message: `Message ${i}`
        }));
      }

      await Promise.all(promises);

      const { total } = await service.getAll();
      expect(total).toBe(10);
    });

    it('should handle special characters in title and message', async () => {
      const result = await service.create({
        userId: validUserId,
        title: 'Special <>&" chars',
        message: 'Unicode: 你好 🎉'
      });

      expect(result.title).toBe('Special <>&" chars');
      expect(result.message).toBe('Unicode: 你好 🎉');
    });

    it('should create without user ID for broadcast-style notifications', async () => {
      const result = await service.create({
        title: 'System Alert',
        message: 'System-wide notification',
        targetType: 'all'
      });

      expect(result.user_id).toBeNull();
    });
  });
});
