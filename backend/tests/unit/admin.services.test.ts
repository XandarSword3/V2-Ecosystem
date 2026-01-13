/**
 * Admin Services Unit Tests
 * Tests for dashboard, settings, role, and user services
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainableMock } from './utils.js';

// Mock dependencies
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/socket/index.js', () => ({
  emitToAll: vi.fn(),
}));

import { getSupabase } from '../../src/database/connection.js';

describe('SettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllSettings', () => {
    it('should return all settings as a map', async () => {
      const mockSettings = [
        { key: 'site_name', value: 'V2 Resort' },
        { key: 'contact_email', value: 'info@v2resort.com' }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockSettings))
      } as any);

      const { SettingsService } = await import('../../src/modules/admin/services/settings.service.js');
      const service = new SettingsService();
      
      const result = await service.getAllSettings();
      
      expect(result).toEqual({
        site_name: 'V2 Resort',
        contact_email: 'info@v2resort.com'
      });
    });

    it('should throw on database error', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, new Error('DB Error')))
      } as any);

      const { SettingsService } = await import('../../src/modules/admin/services/settings.service.js');
      const service = new SettingsService();
      
      await expect(service.getAllSettings()).rejects.toThrow();
    });
  });

  describe('getSettingsByCategory', () => {
    it('should return settings for a specific category', async () => {
      const mockSettings = [
        { key: 'currency', value: 'USD' }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockSettings))
      } as any);

      const { SettingsService } = await import('../../src/modules/admin/services/settings.service.js');
      const service = new SettingsService();
      
      const result = await service.getSettingsByCategory('payment');
      
      expect(result).toEqual({ currency: 'USD' });
    });
  });

  describe('getSetting', () => {
    it('should return a single setting value', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ value: 'My Resort' }))
      } as any);

      const { SettingsService } = await import('../../src/modules/admin/services/settings.service.js');
      const service = new SettingsService();
      
      const result = await service.getSetting('site_name');
      
      expect(result).toBe('My Resort');
    });

    it('should return undefined for missing setting', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null))
      } as any);

      const { SettingsService } = await import('../../src/modules/admin/services/settings.service.js');
      const service = new SettingsService();
      
      const result = await service.getSetting('nonexistent');
      
      expect(result).toBeUndefined();
    });
  });

  describe('updateSetting', () => {
    it('should upsert a setting', async () => {
      const mockBuilder = createChainableMock(null);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockBuilder)
      } as any);

      const { SettingsService } = await import('../../src/modules/admin/services/settings.service.js');
      const service = new SettingsService();
      
      await service.updateSetting('site_name', 'New Resort');
      
      expect(mockBuilder.upsert).toHaveBeenCalled();
    });
  });

  describe('updateMultipleSettings', () => {
    it('should update multiple settings', async () => {
      const mockBuilder = createChainableMock(null);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockBuilder)
      } as any);

      const { SettingsService } = await import('../../src/modules/admin/services/settings.service.js');
      const service = new SettingsService();
      
      await service.updateMultipleSettings({
        site_name: 'Resort A',
        contact_email: 'new@example.com'
      });
      
      // Should be called twice (once per setting)
      expect(mockBuilder.upsert).toHaveBeenCalledTimes(2);
    });
  });
});

describe('RoleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRoles', () => {
    it('should return all roles with permissions', async () => {
      const mockRoles = [
        { 
          id: 'r-1', 
          name: 'Admin', 
          slug: 'admin',
          is_system: true,
          created_at: '2024-01-01',
          role_permissions: [
            { permission: { id: 'p-1', name: 'Manage Users', slug: 'users.manage' } }
          ]
        }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockRoles))
      } as any);

      const { RoleService } = await import('../../src/modules/admin/services/role.service.js');
      const service = new RoleService();
      
      const result = await service.getRoles();
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Admin');
      expect(result[0].permissions).toHaveLength(1);
    });
  });

  describe('getRoleById', () => {
    it('should return a role by ID', async () => {
      const mockRole = { 
        id: 'r-1', 
        name: 'Staff',
        slug: 'staff',
        is_system: false,
        created_at: '2024-01-01',
        role_permissions: []
      };
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockRole))
      } as any);

      const { RoleService } = await import('../../src/modules/admin/services/role.service.js');
      const service = new RoleService();
      
      const result = await service.getRoleById('r-1');
      
      expect(result?.name).toBe('Staff');
    });

    it('should return null for non-existent role', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const { RoleService } = await import('../../src/modules/admin/services/role.service.js');
      const service = new RoleService();
      
      const result = await service.getRoleById('nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('createRole', () => {
    it('should create a new role', async () => {
      const mockRole = { id: 'r-new', name: 'Manager', slug: 'manager' };
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockRole))
      } as any);

      const { RoleService } = await import('../../src/modules/admin/services/role.service.js');
      const service = new RoleService();
      
      const result = await service.createRole({ name: 'Manager' });
      
      expect(result.name).toBe('Manager');
    });
  });
});

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      // Mock all the parallel queries with reasonable data
      const mockBuilder = createChainableMock(
        [{ total_amount: 100 }], // Revenue data
        null,
        5 // Count
      );
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockBuilder)
      } as any);

      const { DashboardService } = await import('../../src/modules/admin/services/dashboard.service.js');
      const service = new DashboardService();
      
      const result = await service.getDashboardStats();
      
      expect(result).toHaveProperty('totalOrders');
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('todayStats');
    });
  });

  describe('getRevenueByPeriod', () => {
    it('should return revenue data for date range', async () => {
      const mockOrders = [
        { created_at: '2024-01-01', total_amount: 50 },
        { created_at: '2024-01-01', total_amount: 75 }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockOrders))
      } as any);

      const { DashboardService } = await import('../../src/modules/admin/services/dashboard.service.js');
      const service = new DashboardService();
      
      const result = await service.getRevenueByPeriod('2024-01-01', '2024-01-07', 'day');
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getRecentOrders', () => {
    it('should return recent orders with item count', async () => {
      const mockOrders = [
        { 
          id: 'o-1', 
          order_number: 'R-001', 
          customer_name: 'John',
          status: 'pending',
          total_amount: 50,
          created_at: '2024-01-01',
          items: [{ id: 'i-1' }, { id: 'i-2' }]
        }
      ];
      
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockOrders))
      } as any);

      const { DashboardService } = await import('../../src/modules/admin/services/dashboard.service.js');
      const service = new DashboardService();
      
      const result = await service.getRecentOrders(5);
      
      expect(result).toHaveLength(1);
      expect(result[0].itemCount).toBe(2);
    });
  });
});
