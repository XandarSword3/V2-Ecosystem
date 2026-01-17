/**
 * Settings Service Tests
 * Tests for DI-based settings management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSettingsService, SettingsServiceError } from '../../src/lib/services/settings.service.js';
import { createInMemorySettingsRepository } from '../../src/lib/repositories/settings.repository.memory.js';
import type { Setting, SettingCategory, SocketEmitter } from '../../src/lib/container/types.js';

describe('SettingsService', () => {
  let settingsRepository: ReturnType<typeof createInMemorySettingsRepository>;
  let socketEmitter: SocketEmitter;
  let service: ReturnType<typeof createSettingsService>;

  const mockSetting: Setting = {
    id: 'setting-1',
    key: 'site_name',
    value: 'V2 Resort',
    category: 'general',
    description: 'The name of the site',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    settingsRepository = createInMemorySettingsRepository();
    socketEmitter = {
      emitToUnit: vi.fn(),
      emitToRoom: vi.fn()
    };
    service = createSettingsService({ settingsRepository, socketEmitter });
  });

  // ============================================
  // getAllSettings Tests
  // ============================================

  describe('getAllSettings', () => {
    it('should return empty map when no settings exist', async () => {
      const result = await service.getAllSettings();
      expect(result).toEqual({});
    });

    it('should return all settings as a map', async () => {
      settingsRepository.addSetting(mockSetting);
      settingsRepository.addSetting({
        ...mockSetting,
        id: 'setting-2',
        key: 'site_description',
        value: 'A beautiful resort'
      });

      const result = await service.getAllSettings();
      
      expect(result).toEqual({
        site_name: 'V2 Resort',
        site_description: 'A beautiful resort'
      });
    });

    it('should handle various value types', async () => {
      settingsRepository.addSetting({ ...mockSetting, key: 'string_val', value: 'test' });
      settingsRepository.addSetting({ ...mockSetting, id: 's2', key: 'number_val', value: 42 });
      settingsRepository.addSetting({ ...mockSetting, id: 's3', key: 'bool_val', value: true });
      settingsRepository.addSetting({ ...mockSetting, id: 's4', key: 'obj_val', value: { nested: 'value' } });
      settingsRepository.addSetting({ ...mockSetting, id: 's5', key: 'arr_val', value: [1, 2, 3] });

      const result = await service.getAllSettings();
      
      expect(result['string_val']).toBe('test');
      expect(result['number_val']).toBe(42);
      expect(result['bool_val']).toBe(true);
      expect(result['obj_val']).toEqual({ nested: 'value' });
      expect(result['arr_val']).toEqual([1, 2, 3]);
    });
  });

  // ============================================
  // getSettingsByCategory Tests
  // ============================================

  describe('getSettingsByCategory', () => {
    it('should return settings for a specific category', async () => {
      settingsRepository.addSetting({ ...mockSetting, key: 'site_name', category: 'general' });
      settingsRepository.addSetting({ ...mockSetting, id: 's2', key: 'theme', value: 'dark', category: 'appearance' });
      settingsRepository.addSetting({ ...mockSetting, id: 's3', key: 'logo_url', value: '/logo.png', category: 'appearance' });

      const result = await service.getSettingsByCategory('appearance');
      
      expect(result).toEqual({
        theme: 'dark',
        logo_url: '/logo.png'
      });
    });

    it('should return empty map for category with no settings', async () => {
      settingsRepository.addSetting({ ...mockSetting, key: 'site_name', category: 'general' });

      const result = await service.getSettingsByCategory('appearance');
      
      expect(result).toEqual({});
    });

    it('should throw for invalid category', async () => {
      await expect(service.getSettingsByCategory('invalid'))
        .rejects.toThrow(SettingsServiceError);
      await expect(service.getSettingsByCategory('invalid'))
        .rejects.toThrow('Invalid category');
    });

    it.each(['general', 'appearance', 'business', 'notifications', 'integrations'] as SettingCategory[])(
      'should accept valid category: %s',
      async (category) => {
        const result = await service.getSettingsByCategory(category);
        expect(result).toEqual({});
      }
    );
  });

  // ============================================
  // getSetting Tests
  // ============================================

  describe('getSetting', () => {
    it('should return setting value by key', async () => {
      settingsRepository.addSetting(mockSetting);

      const result = await service.getSetting('site_name');
      
      expect(result).toBe('V2 Resort');
    });

    it('should return null for non-existent key', async () => {
      const result = await service.getSetting('nonexistent_key');
      
      expect(result).toBeNull();
    });

    it('should throw for invalid key format', async () => {
      await expect(service.getSetting('')).rejects.toThrow('Setting key is required');
      await expect(service.getSetting('InvalidKey')).rejects.toThrow('snake_case');
      await expect(service.getSetting('123key')).rejects.toThrow('snake_case');
    });

    it('should throw for key too short or too long', async () => {
      await expect(service.getSetting('a')).rejects.toThrow('between 2 and 100');
      await expect(service.getSetting('a'.repeat(101))).rejects.toThrow('between 2 and 100');
    });
  });

  // ============================================
  // getSettingDetails Tests
  // ============================================

  describe('getSettingDetails', () => {
    it('should return full setting object', async () => {
      settingsRepository.addSetting(mockSetting);

      const result = await service.getSettingDetails('site_name');
      
      expect(result).toMatchObject({
        key: 'site_name',
        value: 'V2 Resort',
        category: 'general',
        description: 'The name of the site'
      });
    });

    it('should return null for non-existent key', async () => {
      const result = await service.getSettingDetails('nonexistent_key');
      
      expect(result).toBeNull();
    });
  });

  // ============================================
  // updateSetting Tests
  // ============================================

  describe('updateSetting', () => {
    it('should create a new setting', async () => {
      const result = await service.updateSetting('new_setting', 'new value');
      
      expect(result.key).toBe('new_setting');
      expect(result.value).toBe('new value');
    });

    it('should update existing setting', async () => {
      settingsRepository.addSetting(mockSetting);

      const result = await service.updateSetting('site_name', 'Updated Name');
      
      expect(result.value).toBe('Updated Name');
    });

    it('should set category when provided', async () => {
      const result = await service.updateSetting('theme', 'dark', { category: 'appearance' });
      
      expect(result.category).toBe('appearance');
    });

    it('should set description when provided', async () => {
      const result = await service.updateSetting('site_name', 'Test', { 
        description: 'Site name setting' 
      });
      
      expect(result.description).toBe('Site name setting');
    });

    it('should emit socket event on update', async () => {
      await service.updateSetting('site_name', 'New Name');
      
      expect(socketEmitter.emitToRoom).toHaveBeenCalledWith(
        'admin',
        'settings:updated',
        { key: 'site_name', value: 'New Name' }
      );
    });

    it('should throw for undefined value', async () => {
      await expect(service.updateSetting('key', undefined))
        .rejects.toThrow('Setting value is required');
    });

    it('should throw for invalid category', async () => {
      await expect(service.updateSetting('key', 'value', { category: 'invalid' as SettingCategory }))
        .rejects.toThrow('Invalid category');
    });

    it('should validate email format for contact_email', async () => {
      await expect(service.updateSetting('contact_email', 'invalid-email'))
        .rejects.toThrow('Invalid email format');

      const result = await service.updateSetting('contact_email', 'test@example.com');
      expect(result.value).toBe('test@example.com');
    });

    it('should validate tax_rate range', async () => {
      await expect(service.updateSetting('tax_rate', -1))
        .rejects.toThrow('Tax rate must be between 0 and 100');
      await expect(service.updateSetting('tax_rate', 101))
        .rejects.toThrow('Tax rate must be between 0 and 100');

      const result = await service.updateSetting('tax_rate', 15);
      expect(result.value).toBe(15);
    });

    it('should validate deposit_percentage range', async () => {
      await expect(service.updateSetting('deposit_percentage', -5))
        .rejects.toThrow('Deposit percentage must be between 0 and 100');
      await expect(service.updateSetting('deposit_percentage', 150))
        .rejects.toThrow('Deposit percentage must be between 0 and 100');

      const result = await service.updateSetting('deposit_percentage', 25);
      expect(result.value).toBe(25);
    });

    it('should validate time format for check_in_time and check_out_time', async () => {
      await expect(service.updateSetting('check_in_time', '25:00'))
        .rejects.toThrow('Invalid time format');
      await expect(service.updateSetting('check_out_time', '12:60'))
        .rejects.toThrow('Invalid time format');

      const result1 = await service.updateSetting('check_in_time', '14:00');
      expect(result1.value).toBe('14:00');

      const result2 = await service.updateSetting('check_out_time', '12:00');
      expect(result2.value).toBe('12:00');
    });

    it('should allow null values', async () => {
      const result = await service.updateSetting('optional_setting', null);
      expect(result.value).toBeNull();
    });

    it('should allow complex object values', async () => {
      const config = {
        links: [{ label: 'Home', url: '/' }],
        showSearch: true
      };

      const result = await service.updateSetting('navbar', config);
      expect(result.value).toEqual(config);
    });
  });

  // ============================================
  // updateMultipleSettings Tests
  // ============================================

  describe('updateMultipleSettings', () => {
    it('should update multiple settings at once', async () => {
      const settings = {
        site_name: 'New Site',
        site_description: 'New Description'
      };

      const result = await service.updateMultipleSettings(settings, 'general');
      
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('site_name');
      expect(result[1].key).toBe('site_description');
    });

    it('should emit bulk update event', async () => {
      const settings = { site_name: 'Test', site_description: 'Desc' };

      await service.updateMultipleSettings(settings);
      
      expect(socketEmitter.emitToRoom).toHaveBeenCalledWith(
        'admin',
        'settings:bulk-updated',
        settings
      );
    });

    it('should throw for non-object input', async () => {
      await expect(service.updateMultipleSettings(null as unknown as Record<string, unknown>))
        .rejects.toThrow('Settings must be an object');
    });

    it('should throw for empty settings', async () => {
      await expect(service.updateMultipleSettings({}))
        .rejects.toThrow('At least one setting is required');
    });

    it('should throw for too many settings', async () => {
      const settings: Record<string, unknown> = {};
      for (let i = 0; i < 51; i++) {
        settings[`setting_${i}`] = i;
      }

      await expect(service.updateMultipleSettings(settings))
        .rejects.toThrow('Cannot update more than 50 settings');
    });

    it('should validate all keys before updating', async () => {
      const settings = {
        valid_key: 'value',
        'INVALID-KEY': 'value'
      };

      await expect(service.updateMultipleSettings(settings))
        .rejects.toThrow('snake_case');

      // Should not have updated any settings
      const stored = await service.getAllSettings();
      expect(stored).toEqual({});
    });
  });

  // ============================================
  // deleteSetting Tests
  // ============================================

  describe('deleteSetting', () => {
    it('should delete existing setting', async () => {
      settingsRepository.addSetting(mockSetting);

      await service.deleteSetting('site_name');
      
      const result = await service.getSetting('site_name');
      expect(result).toBeNull();
    });

    it('should emit delete event', async () => {
      settingsRepository.addSetting(mockSetting);

      await service.deleteSetting('site_name');
      
      expect(socketEmitter.emitToRoom).toHaveBeenCalledWith(
        'admin',
        'settings:deleted',
        { key: 'site_name' }
      );
    });

    it('should throw for non-existent setting', async () => {
      await expect(service.deleteSetting('nonexistent'))
        .rejects.toThrow('Setting not found');
    });

    it('should throw for invalid key', async () => {
      await expect(service.deleteSetting(''))
        .rejects.toThrow('Setting key is required');
    });
  });

  // ============================================
  // getNavbarConfig / updateNavbarConfig Tests
  // ============================================

  describe('getNavbarConfig', () => {
    it('should return navbar config', async () => {
      settingsRepository.addSetting({
        ...mockSetting,
        key: 'navbar',
        value: { logo: '/logo.png' },
        category: 'appearance'
      });

      const result = await service.getNavbarConfig();
      
      expect(result).toEqual({ logo: '/logo.png' });
    });

    it('should return null if not set', async () => {
      const result = await service.getNavbarConfig();
      expect(result).toBeNull();
    });
  });

  describe('updateNavbarConfig', () => {
    it('should update navbar config', async () => {
      const config = { logo: '/new-logo.png', links: [] };

      const result = await service.updateNavbarConfig(config);
      
      expect(result.key).toBe('navbar');
      expect(result.value).toEqual(config);
      expect(result.category).toBe('appearance');
    });

    it('should throw for non-object config', async () => {
      await expect(service.updateNavbarConfig('string'))
        .rejects.toThrow('Navbar config must be an object');
      await expect(service.updateNavbarConfig(null))
        .rejects.toThrow('Navbar config must be an object');
    });
  });

  // ============================================
  // getFooterConfig / updateFooterConfig Tests
  // ============================================

  describe('getFooterConfig', () => {
    it('should return footer config', async () => {
      settingsRepository.addSetting({
        ...mockSetting,
        key: 'footer',
        value: { copyright: '2024' },
        category: 'appearance'
      });

      const result = await service.getFooterConfig();
      
      expect(result).toEqual({ copyright: '2024' });
    });
  });

  describe('updateFooterConfig', () => {
    it('should update footer config', async () => {
      const config = { copyright: '2024', links: [] };

      const result = await service.updateFooterConfig(config);
      
      expect(result.key).toBe('footer');
      expect(result.category).toBe('appearance');
    });

    it('should throw for non-object config', async () => {
      await expect(service.updateFooterConfig(123))
        .rejects.toThrow('Footer config must be an object');
    });
  });

  // ============================================
  // Category-specific getters Tests
  // ============================================

  describe('getAppearanceSettings', () => {
    it('should return appearance settings', async () => {
      settingsRepository.addSetting({ ...mockSetting, key: 'theme', value: 'dark', category: 'appearance' });
      settingsRepository.addSetting({ ...mockSetting, id: 's2', key: 'logo_url', value: '/logo.png', category: 'appearance' });

      const result = await service.getAppearanceSettings();
      
      expect(result).toEqual({
        theme: 'dark',
        logo_url: '/logo.png'
      });
    });
  });

  describe('getBusinessSettings', () => {
    it('should return business settings', async () => {
      settingsRepository.addSetting({ ...mockSetting, key: 'tax_rate', value: 10, category: 'business' });

      const result = await service.getBusinessSettings();
      
      expect(result).toEqual({ tax_rate: 10 });
    });
  });

  describe('getNotificationSettings', () => {
    it('should return notification settings', async () => {
      settingsRepository.addSetting({ 
        ...mockSetting, 
        key: 'email_notifications', 
        value: true, 
        category: 'notifications' 
      });

      const result = await service.getNotificationSettings();
      
      expect(result).toEqual({ email_notifications: true });
    });
  });

  describe('getIntegrationSettings', () => {
    it('should return integration settings', async () => {
      settingsRepository.addSetting({ 
        ...mockSetting, 
        key: 'stripe_enabled', 
        value: true, 
        category: 'integrations' 
      });

      const result = await service.getIntegrationSettings();
      
      expect(result).toEqual({ stripe_enabled: true });
    });
  });

  // ============================================
  // isFeatureEnabled Tests
  // ============================================

  describe('isFeatureEnabled', () => {
    it('should return true for enabled feature', async () => {
      settingsRepository.addSetting({ 
        ...mockSetting, 
        key: 'stripe_enabled', 
        value: true 
      });

      const result = await service.isFeatureEnabled('stripe_enabled');
      
      expect(result).toBe(true);
    });

    it('should return false for disabled feature', async () => {
      settingsRepository.addSetting({ 
        ...mockSetting, 
        key: 'stripe_enabled', 
        value: false 
      });

      const result = await service.isFeatureEnabled('stripe_enabled');
      
      expect(result).toBe(false);
    });

    it('should return false for non-boolean value', async () => {
      settingsRepository.addSetting({ 
        ...mockSetting, 
        key: 'some_setting', 
        value: 'enabled' 
      });

      const result = await service.isFeatureEnabled('some_setting');
      
      expect(result).toBe(false);
    });

    it('should return false for non-existent feature', async () => {
      const result = await service.isFeatureEnabled('nonexistent_feature');
      
      expect(result).toBe(false);
    });
  });

  // ============================================
  // getChaletSettings Tests
  // ============================================

  describe('getChaletSettings', () => {
    it('should return chalet settings with defaults', async () => {
      const result = await service.getChaletSettings();
      
      expect(result).toEqual({
        deposit_percentage: 25,
        check_in_time: '14:00',
        check_out_time: '12:00',
        deposit_type: undefined,
        deposit_fixed: undefined
      });
    });

    it('should return custom chalet settings', async () => {
      settingsRepository.addSetting({ ...mockSetting, key: 'deposit_percentage', value: 30, category: 'business' });
      settingsRepository.addSetting({ ...mockSetting, id: 's2', key: 'check_in_time', value: '15:00', category: 'business' });
      settingsRepository.addSetting({ ...mockSetting, id: 's3', key: 'check_out_time', value: '11:00', category: 'business' });
      settingsRepository.addSetting({ ...mockSetting, id: 's4', key: 'deposit_type', value: 'fixed', category: 'business' });
      settingsRepository.addSetting({ ...mockSetting, id: 's5', key: 'deposit_fixed', value: 100, category: 'business' });

      const result = await service.getChaletSettings();
      
      expect(result).toEqual({
        deposit_percentage: 30,
        check_in_time: '15:00',
        check_out_time: '11:00',
        deposit_type: 'fixed',
        deposit_fixed: 100
      });
    });
  });

  // ============================================
  // updateChaletSettings Tests
  // ============================================

  describe('updateChaletSettings', () => {
    it('should update deposit percentage', async () => {
      await service.updateChaletSettings({ deposit_percentage: 30 });
      
      const settings = await service.getChaletSettings();
      expect(settings.deposit_percentage).toBe(30);
    });

    it('should update check-in and check-out times', async () => {
      await service.updateChaletSettings({ 
        check_in_time: '15:00',
        check_out_time: '11:00'
      });
      
      const settings = await service.getChaletSettings();
      expect(settings.check_in_time).toBe('15:00');
      expect(settings.check_out_time).toBe('11:00');
    });

    it('should update deposit type and fixed amount', async () => {
      await service.updateChaletSettings({ 
        deposit_type: 'fixed',
        deposit_fixed: 150
      });
      
      const settings = await service.getChaletSettings();
      expect(settings.deposit_type).toBe('fixed');
      expect(settings.deposit_fixed).toBe(150);
    });

    it('should throw for invalid deposit percentage', async () => {
      await expect(service.updateChaletSettings({ deposit_percentage: -1 }))
        .rejects.toThrow('Deposit percentage must be between 0 and 100');
      await expect(service.updateChaletSettings({ deposit_percentage: 101 }))
        .rejects.toThrow('Deposit percentage must be between 0 and 100');
    });

    it('should throw for invalid check-in time format', async () => {
      await expect(service.updateChaletSettings({ check_in_time: 'invalid' }))
        .rejects.toThrow('Invalid check-in time format');
      await expect(service.updateChaletSettings({ check_in_time: '25:00' }))
        .rejects.toThrow('Invalid check-in time format');
    });

    it('should throw for invalid check-out time format', async () => {
      await expect(service.updateChaletSettings({ check_out_time: '12:99' }))
        .rejects.toThrow('Invalid check-out time format');
    });

    it('should throw for invalid deposit type', async () => {
      await expect(service.updateChaletSettings({ deposit_type: 'invalid' as 'percentage' | 'fixed' }))
        .rejects.toThrow('Deposit type must be "percentage" or "fixed"');
    });

    it('should throw for negative fixed deposit', async () => {
      await expect(service.updateChaletSettings({ deposit_fixed: -50 }))
        .rejects.toThrow('Fixed deposit amount cannot be negative');
    });

    it('should not update anything for empty settings', async () => {
      await service.updateChaletSettings({});
      
      // Should not have emitted any events
      expect(socketEmitter.emitToRoom).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // getCategories Tests
  // ============================================

  describe('getCategories', () => {
    it('should return all valid categories', () => {
      const categories = service.getCategories();
      
      expect(categories).toEqual([
        'general',
        'appearance',
        'business',
        'notifications',
        'integrations'
      ]);
    });
  });

  // ============================================
  // getValidKeysForCategory Tests
  // ============================================

  describe('getValidKeysForCategory', () => {
    it('should return valid keys for general category', () => {
      const keys = service.getValidKeysForCategory('general');
      
      expect(keys).toContain('site_name');
      expect(keys).toContain('timezone');
      expect(keys).toContain('currency');
    });

    it('should return valid keys for appearance category', () => {
      const keys = service.getValidKeysForCategory('appearance');
      
      expect(keys).toContain('navbar');
      expect(keys).toContain('footer');
      expect(keys).toContain('theme');
    });

    it('should return valid keys for business category', () => {
      const keys = service.getValidKeysForCategory('business');
      
      expect(keys).toContain('deposit_percentage');
      expect(keys).toContain('check_in_time');
      expect(keys).toContain('tax_rate');
    });

    it('should throw for invalid category', () => {
      expect(() => service.getValidKeysForCategory('invalid'))
        .toThrow('Invalid category');
    });
  });

  // ============================================
  // SettingsServiceError Tests
  // ============================================

  describe('SettingsServiceError', () => {
    it('should have correct properties', () => {
      const error = new SettingsServiceError('Test error', 'TEST_CODE', 404);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('SettingsServiceError');
    });

    it('should default to 400 status code', () => {
      const error = new SettingsServiceError('Test error', 'TEST_CODE');
      
      expect(error.statusCode).toBe(400);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should work without socket emitter', async () => {
      const serviceWithoutSocket = createSettingsService({ settingsRepository });
      
      await serviceWithoutSocket.updateSetting('test_key', 'value');
      
      const result = await serviceWithoutSocket.getSetting('test_key');
      expect(result).toBe('value');
    });

    it('should handle settings with null description', async () => {
      const result = await service.updateSetting('null_desc', 'value');
      
      expect(result.description).toBeFalsy();
    });

    it('should handle concurrent updates', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.updateSetting(`concurrent_${i}`, i));
      }

      await Promise.all(promises);
      
      const settings = await service.getAllSettings();
      expect(Object.keys(settings).filter(k => k.startsWith('concurrent_'))).toHaveLength(10);
    });

    it('should handle special characters in values', async () => {
      const specialValue = {
        html: '<script>alert("xss")</script>',
        unicode: '你好世界',
        emoji: '🎉🎊',
        quotes: 'He said "hello"'
      };

      await service.updateSetting('special_chars', specialValue);
      
      const result = await service.getSetting('special_chars');
      expect(result).toEqual(specialValue);
    });

    it('should handle very long values', async () => {
      const longValue = 'a'.repeat(10000);

      await service.updateSetting('long_value', longValue);
      
      const result = await service.getSetting('long_value');
      expect(result).toBe(longValue);
    });
  });
});
