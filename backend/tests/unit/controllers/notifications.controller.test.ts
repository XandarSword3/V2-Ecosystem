import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock notification service
const mockNotificationService = {
  getForUser: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  broadcast: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../src/lib/container', () => ({
  getContainer: vi.fn(() => ({
    notificationService: () => mockNotificationService
  }))
}));

import { getSupabase } from '../../../src/database/connection';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  broadcastNotification,
  deleteNotification
} from '../../../src/modules/admin/controllers/notifications.controller';

describe('NotificationsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock notification service methods
    mockNotificationService.getForUser.mockResolvedValue([]);
    mockNotificationService.markAsRead.mockResolvedValue({ id: 'notif-1', is_read: true });
    mockNotificationService.markAllAsRead.mockResolvedValue(5);
    mockNotificationService.broadcast.mockResolvedValue({ id: 'broadcast-1', title: 'Test' });
    mockNotificationService.delete.mockResolvedValue(undefined);
  });

  describe('getNotifications', () => {
    it('should return aggregated notifications from various sources', async () => {
      const mockOrders = [
        { id: 'order-1', order_number: 'R-001', status: 'pending', created_at: '2026-01-15T10:00:00Z' }
      ];
      const mockBookings = [
        { id: 'booking-1', chalet_id: 'chalet-1', check_in_date: '2026-01-20', status: 'pending', created_at: '2026-01-15T09:00:00Z' }
      ];
      const mockReviews = [
        { id: 'review-1', rating: 5, created_at: '2026-01-15T08:00:00Z' }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') {
          return createChainableMock(mockOrders);
        }
        if (table === 'chalet_bookings') {
          return createChainableMock(mockBookings);
        }
        if (table === 'reviews') {
          return createChainableMock(mockReviews);
        }
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getNotifications(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'order-order-1',
            title: 'New Order',
            type: 'info'
          }),
          expect.objectContaining({
            id: 'booking-booking-1',
            title: 'Chalet Booking',
            type: 'info'
          }),
          expect.objectContaining({
            id: 'review-review-1',
            title: 'Review Pending',
            type: 'warning'
          })
        ])
      }));
    });

    it('should sort notifications by date descending', async () => {
      const mockOrders = [
        { id: 'order-1', order_number: 'R-001', status: 'completed', created_at: '2026-01-15T08:00:00Z' },
        { id: 'order-2', order_number: 'R-002', status: 'pending', created_at: '2026-01-15T10:00:00Z' }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') return createChainableMock(mockOrders);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getNotifications(req, res, next);

      const response = (res.json as any).mock.calls[0][0];
      expect(response.data[0].id).toBe('order-order-2'); // Most recent first
    });

    it('should limit notifications to 20', async () => {
      const mockOrders = Array.from({ length: 25 }, (_, i) => ({
        id: `order-${i}`,
        order_number: `R-00${i}`,
        status: 'pending',
        created_at: `2026-01-15T${String(i % 24).padStart(2, '0')}:00:00Z`
      }));

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') return createChainableMock(mockOrders);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getNotifications(req, res, next);

      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.length).toBeLessThanOrEqual(20);
    });

    it('should mark pending orders as unread', async () => {
      const mockOrders = [
        { id: 'order-1', order_number: 'R-001', status: 'pending', created_at: '2026-01-15T10:00:00Z' }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') return createChainableMock(mockOrders);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getNotifications(req, res, next);

      const response = (res.json as any).mock.calls[0][0];
      expect(response.data[0].is_read).toBe(false);
    });

    it('should mark non-pending orders as read', async () => {
      const mockOrders = [
        { id: 'order-1', order_number: 'R-001', status: 'completed', created_at: '2026-01-15T10:00:00Z' }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') return createChainableMock(mockOrders);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getNotifications(req, res, next);

      const response = (res.json as any).mock.calls[0][0];
      expect(response.data[0].is_read).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const fromMock = vi.fn().mockImplementation(() => {
        throw new Error('DB Error');
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getNotifications(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle empty data sources', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock([]));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getNotifications(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: []
      }));
    });
  });

  describe('markNotificationRead', () => {
    it('should return success', async () => {
      const mockNotification = { id: 'notification-1', is_read: true };
      mockNotificationService.markAsRead.mockResolvedValue(mockNotification);
      
      const { req, res, next } = createMockReqRes({ params: { id: 'notification-1' } });
      await markNotificationRead(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockNotification
      });
    });
  });

  describe('markAllNotificationsRead', () => {
    it('should return success', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(5);
      
      const { req, res, next } = createMockReqRes({ user: { userId: 'user-1' } });
      await markAllNotificationsRead(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '5 notifications marked as read'
      });
    });
  });

  describe('broadcastNotification', () => {
    it('should create broadcast notification successfully', async () => {
      const mockNotification = {
        id: 'notif-1',
        title: 'System Update',
        message: 'Maintenance scheduled',
        type: 'info',
        target_type: 'all'
      };

      mockNotificationService.broadcast.mockResolvedValue(mockNotification);

      const { req, res, next } = createMockReqRes({
        body: { title: 'System Update', message: 'Maintenance scheduled' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await broadcastNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockNotification
      });
    });

    it('should require title', async () => {
      const { req, res, next } = createMockReqRes({
        body: { message: 'Maintenance scheduled' }
      });

      await broadcastNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Title and message are required'
      });
    });

    it('should require message', async () => {
      const { req, res, next } = createMockReqRes({
        body: { title: 'System Update' }
      });

      await broadcastNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Title and message are required'
      });
    });

    it('should handle notification service error gracefully', async () => {
      mockNotificationService.broadcast.mockRejectedValue(new Error('Service error'));

      const { req, res, next } = createMockReqRes({
        body: { title: 'Test', message: 'Test message', type: 'info', target_type: 'staff' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await broadcastNotification(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should use default type and target_type', async () => {
      const mockResult = { id: '1', type: 'info', targetType: 'all' };
      mockNotificationService.broadcast.mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: { title: 'Test', message: 'Test message' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await broadcastNotification(req, res, next);

      expect(mockNotificationService.broadcast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'info',
        targetType: 'all'
      }));
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockNotificationService.delete.mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({ params: { id: 'notif-1' } });
      await deleteNotification(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification deleted'
      });
    });

    it('should handle errors gracefully', async () => {
      mockNotificationService.delete.mockRejectedValue(new Error('Delete failed'));

      const { req, res, next } = createMockReqRes({ params: { id: 'notif-1' } });
      await deleteNotification(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
