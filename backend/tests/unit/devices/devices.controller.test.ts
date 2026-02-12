import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import * as devicesController from '../../../src/modules/devices/devices.controller';
import { getSupabase } from '../../../src/database/connection.js';

describe('Devices Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerDevice', () => {
    it('should register a new device token', async () => {
      const mockDevice = {
        id: 'device-1',
        platform: 'ios',
        notifications_enabled: true,
        created_at: '2024-01-01',
        last_used_at: '2024-01-01'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockDevice, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        body: {
          deviceToken: 'token-abc123',
          platform: 'ios',
          deviceName: 'iPhone 15',
          appVersion: '1.0.0'
        },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await devicesController.registerDevice(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('device_tokens');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Device registered successfully',
        device: mockDevice
      });
    });

    it('should update existing device token', async () => {
      const existingToken = { id: 'device-1', user_id: 'user-1' };
      const updatedDevice = {
        id: 'device-1',
        platform: 'ios',
        notifications_enabled: true,
        created_at: '2024-01-01',
        last_used_at: '2024-01-02'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingToken, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedDevice, error: null })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        body: {
          deviceToken: 'token-abc123',
          platform: 'ios'
        },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await devicesController.registerDevice(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Device updated successfully',
        device: updatedDevice
      });
    });

    it('should return 401 if not authenticated', async () => {
      const { req, res } = createMockReqRes({
        body: { deviceToken: 'token-abc123', platform: 'ios' }
      });
      req.user = undefined;

      await devicesController.registerDevice(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should return 400 for missing device token', async () => {
      const { req, res } = createMockReqRes({
        body: { platform: 'ios' },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await devicesController.registerDevice(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Device token is required' });
    });

    it('should return 400 for invalid platform', async () => {
      const { req, res } = createMockReqRes({
        body: { deviceToken: 'token-abc', platform: 'blackberry' },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await devicesController.registerDevice(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid platform. Must be ios, android, or web' });
    });
  });

  describe('unregisterDevice', () => {
    it('should unregister a device', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'device-1' }, error: null })
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        body: { deviceToken: 'token-abc123' },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await devicesController.unregisterDevice(req, res);

      expect(res.json).toHaveBeenCalledWith({ message: 'Device unregistered successfully' });
    });
  });

  describe('getUserDevices', () => {
    it('should return user devices', async () => {
      const mockDevices = [
        { id: 'device-1', platform: 'ios', device_name: 'iPhone' },
        { id: 'device-2', platform: 'android', device_name: 'Pixel' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockDevices, error: null })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await devicesController.getUserDevices(req, res);

      expect(res.json).toHaveBeenCalledWith({
        devices: mockDevices,
        count: 2
      });
    });
  });

  describe('updateDevicePreferences', () => {
    it('should update device preferences', async () => {
      const mockUpdatedDevice = {
        id: 'device-1',
        platform: 'ios',
        device_name: 'My iPhone',
        notifications_enabled: false
      };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockUpdatedDevice, error: null })
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        params: { deviceId: 'device-1' },
        body: { notificationsEnabled: false },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await devicesController.updateDevicePreferences(req, res);

      expect(res.json).toHaveBeenCalledWith({ 
        message: 'Device preferences updated',
        device: mockUpdatedDevice
      });
    });
  });
});
