/**
 * Settings Service - DI-based settings management
 * Handles application settings and configurations
 */

import type { Setting, SettingCategory, SettingsMap, SettingsRepository, SocketEmitter } from '../container/types.js';

// ============================================
// TYPES
// ============================================

export interface SettingsServiceDependencies {
  settingsRepository: SettingsRepository;
  socketEmitter?: SocketEmitter;
}

// Valid setting keys by category
const VALID_SETTING_KEYS: Record<SettingCategory, string[]> = {
  general: ['site_name', 'site_description', 'contact_email', 'contact_phone', 'timezone', 'currency', 'default_language'],
  appearance: ['navbar', 'footer', 'theme', 'logo_url', 'favicon_url', 'primary_color', 'secondary_color'],
  business: ['business_hours', 'deposit_percentage', 'check_in_time', 'check_out_time', 'cancellation_policy', 'tax_rate'],
  notifications: ['email_notifications', 'sms_notifications', 'push_notifications', 'admin_email', 'notification_frequency'],
  integrations: ['stripe_enabled', 'google_analytics_id', 'facebook_pixel_id', 'sentry_dsn', 'smtp_host', 'smtp_port']
};

// ============================================
// CUSTOM ERROR
// ============================================

export class SettingsServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SettingsServiceError';
  }
}

// ============================================
// VALIDATION
// ============================================

function validateSettingKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new SettingsServiceError('Setting key is required', 'INVALID_KEY');
  }
  
  if (key.length < 2 || key.length > 100) {
    throw new SettingsServiceError('Setting key must be between 2 and 100 characters', 'INVALID_KEY_LENGTH');
  }
  
  // Key should be snake_case
  if (!/^[a-z][a-z0-9_]*[a-z0-9]$/.test(key) && !/^[a-z]$/.test(key)) {
    throw new SettingsServiceError('Setting key must be in snake_case format', 'INVALID_KEY_FORMAT');
  }
}

function validateCategory(category: string): asserts category is SettingCategory {
  const validCategories: SettingCategory[] = ['general', 'appearance', 'business', 'notifications', 'integrations'];
  if (!validCategories.includes(category as SettingCategory)) {
    throw new SettingsServiceError(
      `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      'INVALID_CATEGORY'
    );
  }
}

function validateSettingValue(value: unknown, key: string): void {
  if (value === undefined) {
    throw new SettingsServiceError('Setting value is required', 'INVALID_VALUE');
  }
  
  // Check for circular references in objects
  if (value !== null && typeof value === 'object') {
    try {
      JSON.stringify(value);
    } catch {
      throw new SettingsServiceError('Setting value cannot contain circular references', 'INVALID_VALUE_CIRCULAR');
    }
  }
  
  // Specific validations for known keys
  if (key === 'contact_email' && typeof value === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new SettingsServiceError('Invalid email format for contact_email', 'INVALID_EMAIL');
    }
  }
  
  if (key === 'tax_rate' && typeof value === 'number') {
    if (value < 0 || value > 100) {
      throw new SettingsServiceError('Tax rate must be between 0 and 100', 'INVALID_TAX_RATE');
    }
  }
  
  if (key === 'deposit_percentage' && typeof value === 'number') {
    if (value < 0 || value > 100) {
      throw new SettingsServiceError('Deposit percentage must be between 0 and 100', 'INVALID_DEPOSIT');
    }
  }
  
  if ((key === 'check_in_time' || key === 'check_out_time') && typeof value === 'string') {
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      throw new SettingsServiceError(`Invalid time format for ${key}. Use HH:MM format`, 'INVALID_TIME');
    }
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createSettingsService(deps: SettingsServiceDependencies) {
  const { settingsRepository, socketEmitter } = deps;

  function emitUpdate(event: string, data: unknown): void {
    if (socketEmitter) {
      socketEmitter.emitToRoom('admin', event, data);
    }
  }

  return {
    /**
     * Get all settings
     */
    async getAllSettings(): Promise<SettingsMap> {
      const settings = await settingsRepository.getAllSettings();
      
      const settingsMap: SettingsMap = {};
      for (const setting of settings) {
        settingsMap[setting.key] = setting.value;
      }
      
      return settingsMap;
    },

    /**
     * Get settings by category
     */
    async getSettingsByCategory(category: string): Promise<SettingsMap> {
      validateCategory(category);
      
      const settings = await settingsRepository.getSettingsByCategory(category);
      
      const settingsMap: SettingsMap = {};
      for (const setting of settings) {
        settingsMap[setting.key] = setting.value;
      }
      
      return settingsMap;
    },

    /**
     * Get a single setting value
     */
    async getSetting(key: string): Promise<unknown> {
      validateSettingKey(key);
      
      const setting = await settingsRepository.getSettingByKey(key);
      return setting?.value ?? null;
    },

    /**
     * Get a setting with full details
     */
    async getSettingDetails(key: string): Promise<Setting | null> {
      validateSettingKey(key);
      
      return settingsRepository.getSettingByKey(key);
    },

    /**
     * Update or create a setting
     */
    async updateSetting(
      key: string,
      value: unknown,
      options?: { category?: SettingCategory; description?: string }
    ): Promise<Setting> {
      validateSettingKey(key);
      validateSettingValue(value, key);
      
      if (options?.category) {
        validateCategory(options.category);
      }
      
      const setting = await settingsRepository.upsertSetting({
        key,
        value,
        category: options?.category,
        description: options?.description
      });
      
      emitUpdate('settings:updated', { key, value });
      
      return setting;
    },

    /**
     * Update multiple settings at once
     */
    async updateMultipleSettings(
      settings: Record<string, unknown>,
      category?: SettingCategory
    ): Promise<Setting[]> {
      if (!settings || typeof settings !== 'object') {
        throw new SettingsServiceError('Settings must be an object', 'INVALID_INPUT');
      }
      
      const entries = Object.entries(settings);
      if (entries.length === 0) {
        throw new SettingsServiceError('At least one setting is required', 'NO_SETTINGS');
      }
      
      if (entries.length > 50) {
        throw new SettingsServiceError('Cannot update more than 50 settings at once', 'TOO_MANY_SETTINGS');
      }
      
      if (category) {
        validateCategory(category);
      }
      
      // Validate all before updating
      for (const [key, value] of entries) {
        validateSettingKey(key);
        validateSettingValue(value, key);
      }
      
      const updated: Setting[] = [];
      for (const [key, value] of entries) {
        const setting = await settingsRepository.upsertSetting({
          key,
          value,
          category
        });
        updated.push(setting);
      }
      
      emitUpdate('settings:bulk-updated', settings);
      
      return updated;
    },

    /**
     * Delete a setting
     */
    async deleteSetting(key: string): Promise<void> {
      validateSettingKey(key);
      
      const existing = await settingsRepository.getSettingByKey(key);
      if (!existing) {
        throw new SettingsServiceError('Setting not found', 'NOT_FOUND', 404);
      }
      
      await settingsRepository.deleteSetting(key);
      
      emitUpdate('settings:deleted', { key });
    },

    // ============================================
    // SPECIALIZED METHODS
    // ============================================

    /**
     * Get navbar configuration
     */
    async getNavbarConfig(): Promise<unknown> {
      return this.getSetting('navbar');
    },

    /**
     * Update navbar configuration
     */
    async updateNavbarConfig(config: unknown): Promise<Setting> {
      if (!config || typeof config !== 'object') {
        throw new SettingsServiceError('Navbar config must be an object', 'INVALID_CONFIG');
      }
      
      return this.updateSetting('navbar', config, { category: 'appearance' });
    },

    /**
     * Get footer configuration
     */
    async getFooterConfig(): Promise<unknown> {
      return this.getSetting('footer');
    },

    /**
     * Update footer configuration
     */
    async updateFooterConfig(config: unknown): Promise<Setting> {
      if (!config || typeof config !== 'object') {
        throw new SettingsServiceError('Footer config must be an object', 'INVALID_CONFIG');
      }
      
      return this.updateSetting('footer', config, { category: 'appearance' });
    },

    /**
     * Get appearance settings
     */
    async getAppearanceSettings(): Promise<SettingsMap> {
      return this.getSettingsByCategory('appearance');
    },

    /**
     * Get business settings
     */
    async getBusinessSettings(): Promise<SettingsMap> {
      return this.getSettingsByCategory('business');
    },

    /**
     * Get notification settings
     */
    async getNotificationSettings(): Promise<SettingsMap> {
      return this.getSettingsByCategory('notifications');
    },

    /**
     * Get integration settings
     */
    async getIntegrationSettings(): Promise<SettingsMap> {
      return this.getSettingsByCategory('integrations');
    },

    /**
     * Check if a feature is enabled
     */
    async isFeatureEnabled(featureKey: string): Promise<boolean> {
      const value = await this.getSetting(featureKey);
      return value === true;
    },

    /**
     * Get chalet-specific settings
     */
    async getChaletSettings(): Promise<{
      deposit_percentage: number;
      check_in_time: string;
      check_out_time: string;
      deposit_type?: 'percentage' | 'fixed';
      deposit_fixed?: number;
    }> {
      const businessSettings = await this.getSettingsByCategory('business');
      
      return {
        deposit_percentage: (businessSettings['deposit_percentage'] as number) || 25,
        check_in_time: (businessSettings['check_in_time'] as string) || '14:00',
        check_out_time: (businessSettings['check_out_time'] as string) || '12:00',
        deposit_type: businessSettings['deposit_type'] as 'percentage' | 'fixed' | undefined,
        deposit_fixed: businessSettings['deposit_fixed'] as number | undefined
      };
    },

    /**
     * Update chalet settings
     */
    async updateChaletSettings(settings: {
      deposit_percentage?: number;
      check_in_time?: string;
      check_out_time?: string;
      deposit_type?: 'percentage' | 'fixed';
      deposit_fixed?: number;
    }): Promise<void> {
      const updates: Record<string, unknown> = {};
      
      if (settings.deposit_percentage !== undefined) {
        if (settings.deposit_percentage < 0 || settings.deposit_percentage > 100) {
          throw new SettingsServiceError('Deposit percentage must be between 0 and 100', 'INVALID_DEPOSIT');
        }
        updates['deposit_percentage'] = settings.deposit_percentage;
      }
      
      if (settings.check_in_time !== undefined) {
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings.check_in_time)) {
          throw new SettingsServiceError('Invalid check-in time format. Use HH:MM', 'INVALID_TIME');
        }
        updates['check_in_time'] = settings.check_in_time;
      }
      
      if (settings.check_out_time !== undefined) {
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings.check_out_time)) {
          throw new SettingsServiceError('Invalid check-out time format. Use HH:MM', 'INVALID_TIME');
        }
        updates['check_out_time'] = settings.check_out_time;
      }
      
      if (settings.deposit_type !== undefined) {
        if (!['percentage', 'fixed'].includes(settings.deposit_type)) {
          throw new SettingsServiceError('Deposit type must be "percentage" or "fixed"', 'INVALID_DEPOSIT_TYPE');
        }
        updates['deposit_type'] = settings.deposit_type;
      }
      
      if (settings.deposit_fixed !== undefined) {
        if (settings.deposit_fixed < 0) {
          throw new SettingsServiceError('Fixed deposit amount cannot be negative', 'INVALID_DEPOSIT_FIXED');
        }
        updates['deposit_fixed'] = settings.deposit_fixed;
      }
      
      if (Object.keys(updates).length > 0) {
        await this.updateMultipleSettings(updates, 'business');
      }
    },

    /**
     * Get available categories
     */
    getCategories(): SettingCategory[] {
      return ['general', 'appearance', 'business', 'notifications', 'integrations'];
    },

    /**
     * Get valid keys for a category
     */
    getValidKeysForCategory(category: string): string[] {
      validateCategory(category);
      return VALID_SETTING_KEYS[category] || [];
    }
  };
}
