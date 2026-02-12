/**
 * Notification Repository Supabase Tests
 * Tests for database-backed notification operations using chainable Supabase mocks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================
// MOCK FACTORY
// =============================================
function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'range'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown; count?: number }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
    return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', created_at: new Date().toISOString(), ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data, error: null })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.select = vi.fn().mockReturnValue(Promise.resolve({ data: [{ id: 'deleted-1' }], error: null }));
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: [{ id: 'deleted-1' }], error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// =============================================
// MOCK DATA
// =============================================
const mockNotification = {
  id: 'notif-1',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Order Confirmed',
  message: 'Your order #123 has been confirmed',
  type: 'success',
  target_type: 'user',
  channel: 'in_app',
  priority: 'normal',
  is_read: false,
  read_at: null,
  data: { orderId: '123' },
  actions: [{ label: 'View Order', url: '/orders/123', style: 'primary' }],
  scheduled_for: null,
  sent_at: '2024-01-15T10:00:00Z',
  expires_at: null,
  created_at: '2024-01-15T10:00:00Z'
};

const mockUnreadNotification = {
  id: 'notif-2',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Low Inventory',
  message: 'Items running low in stock',
  type: 'warning',
  target_type: 'staff',
  channel: 'in_app',
  priority: 'high',
  is_read: false,
  read_at: null,
  data: null,
  actions: null,
  scheduled_for: null,
  sent_at: '2024-01-15T11:00:00Z',
  expires_at: null,
  created_at: '2024-01-15T11:00:00Z'
};

const mockBroadcast = {
  id: 'broadcast-1',
  title: 'System Maintenance',
  message: 'The system will be down for maintenance tonight',
  type: 'warning',
  target_type: 'all',
  priority: 'high',
  target_user_ids: [],
  actions: null,
  scheduled_for: null,
  sent_at: '2024-01-15T12:00:00Z',
  delivery_count: 150,
  read_count: 75,
  created_by: '550e8400-e29b-41d4-a716-446655440001',
  created_at: '2024-01-15T12:00:00Z'
};

const mockScheduledBroadcast = {
  id: 'broadcast-2',
  title: 'Upcoming Event',
  message: 'Join us for the summer event',
  type: 'info',
  target_type: 'customer',
  priority: 'normal',
  target_user_ids: ['550e8400-e29b-41d4-a716-446655440000'],
  actions: [{ label: 'RSVP', url: '/events/summer', style: 'primary' }],
  scheduled_for: '2024-02-01T09:00:00Z',
  sent_at: null,
  delivery_count: 0,
  read_count: 0,
  created_by: '550e8400-e29b-41d4-a716-446655440001',
  created_at: '2024-01-15T12:00:00Z'
};

const mockTemplate = {
  id: 'template-1',
  name: 'Order Confirmation',
  title: 'Order #{{orderNumber}} Confirmed',
  message: 'Hi {{customerName}}, your order has been confirmed!',
  type: 'success',
  target_type: 'customer',
  priority: 'normal',
  actions: [{ label: 'Track Order', url: '/orders/{{orderId}}', style: 'primary' }],
  variables: ['orderNumber', 'customerName', 'orderId'],
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockInactiveTemplate = {
  id: 'template-2',
  name: 'Welcome Deprecated',
  title: 'Welcome to our resort',
  message: 'Thank you for joining us',
  type: 'info',
  target_type: 'user',
  priority: 'low',
  actions: null,
  variables: [],
  is_active: false,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

// =============================================
// MOCK SUPABASE
// =============================================
let mockNotifications = createQueryMock(() => [mockNotification, mockUnreadNotification]);
let mockBroadcasts = createQueryMock(() => [mockBroadcast, mockScheduledBroadcast]);
let mockTemplates = createQueryMock(() => [mockTemplate]);

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'notifications') return mockNotifications;
    if (table === 'notification_broadcasts') return mockBroadcasts;
    if (table === 'notification_templates') return mockTemplates;
    return createQueryMock(() => []);
  })
};

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: () => mockSupabase
}));

import { createSupabaseNotificationRepository } from '../../../../src/lib/repositories/notification.repository.supabase';

describe('NotificationRepository Supabase', () => {
  let repository: ReturnType<typeof createSupabaseNotificationRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks with fresh data
    mockNotifications = createQueryMock(() => [mockNotification, mockUnreadNotification]);
    mockBroadcasts = createQueryMock(() => [mockBroadcast, mockScheduledBroadcast]);
    mockTemplates = createQueryMock(() => [mockTemplate]);
    repository = createSupabaseNotificationRepository();
  });

  // =============================================
  // NOTIFICATION CRUD TESTS
  // =============================================

  describe('create', () => {
    it('should create a new notification', async () => {
      const newNotification = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Test',
        message: 'Test message content',
        type: 'info' as const,
        target_type: 'user' as const,
        channel: 'in_app' as const,
        priority: 'normal' as const,
        is_read: false,
        read_at: null,
        data: null,
        actions: undefined,
        scheduled_for: undefined,
        sent_at: '2024-01-15T10:00:00Z',
        expires_at: undefined
      };

      const result = await repository.create(newNotification);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockNotifications.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should create notification with custom data and actions', async () => {
      const newNotification = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Action Required',
        message: 'Please review the submission',
        type: 'warning' as const,
        target_type: 'admin' as const,
        channel: 'email' as const,
        priority: 'high' as const,
        is_read: false,
        read_at: null,
        data: { submissionId: 'sub-123', type: 'review' },
        actions: [
          { label: 'Approve', url: '/submissions/sub-123/approve', style: 'primary' as const },
          { label: 'Reject', url: '/submissions/sub-123/reject', style: 'danger' as const }
        ],
        scheduled_for: undefined,
        sent_at: new Date().toISOString(),
        expires_at: undefined
      };

      const result = await repository.create(newNotification);

      expect(result).toBeDefined();
      expect(mockNotifications.insert).toHaveBeenCalled();
    });

    it('should create notification with expiration', async () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
      const newNotification = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Limited Time Offer',
        message: 'This offer expires soon',
        type: 'info' as const,
        target_type: 'customer' as const,
        channel: 'push' as const,
        priority: 'normal' as const,
        is_read: false,
        read_at: null,
        data: null,
        actions: undefined,
        scheduled_for: undefined,
        sent_at: new Date().toISOString(),
        expires_at: expiresAt
      };

      const result = await repository.create(newNotification);

      expect(result).toBeDefined();
      expect(mockNotifications.insert).toHaveBeenCalled();
    });

    it('should create scheduled notification', async () => {
      const scheduledFor = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const newNotification = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Scheduled Reminder',
        message: 'This is your scheduled reminder',
        type: 'info' as const,
        target_type: 'user' as const,
        channel: 'in_app' as const,
        priority: 'normal' as const,
        is_read: false,
        read_at: null,
        data: null,
        actions: undefined,
        scheduled_for: scheduledFor,
        sent_at: undefined,
        expires_at: undefined
      };

      const result = await repository.create(newNotification);

      expect(result).toBeDefined();
      expect(mockNotifications.insert).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should get notification by ID', async () => {
      mockNotifications = createQueryMock(() => [mockNotification]);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getById('notif-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockNotifications.select).toHaveBeenCalledWith('*');
      expect(mockNotifications.eq).toHaveBeenCalledWith('id', 'notif-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('notif-1');
    });

    it('should return null for non-existent notification', async () => {
      mockNotifications = createQueryMock(() => []);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByUserId', () => {
    it('should get notifications for user', async () => {
      mockNotifications = createQueryMock(() => [mockNotification, mockUnreadNotification]);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getByUserId('550e8400-e29b-41d4-a716-446655440000');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockNotifications.eq).toHaveBeenCalledWith('user_id', '550e8400-e29b-41d4-a716-446655440000');
      expect(mockNotifications.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(results).toHaveLength(2);
    });

    it('should filter by type', async () => {
      mockNotifications = createQueryMock(() => [mockNotification]);
      repository = createSupabaseNotificationRepository();

      await repository.getByUserId('550e8400-e29b-41d4-a716-446655440000', { type: 'success' });

      expect(mockNotifications.eq).toHaveBeenCalledWith('type', 'success');
    });

    it('should filter by read status', async () => {
      mockNotifications = createQueryMock(() => [mockUnreadNotification]);
      repository = createSupabaseNotificationRepository();

      await repository.getByUserId('550e8400-e29b-41d4-a716-446655440000', { isRead: false });

      expect(mockNotifications.eq).toHaveBeenCalledWith('is_read', false);
    });

    it('should filter by channel', async () => {
      mockNotifications = createQueryMock(() => [mockNotification]);
      repository = createSupabaseNotificationRepository();

      await repository.getByUserId('550e8400-e29b-41d4-a716-446655440000', { channel: 'in_app' });

      expect(mockNotifications.eq).toHaveBeenCalledWith('channel', 'in_app');
    });

    it('should apply multiple filters', async () => {
      mockNotifications = createQueryMock(() => [mockUnreadNotification]);
      repository = createSupabaseNotificationRepository();

      await repository.getByUserId('550e8400-e29b-41d4-a716-446655440000', {
        type: 'warning',
        isRead: false,
        channel: 'in_app'
      });

      expect(mockNotifications.eq).toHaveBeenCalledWith('type', 'warning');
      expect(mockNotifications.eq).toHaveBeenCalledWith('is_read', false);
      expect(mockNotifications.eq).toHaveBeenCalledWith('channel', 'in_app');
    });
  });

  describe('getAll', () => {
    it('should get all notifications with pagination', async () => {
      mockNotifications = createQueryMock(() => [mockNotification, mockUnreadNotification]);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getAll(undefined, { limit: 10, offset: 0 });

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockNotifications.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockNotifications.range).toHaveBeenCalledWith(0, 9);
      expect(result.notifications).toBeDefined();
    });

    it('should filter by user ID', async () => {
      mockNotifications = createQueryMock(() => [mockNotification]);
      repository = createSupabaseNotificationRepository();

      await repository.getAll({ userId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(mockNotifications.eq).toHaveBeenCalledWith('user_id', '550e8400-e29b-41d4-a716-446655440000');
    });

    it('should filter by target type', async () => {
      mockNotifications = createQueryMock(() => [mockUnreadNotification]);
      repository = createSupabaseNotificationRepository();

      await repository.getAll({ targetType: 'staff' });

      expect(mockNotifications.eq).toHaveBeenCalledWith('target_type', 'staff');
    });

    it('should handle pagination with offset', async () => {
      mockNotifications = createQueryMock(() => [mockNotification]);
      repository = createSupabaseNotificationRepository();

      await repository.getAll(undefined, { limit: 5, offset: 10 });

      expect(mockNotifications.range).toHaveBeenCalledWith(10, 14);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockNotification, is_read: true, read_at: new Date().toISOString() },
          error: null
        })
      });

      mockNotifications.update = vi.fn().mockReturnValue(updateChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.markAsRead('notif-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockNotifications.update).toHaveBeenCalled();
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'notif-1');
      expect(result).toBeDefined();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockResolvedValue({
        data: [{ id: 'notif-1' }, { id: 'notif-2' }],
        error: null
      });

      mockNotifications.update = vi.fn().mockReturnValue(updateChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.markAllAsRead('550e8400-e29b-41d4-a716-446655440000');

      expect(mockNotifications.update).toHaveBeenCalled();
      expect(updateChain.eq).toHaveBeenCalledWith('user_id', '550e8400-e29b-41d4-a716-446655440000');
      expect(updateChain.eq).toHaveBeenCalledWith('is_read', false);
      expect(result).toBe(2);
    });

    it('should return 0 when no unread notifications', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });

      mockNotifications.update = vi.fn().mockReturnValue(updateChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.markAllAsRead('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete notification by ID', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.then = (resolve: (value: { error: unknown }) => void) => {
        resolve({ error: null });
        return Promise.resolve({ error: null });
      };

      mockNotifications.delete = vi.fn().mockReturnValue(deleteChain);
      repository = createSupabaseNotificationRepository();

      await repository.delete('notif-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockNotifications.delete).toHaveBeenCalled();
      expect(deleteChain.eq).toHaveBeenCalledWith('id', 'notif-1');
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired notifications', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.select = vi.fn().mockResolvedValue({
        data: [{ id: 'expired-1' }, { id: 'expired-2' }],
        error: null
      });

      mockNotifications.delete = vi.fn().mockReturnValue(deleteChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.deleteExpired();

      expect(mockNotifications.delete).toHaveBeenCalled();
      expect(deleteChain.lt).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('should return 0 when no expired notifications', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.select = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });

      mockNotifications.delete = vi.fn().mockReturnValue(deleteChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.deleteExpired();

      expect(result).toBe(0);
    });
  });

  describe('deleteMultiple', () => {
    it('should delete multiple notifications by IDs', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.select = vi.fn().mockResolvedValue({
        data: [{ id: 'notif-1' }, { id: 'notif-2' }, { id: 'notif-3' }],
        error: null
      });

      mockNotifications.delete = vi.fn().mockReturnValue(deleteChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.deleteMultiple(['notif-1', 'notif-2', 'notif-3']);

      expect(mockNotifications.delete).toHaveBeenCalled();
      expect(deleteChain.in).toHaveBeenCalledWith('id', ['notif-1', 'notif-2', 'notif-3']);
      expect(result).toBe(3);
    });
  });

  // =============================================
  // BROADCAST TESTS
  // =============================================

  describe('createBroadcast', () => {
    it('should create a broadcast notification', async () => {
      const newBroadcast = {
        title: 'Announcement',
        message: 'Important announcement for all users',
        type: 'info' as const,
        target_type: 'all' as const,
        priority: 'normal' as const,
        target_user_ids: [],
        actions: undefined,
        scheduled_for: undefined,
        sent_at: new Date().toISOString(),
        delivery_count: 0,
        read_count: 0,
        created_by: '550e8400-e29b-41d4-a716-446655440001'
      };

      const result = await repository.createBroadcast(newBroadcast);

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_broadcasts');
      expect(mockBroadcasts.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create broadcast with target user IDs', async () => {
      const newBroadcast = {
        title: 'VIP Offer',
        message: 'Special offer for VIP guests',
        type: 'success' as const,
        target_type: 'customer' as const,
        priority: 'high' as const,
        target_user_ids: ['user-1', 'user-2', 'user-3'],
        actions: [{ label: 'Claim Offer', url: '/offers/vip', style: 'primary' as const }],
        scheduled_for: undefined,
        sent_at: new Date().toISOString(),
        delivery_count: 0,
        read_count: 0,
        created_by: '550e8400-e29b-41d4-a716-446655440001'
      };

      const result = await repository.createBroadcast(newBroadcast);

      expect(result).toBeDefined();
      expect(mockBroadcasts.insert).toHaveBeenCalled();
    });

    it('should create scheduled broadcast', async () => {
      const scheduledFor = new Date(Date.now() + 86400000).toISOString();
      const newBroadcast = {
        title: 'Upcoming Event',
        message: 'Join us tomorrow for a special event',
        type: 'info' as const,
        target_type: 'all' as const,
        priority: 'normal' as const,
        target_user_ids: [],
        actions: undefined,
        scheduled_for: scheduledFor,
        sent_at: undefined,
        delivery_count: 0,
        read_count: 0,
        created_by: '550e8400-e29b-41d4-a716-446655440001'
      };

      const result = await repository.createBroadcast(newBroadcast);

      expect(result).toBeDefined();
      expect(mockBroadcasts.insert).toHaveBeenCalled();
    });
  });

  describe('getBroadcasts', () => {
    it('should get all broadcasts', async () => {
      mockBroadcasts = createQueryMock(() => [mockBroadcast, mockScheduledBroadcast]);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getBroadcasts();

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_broadcasts');
      expect(mockBroadcasts.select).toHaveBeenCalledWith('*');
      expect(mockBroadcasts.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(results).toHaveLength(2);
    });

    it('should filter broadcasts by target type', async () => {
      mockBroadcasts = createQueryMock(() => [mockScheduledBroadcast]);
      repository = createSupabaseNotificationRepository();

      await repository.getBroadcasts('customer');

      expect(mockBroadcasts.or).toHaveBeenCalledWith('target_type.eq.customer,target_type.eq.all');
    });

    it('should filter broadcasts for admin target type', async () => {
      mockBroadcasts = createQueryMock(() => []);
      repository = createSupabaseNotificationRepository();

      await repository.getBroadcasts('admin');

      expect(mockBroadcasts.or).toHaveBeenCalledWith('target_type.eq.admin,target_type.eq.all');
    });
  });

  describe('getBroadcastById', () => {
    it('should get broadcast by ID', async () => {
      mockBroadcasts = createQueryMock(() => [mockBroadcast]);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getBroadcastById('broadcast-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_broadcasts');
      expect(mockBroadcasts.eq).toHaveBeenCalledWith('id', 'broadcast-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('broadcast-1');
    });

    it('should return null for non-existent broadcast', async () => {
      mockBroadcasts = createQueryMock(() => []);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getBroadcastById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateBroadcast', () => {
    it('should update broadcast', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockBroadcast, delivery_count: 200, read_count: 100 },
          error: null
        })
      });

      mockBroadcasts.update = vi.fn().mockReturnValue(updateChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.updateBroadcast('broadcast-1', {
        delivery_count: 200,
        read_count: 100
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_broadcasts');
      expect(mockBroadcasts.update).toHaveBeenCalled();
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'broadcast-1');
      expect(result).toBeDefined();
    });
  });

  describe('getScheduledNotifications', () => {
    it('should get scheduled notifications ready to send', async () => {
      const scheduledNotification = {
        ...mockNotification,
        scheduled_for: '2024-01-01T10:00:00Z',
        sent_at: null
      };
      mockNotifications = createQueryMock(() => [scheduledNotification]);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getScheduledNotifications();

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockNotifications.lte).toHaveBeenCalled();
      expect(mockNotifications.is).toHaveBeenCalledWith('sent_at', null);
      expect(results).toBeDefined();
    });
  });

  describe('getScheduledBroadcasts', () => {
    it('should get scheduled broadcasts ready to send', async () => {
      mockBroadcasts = createQueryMock(() => [mockScheduledBroadcast]);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getScheduledBroadcasts();

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_broadcasts');
      expect(mockBroadcasts.lte).toHaveBeenCalled();
      expect(mockBroadcasts.is).toHaveBeenCalledWith('sent_at', null);
      expect(results).toBeDefined();
    });
  });

  // =============================================
  // TEMPLATE TESTS
  // =============================================

  describe('createTemplate', () => {
    it('should create a notification template', async () => {
      const newTemplate = {
        name: 'Booking Confirmation',
        title: 'Booking #{{bookingId}} Confirmed',
        message: 'Your booking has been confirmed for {{date}}',
        type: 'success' as const,
        target_type: 'customer' as const,
        priority: 'normal' as const,
        actions: [{ label: 'View Booking', url: '/bookings/{{bookingId}}', style: 'primary' as const }],
        variables: ['bookingId', 'date'],
        is_active: true
      };

      const result = await repository.createTemplate(newTemplate);

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockTemplates.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create template with all notification types', async () => {
      const types: Array<'info' | 'warning' | 'error' | 'success'> = ['info', 'warning', 'error', 'success'];
      
      for (const type of types) {
        const newTemplate = {
          name: `Template ${type}`,
          title: `${type} Template`,
          message: `This is a ${type} template`,
          type,
          target_type: 'all' as const,
          priority: 'normal' as const,
          actions: undefined,
          variables: [],
          is_active: true
        };

        const result = await repository.createTemplate(newTemplate);
        expect(result).toBeDefined();
      }
    });

    it('should create template with all priority levels', async () => {
      const priorities: Array<'low' | 'normal' | 'high' | 'urgent'> = ['low', 'normal', 'high', 'urgent'];
      
      for (const priority of priorities) {
        const newTemplate = {
          name: `Template ${priority}`,
          title: `${priority} Priority`,
          message: `This has ${priority} priority`,
          type: 'info' as const,
          target_type: 'all' as const,
          priority,
          actions: undefined,
          variables: [],
          is_active: true
        };

        const result = await repository.createTemplate(newTemplate);
        expect(result).toBeDefined();
      }
    });
  });

  describe('getTemplates', () => {
    it('should get active templates only by default', async () => {
      mockTemplates = createQueryMock(() => [mockTemplate]);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getTemplates();

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockTemplates.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockTemplates.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(results).toHaveLength(1);
    });

    it('should get all templates including inactive', async () => {
      mockTemplates = createQueryMock(() => [mockTemplate, mockInactiveTemplate]);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getTemplates(false);

      expect(mockTemplates.eq).not.toHaveBeenCalledWith('is_active', true);
      expect(results).toHaveLength(2);
    });
  });

  describe('getTemplateById', () => {
    it('should get template by ID', async () => {
      mockTemplates = createQueryMock(() => [mockTemplate]);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getTemplateById('template-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockTemplates.eq).toHaveBeenCalledWith('id', 'template-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('template-1');
    });

    it('should return null for non-existent template', async () => {
      mockTemplates = createQueryMock(() => []);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getTemplateById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateTemplate', () => {
    it('should update template', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockTemplate, title: 'Updated Title', updated_at: new Date().toISOString() },
          error: null
        })
      });

      mockTemplates.update = vi.fn().mockReturnValue(updateChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.updateTemplate('template-1', { title: 'Updated Title' });

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockTemplates.update).toHaveBeenCalled();
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'template-1');
      expect(result).toBeDefined();
    });

    it('should deactivate template', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockTemplate, is_active: false },
          error: null
        })
      });

      mockTemplates.update = vi.fn().mockReturnValue(updateChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.updateTemplate('template-1', { is_active: false });

      expect(mockTemplates.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should update template variables', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockTemplate, variables: ['newVar1', 'newVar2'] },
          error: null
        })
      });

      mockTemplates.update = vi.fn().mockReturnValue(updateChain);
      repository = createSupabaseNotificationRepository();

      const result = await repository.updateTemplate('template-1', {
        variables: ['newVar1', 'newVar2']
      });

      expect(result).toBeDefined();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template by ID', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.then = (resolve: (value: { error: unknown }) => void) => {
        resolve({ error: null });
        return Promise.resolve({ error: null });
      };

      mockTemplates.delete = vi.fn().mockReturnValue(deleteChain);
      repository = createSupabaseNotificationRepository();

      await repository.deleteTemplate('template-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      expect(mockTemplates.delete).toHaveBeenCalled();
      expect(deleteChain.eq).toHaveBeenCalledWith('id', 'template-1');
    });
  });

  // =============================================
  // EDGE CASES AND ERROR SCENARIOS
  // =============================================

  describe('edge cases', () => {
    it('should handle empty notification list', async () => {
      mockNotifications = createQueryMock(() => []);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getByUserId('550e8400-e29b-41d4-a716-446655440000');

      expect(results).toEqual([]);
    });

    it('should handle empty broadcast list', async () => {
      mockBroadcasts = createQueryMock(() => []);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getBroadcasts();

      expect(results).toEqual([]);
    });

    it('should handle empty template list', async () => {
      mockTemplates = createQueryMock(() => []);
      repository = createSupabaseNotificationRepository();

      const results = await repository.getTemplates();

      expect(results).toEqual([]);
    });

    it('should handle getAll with no filters and no pagination', async () => {
      mockNotifications = createQueryMock(() => [mockNotification, mockUnreadNotification]);
      repository = createSupabaseNotificationRepository();

      const result = await repository.getAll();

      expect(result.notifications).toBeDefined();
      expect(mockNotifications.range).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // TARGET TYPE TESTS
  // =============================================

  describe('target types', () => {
    it('should create notification for all target types', async () => {
      const targetTypes: Array<'all' | 'admin' | 'staff' | 'user' | 'customer'> = ['all', 'admin', 'staff', 'user', 'customer'];
      
      for (const targetType of targetTypes) {
        const notification = {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          title: `Notification for ${targetType}`,
          message: `This notification is for ${targetType}`,
          type: 'info' as const,
          target_type: targetType,
          channel: 'in_app' as const,
          priority: 'normal' as const,
          is_read: false,
          read_at: null,
          data: null,
          actions: undefined,
          scheduled_for: undefined,
          sent_at: new Date().toISOString(),
          expires_at: undefined
        };

        const result = await repository.create(notification);
        expect(result).toBeDefined();
      }
    });
  });

  // =============================================
  // CHANNEL TESTS
  // =============================================

  describe('channels', () => {
    it('should create notification for all channels', async () => {
      const channels: Array<'in_app' | 'email' | 'sms' | 'push'> = ['in_app', 'email', 'sms', 'push'];
      
      for (const channel of channels) {
        const notification = {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          title: `Notification via ${channel}`,
          message: `Sent via ${channel}`,
          type: 'info' as const,
          target_type: 'user' as const,
          channel,
          priority: 'normal' as const,
          is_read: false,
          read_at: null,
          data: null,
          actions: undefined,
          scheduled_for: undefined,
          sent_at: new Date().toISOString(),
          expires_at: undefined
        };

        const result = await repository.create(notification);
        expect(result).toBeDefined();
      }
    });
  });
});
