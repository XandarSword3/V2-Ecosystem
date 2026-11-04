import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveSetting,
  resolveSettings,
  setPropertySetting,
  setGroupSetting,
  deletePropertySetting,
  getEffectiveSettings,
} from '../../../../src/modules/multi-property/settings-resolution.service.js';

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../../../src/database/connection.js';
import { createChainableMock } from '../../utils.js';

describe('SettingsResolutionService (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveSetting cascade: property -> group -> system -> default', () => {
    it('Level 1: should return property-level override when present', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'property_settings') {
            return createChainableMock({ setting_value: { theme: 'midnight' } });
          }
          return createChainableMock(null);
        }),
      } as any);

      const result = await resolveSetting('prop-1', 'theme');
      expect(result.source).toBe('property');
      expect(result.value).toEqual({ theme: 'midnight' });
    });

    it('Level 2: should fallback to group-level setting when property override is absent', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'property_settings') {
            return createChainableMock(null);
          }
          if (table === 'property_group_members') {
            return createChainableMock({ group_id: 'group-100' });
          }
          if (table === 'group_settings') {
            return createChainableMock({ setting_value: { theme: 'emerald' } });
          }
          return createChainableMock(null);
        }),
      } as any);

      const result = await resolveSetting('prop-1', 'theme');
      expect(result.source).toBe('group');
      expect(result.value).toEqual({ theme: 'emerald' });
    });

    it('Level 3: should fallback to system-level default when property and group are absent', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'property_settings') {
            return createChainableMock(null);
          }
          if (table === 'property_group_members') {
            return createChainableMock(null);
          }
          if (table === 'system_defaults') {
            return createChainableMock({ setting_value: { theme: 'default_light' } });
          }
          return createChainableMock(null);
        }),
      } as any);

      const result = await resolveSetting('prop-1', 'theme');
      expect(result.source).toBe('system');
      expect(result.value).toEqual({ theme: 'default_light' });
    });

    it('Level 4: should return hardcoded fallback when no tier has the setting', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      const result = await resolveSetting('prop-1', 'unconfigured_key', 'fallback_val');
      expect(result.source).toBe('default');
      expect(result.value).toBe('fallback_val');
    });
  });

  describe('resolveSettings batch resolution', () => {
    it('should resolve multiple keys across different tiers in a single batch', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'property_settings') {
            return createChainableMock([{ setting_key: 'tax_rate', setting_value: 0.15 }]);
          }
          if (table === 'property_group_members') {
            return createChainableMock({ group_id: 'group-1' });
          }
          if (table === 'group_settings') {
            return createChainableMock([{ setting_key: 'currency', setting_value: 'EUR' }]);
          }
          if (table === 'system_defaults') {
            return createChainableMock([{ setting_key: 'timezone', setting_value: 'UTC' }]);
          }
          return createChainableMock(null);
        }),
      } as any);

      const results = await resolveSettings('prop-1', ['tax_rate', 'currency', 'timezone', 'missing_key']);

      expect(results['tax_rate'].source).toBe('property');
      expect(results['tax_rate'].value).toBe(0.15);

      expect(results['currency'].source).toBe('group');
      expect(results['currency'].value).toBe('EUR');

      expect(results['timezone'].source).toBe('system');
      expect(results['timezone'].value).toBe('UTC');

      expect(results['missing_key'].source).toBe('default');
      expect(results['missing_key'].value).toBeNull();
    });
  });

  describe('setPropertySetting, setGroupSetting & deletePropertySetting', () => {
    it('should lookup property tenant_id and upsert into property_settings', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'properties') {
            return createChainableMock({ tenant_id: 'tenant-100' });
          }
          if (table === 'property_settings') {
            const chain = createChainableMock(null);
            chain.upsert = mockUpsert;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      await setPropertySetting('prop-1', 'currency', 'USD', 'finance', 'user-1');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'prop-1',
          tenant_id: 'tenant-100',
          setting_key: 'currency',
          setting_value: 'USD',
          category: 'finance',
          updated_by: 'user-1',
        }),
        { onConflict: 'property_id,setting_key' }
      );
    });

    it('should throw error when property not found during setPropertySetting', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'properties') {
            return createChainableMock(null, { message: 'Property not found' });
          }
          return createChainableMock(null);
        }),
      } as any);

      await expect(setPropertySetting('prop-none', 'currency', 'USD')).rejects.toThrow('Failed to find property');
    });

    it('should lookup group tenant_id and upsert into group_settings', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'property_groups') {
            return createChainableMock({ tenant_id: 'tenant-200' });
          }
          if (table === 'group_settings') {
            const chain = createChainableMock(null);
            chain.upsert = mockUpsert;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      await setGroupSetting('group-1', 'brand_color', '#ff0000', 'branding', 'user-1');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 'group-1',
          tenant_id: 'tenant-200',
          setting_key: 'brand_color',
          setting_value: '#ff0000',
        }),
        { onConflict: 'group_id,setting_key' }
      );
    });

    it('should throw error when group not found during setGroupSetting', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'property_groups') {
            return createChainableMock(null);
          }
          return createChainableMock(null);
        }),
      } as any);

      await expect(setGroupSetting('group-none', 'brand_color', '#ff0000')).rejects.toThrow('Failed to find group');
    });

    it('should delete property override via deletePropertySetting', async () => {
      const mockDelete = vi.fn().mockReturnThis();

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          const chain = createChainableMock(null);
          chain.delete = mockDelete;
          return chain;
        }),
      } as any);

      await deletePropertySetting('prop-1', 'custom_css');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('getEffectiveSettings', () => {
    it('should merge system defaults and property overrides with metadata', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'system_defaults') {
            return createChainableMock([
              { setting_key: 'theme', setting_value: 'light', category: 'ui', description: 'UI Theme' },
              { setting_key: 'currency', setting_value: 'USD', category: 'finance', description: 'Currency' },
            ]);
          }
          if (table === 'property_settings') {
            // For initial select of property keys:
            // Also used during batch resolution
            return createChainableMock([
              { setting_key: 'theme', setting_value: 'dark', category: 'ui' },
              { setting_key: 'custom_banner', setting_value: 'welcome.png', category: 'ui' },
            ]);
          }
          if (table === 'property_group_members') {
            return createChainableMock({ group_id: 'group-1' });
          }
          if (table === 'group_settings') {
            return createChainableMock([]);
          }
          return createChainableMock(null);
        }),
      } as any);

      const effective = await getEffectiveSettings('prop-1', 'ui');
      expect(effective.length).toBeGreaterThan(0);
      const theme = effective.find(e => e.key === 'theme');
      expect(theme).toBeDefined();
      expect(theme?.value).toBe('dark');
      expect(theme?.source).toBe('property');
    });

    it('should return empty array if no keys exist', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock([])),
      } as any);

      const effective = await getEffectiveSettings('prop-1');
      expect(effective).toEqual([]);
    });
  });
});
