/**
 * Device Service Unit Tests
 * 
 * Tests for device registration and push notification management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase connection
vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { getSupabase } from '../../../../src/database/connection.js';
import {
  findDeviceByToken,
  registerDeviceToken,
  updateDeviceToken,
  unregisterDeviceToken,
  getUserDevices,
  updateDevicePreferences,
  removeDevice,
  logoutAllDevices,
  getActiveDeviceTokens,
  getBulkActiveDeviceTokens,
  cleanupStaleDevices,
} from '../../../../src/modules/devices/devices.service.js';

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
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
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.select = vi.fn().mockReturnValue({
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      const data = mockDataFn();
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    }
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

describe('DevicesService', () => {
  const mockUserId = 'user-123';
  const mockDeviceId = 'device-456';
  const mockDeviceToken = 'fcm-token-abc123';

  const mockDevice = {
    id: mockDeviceId,
    user_id: mockUserId,
    device_token: mockDeviceToken,
    platform: 'ios' as const,
    device_name: 'iPhone 15',
    device_model: 'iPhone15,2',
    app_version: '1.0.0',
    os_version: '17.0',
    notifications_enabled: true,
    is_active: true,
    last_used_at: '2024-01-15T10:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findDeviceByToken', () => {
    it('should find device by token successfully', async () => {
      const mockQuery = createQueryMock(() => [{ id: mockDeviceId, user_id: mockUserId }]);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await findDeviceByToken(mockDeviceToken);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: mockDeviceId, user_id: mockUserId });
    });

    it('should return null when device token not found', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await findDeviceByToken('nonexistent-token');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle database error', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Database error' },
      });
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await findDeviceByToken(mockDeviceToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should ignore PGRST116 error (no rows)', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await findDeviceByToken(mockDeviceToken);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('registerDeviceToken', () => {
    it('should register new device successfully', async () => {
      const insertedDevice = {
        id: 'new-device-1',
        platform: 'ios',
        notifications_enabled: true,
        created_at: '2024-01-15T10:00:00Z',
        last_used_at: '2024-01-15T10:00:00Z',
      };

      const mockQuery = createQueryMock(() => [insertedDevice]);
      mockQuery.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertedDevice, error: null }),
        }),
      });
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await registerDeviceToken(mockUserId, {
        deviceToken: mockDeviceToken,
        platform: 'ios',
        deviceName: 'iPhone 15',
        appVersion: '1.0.0',
        deviceModel: 'iPhone15,2',
        osVersion: '17.0',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(insertedDevice);
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: mockUserId,
        device_token: mockDeviceToken,
        platform: 'ios',
        device_name: 'iPhone 15',
        is_active: true,
      }));
    });

    it('should register device with default notifications enabled', async () => {
      const insertedDevice = {
        id: 'new-device-1',
        platform: 'android',
        notifications_enabled: true,
        created_at: '2024-01-15T10:00:00Z',
        last_used_at: '2024-01-15T10:00:00Z',
      };

      const mockQuery = createQueryMock(() => [insertedDevice]);
      mockQuery.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertedDevice, error: null }),
        }),
      });
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await registerDeviceToken(mockUserId, {
        deviceToken: 'android-token',
        platform: 'android',
      });

      expect(result.success).toBe(true);
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        notifications_enabled: true,
      }));
    });

    it('should handle insert error', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'INSERT_ERROR', message: 'Insert failed' },
          }),
        }),
      });
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await registerDeviceToken(mockUserId, {
        deviceToken: mockDeviceToken,
        platform: 'ios',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to register device');
    });

    it('should register web platform device', async () => {
      const insertedDevice = {
        id: 'new-web-device',
        platform: 'web',
        notifications_enabled: true,
        created_at: '2024-01-15T10:00:00Z',
        last_used_at: '2024-01-15T10:00:00Z',
      };

      const mockQuery = createQueryMock(() => [insertedDevice]);
      mockQuery.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertedDevice, error: null }),
        }),
      });
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await registerDeviceToken(mockUserId, {
        deviceToken: 'web-push-token',
        platform: 'web',
        notificationsEnabled: false,
      });

      expect(result.success).toBe(true);
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'web',
        notifications_enabled: false,
      }));
    });
  });

  describe('updateDeviceToken', () => {
    it('should update device token successfully', async () => {
      const updatedDevice = {
        id: mockDeviceId,
        platform: 'ios',
        notifications_enabled: true,
        created_at: '2024-01-01T00:00:00Z',
        last_used_at: '2024-01-15T12:00:00Z',
      };

      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: updatedDevice, error: null }),
      });

      const mockQuery = createQueryMock(() => [updatedDevice]);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await updateDeviceToken(mockDeviceId, mockUserId, {
        platform: 'ios',
        deviceName: 'Updated iPhone',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedDevice);
    });

    it('should handle update error', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'UPDATE_ERROR', message: 'Update failed' },
        }),
      });

      const mockQuery = createQueryMock(() => []);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await updateDeviceToken(mockDeviceId, mockUserId, {
        platform: 'android',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update device registration');
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should soft delete device successfully', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: mockDeviceId }, error: null }),
      });

      const mockQuery = createQueryMock(() => [{ id: mockDeviceId }]);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await unregisterDeviceToken(mockUserId, mockDeviceToken);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: mockDeviceId });
    });

    it('should return null when device not found', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const mockQuery = createQueryMock(() => []);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await unregisterDeviceToken(mockUserId, 'nonexistent-token');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle unregister error', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'UPDATE_ERROR', message: 'Update failed' },
        }),
      });

      const mockQuery = createQueryMock(() => []);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await unregisterDeviceToken(mockUserId, mockDeviceToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to unregister device');
    });
  });

  describe('getUserDevices', () => {
    it('should return all active devices for user', async () => {
      const devices = [
        { ...mockDevice, id: 'device-1' },
        { ...mockDevice, id: 'device-2', platform: 'android' },
      ];

      const mockQuery = createQueryMock(() => devices);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getUserDevices(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockQuery.order).toHaveBeenCalledWith('last_used_at', { ascending: false });
    });

    it('should return empty array when user has no devices', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getUserDevices(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle fetch error', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
        resolve({ data: null, error: { code: 'FETCH_ERROR', message: 'Fetch failed' } });
        return Promise.resolve({ data: null, error: { code: 'FETCH_ERROR' } });
      };
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getUserDevices(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch devices');
    });
  });

  describe('updateDevicePreferences', () => {
    it('should update notifications preference', async () => {
      const updatedDevice = {
        id: mockDeviceId,
        platform: 'ios',
        device_name: 'iPhone 15',
        notifications_enabled: false,
      };

      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: updatedDevice, error: null }),
      });

      const mockQuery = createQueryMock(() => [updatedDevice]);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await updateDevicePreferences(mockDeviceId, mockUserId, {
        notificationsEnabled: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedDevice);
    });

    it('should update device name', async () => {
      const updatedDevice = {
        id: mockDeviceId,
        platform: 'ios',
        device_name: 'My Work Phone',
        notifications_enabled: true,
      };

      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: updatedDevice, error: null }),
      });

      const mockQuery = createQueryMock(() => [updatedDevice]);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await updateDevicePreferences(mockDeviceId, mockUserId, {
        deviceName: 'My Work Phone',
      });

      expect(result.success).toBe(true);
      expect(result.data?.device_name).toBe('My Work Phone');
    });

    it('should update both preferences at once', async () => {
      const updatedDevice = {
        id: mockDeviceId,
        platform: 'android',
        device_name: 'New Name',
        notifications_enabled: true,
      };

      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: updatedDevice, error: null }),
      });

      const mockQuery = createQueryMock(() => [updatedDevice]);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await updateDevicePreferences(mockDeviceId, mockUserId, {
        notificationsEnabled: true,
        deviceName: 'New Name',
      });

      expect(result.success).toBe(true);
    });

    it('should handle update error', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.select = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'UPDATE_ERROR', message: 'Update failed' },
        }),
      });

      const mockQuery = createQueryMock(() => []);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await updateDevicePreferences(mockDeviceId, mockUserId, {
        notificationsEnabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update device preferences');
    });
  });

  describe('removeDevice', () => {
    it('should hard delete device successfully', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      };

      const mockQuery = createQueryMock(() => []);
      mockQuery.delete = vi.fn().mockReturnValue(deleteChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await removeDevice(mockDeviceId, mockUserId);

      expect(result.success).toBe(true);
      expect(mockQuery.delete).toHaveBeenCalled();
    });

    it('should handle delete error', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: { code: 'DELETE_ERROR', message: 'Delete failed' } });
        return Promise.resolve({ data: null, error: { code: 'DELETE_ERROR' } });
      };

      const mockQuery = createQueryMock(() => []);
      mockQuery.delete = vi.fn().mockReturnValue(deleteChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await removeDevice(mockDeviceId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to remove device');
    });
  });

  describe('logoutAllDevices', () => {
    it('should mark all devices as inactive', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      };

      const mockQuery = createQueryMock(() => []);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await logoutAllDevices(mockUserId);

      expect(result.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledWith({ is_active: false });
    });

    it('should exclude current device when specified', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      };

      const mockQuery = createQueryMock(() => []);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await logoutAllDevices(mockUserId, { exceptToken: 'current-device-token' });

      expect(result.success).toBe(true);
      expect(updateChain.neq).toHaveBeenCalledWith('device_token', 'current-device-token');
    });

    it('should handle logout error', async () => {
      const updateChain: Record<string, unknown> = {};
      ['eq', 'neq'].forEach(method => {
        updateChain[method] = vi.fn().mockReturnValue(updateChain);
      });
      updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: { code: 'UPDATE_ERROR', message: 'Update failed' } });
        return Promise.resolve({ data: null, error: { code: 'UPDATE_ERROR' } });
      };

      const mockQuery = createQueryMock(() => []);
      mockQuery.update = vi.fn().mockReturnValue(updateChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await logoutAllDevices(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to logout from all devices');
    });
  });

  describe('getActiveDeviceTokens', () => {
    it('should return all active tokens for user', async () => {
      const tokens = [
        { device_token: 'token-1', platform: 'ios' },
        { device_token: 'token-2', platform: 'android' },
      ];

      const mockQuery = createQueryMock(() => tokens);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getActiveDeviceTokens(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockQuery.eq).toHaveBeenCalledWith('notifications_enabled', true);
    });

    it('should filter by platform when specified', async () => {
      const tokens = [{ device_token: 'ios-token', platform: 'ios' }];

      const mockQuery = createQueryMock(() => tokens);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getActiveDeviceTokens(mockUserId, 'ios');

      expect(result.success).toBe(true);
      expect(mockQuery.eq).toHaveBeenCalledWith('platform', 'ios');
    });

    it('should return empty array when no tokens found', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getActiveDeviceTokens(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle fetch error', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
        resolve({ data: null, error: { code: 'FETCH_ERROR', message: 'Fetch failed' } });
        return Promise.resolve({ data: null, error: { code: 'FETCH_ERROR' } });
      };
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getActiveDeviceTokens(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch device tokens');
    });
  });

  describe('getBulkActiveDeviceTokens', () => {
    it('should return tokens for multiple users', async () => {
      const tokens = [
        { user_id: 'user-1', device_token: 'token-1', platform: 'ios' },
        { user_id: 'user-2', device_token: 'token-2', platform: 'android' },
        { user_id: 'user-1', device_token: 'token-3', platform: 'web' },
      ];

      const mockQuery = createQueryMock(() => tokens);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getBulkActiveDeviceTokens(['user-1', 'user-2']);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(mockQuery.in).toHaveBeenCalledWith('user_id', ['user-1', 'user-2']);
    });

    it('should return empty array for empty user list', async () => {
      const result = await getBulkActiveDeviceTokens([]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should filter by platform when specified', async () => {
      const tokens = [
        { user_id: 'user-1', device_token: 'token-1', platform: 'ios' },
      ];

      const mockQuery = createQueryMock(() => tokens);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getBulkActiveDeviceTokens(['user-1', 'user-2'], 'ios');

      expect(result.success).toBe(true);
      expect(mockQuery.eq).toHaveBeenCalledWith('platform', 'ios');
    });

    it('should handle fetch error', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
        resolve({ data: null, error: { code: 'FETCH_ERROR', message: 'Fetch failed' } });
        return Promise.resolve({ data: null, error: { code: 'FETCH_ERROR' } });
      };
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await getBulkActiveDeviceTokens(['user-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch device tokens');
    });
  });

  describe('cleanupStaleDevices', () => {
    it('should delete inactive stale devices', async () => {
      const deletedDevices = [{ id: 'stale-1' }, { id: 'stale-2' }, { id: 'stale-3' }];

      const deleteChain: Record<string, unknown> = {};
      ['eq', 'lt', 'lte', 'gt', 'gte'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.select = vi.fn().mockReturnValue({
        then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
          resolve({ data: deletedDevices, error: null });
          return Promise.resolve({ data: deletedDevices, error: null });
        },
      });

      const mockQuery = createQueryMock(() => deletedDevices);
      mockQuery.delete = vi.fn().mockReturnValue(deleteChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await cleanupStaleDevices(90);

      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
      expect(mockQuery.delete).toHaveBeenCalled();
      expect(deleteChain.eq).toHaveBeenCalledWith('is_active', false);
    });

    it('should use default 90 days when not specified', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'lt', 'lte', 'gt', 'gte'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.select = vi.fn().mockReturnValue({
        then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
          resolve({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        },
      });

      const mockQuery = createQueryMock(() => []);
      mockQuery.delete = vi.fn().mockReturnValue(deleteChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await cleanupStaleDevices();

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
      expect(deleteChain.lt).toHaveBeenCalled();
    });

    it('should return 0 when no stale devices found', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'lt', 'lte', 'gt', 'gte'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.select = vi.fn().mockReturnValue({
        then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
          resolve({ data: null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
      });

      const mockQuery = createQueryMock(() => []);
      mockQuery.delete = vi.fn().mockReturnValue(deleteChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await cleanupStaleDevices(30);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should handle cleanup error', async () => {
      const deleteChain: Record<string, unknown> = {};
      ['eq', 'lt', 'lte', 'gt', 'gte'].forEach(method => {
        deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
      });
      deleteChain.select = vi.fn().mockReturnValue({
        then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
          resolve({ data: null, error: { code: 'DELETE_ERROR', message: 'Delete failed' } });
          return Promise.resolve({ data: null, error: { code: 'DELETE_ERROR' } });
        },
      });

      const mockQuery = createQueryMock(() => []);
      mockQuery.delete = vi.fn().mockReturnValue(deleteChain);
      vi.mocked(getSupabase).mockReturnValue({ from: () => mockQuery } as never);

      const result = await cleanupStaleDevices(90);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to cleanup stale devices');
    });
  });

  describe('error handling', () => {
    it('should handle thrown exceptions in findDeviceByToken', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await findDeviceByToken(mockDeviceToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in registerDeviceToken', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await registerDeviceToken(mockUserId, {
        deviceToken: mockDeviceToken,
        platform: 'ios',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in getUserDevices', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await getUserDevices(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in updateDevicePreferences', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await updateDevicePreferences(mockDeviceId, mockUserId, {
        notificationsEnabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in removeDevice', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await removeDevice(mockDeviceId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in logoutAllDevices', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await logoutAllDevices(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in getActiveDeviceTokens', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await getActiveDeviceTokens(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in getBulkActiveDeviceTokens', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await getBulkActiveDeviceTokens(['user-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in cleanupStaleDevices', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await cleanupStaleDevices();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in updateDeviceToken', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await updateDeviceToken(mockDeviceId, mockUserId, {
        platform: 'ios',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('should handle thrown exceptions in unregisterDeviceToken', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await unregisterDeviceToken(mockUserId, mockDeviceToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });
  });
});
