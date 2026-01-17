/**
 * In-memory Settings Repository for testing
 * Provides a test double for SettingsRepository
 */

import type { Setting, SettingCategory, SettingsRepository } from '../container/types.js';

function generateId(): string {
  return `setting-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createInMemorySettingsRepository(): SettingsRepository & {
  // Test helpers
  addSetting(setting: Setting): void;
  clear(): void;
  getAllSettingsRaw(): Setting[];
} {
  const settings: Map<string, Setting> = new Map();

  return {
    async getAllSettings(): Promise<Setting[]> {
      return Array.from(settings.values());
    },

    async getSettingsByCategory(category: SettingCategory): Promise<Setting[]> {
      return Array.from(settings.values()).filter(s => s.category === category);
    },

    async getSettingByKey(key: string): Promise<Setting | null> {
      return settings.get(key) || null;
    },

    async upsertSetting(data: {
      key: string;
      value: unknown;
      category?: SettingCategory;
      description?: string;
    }): Promise<Setting> {
      const existing = settings.get(data.key);
      const now = new Date().toISOString();

      if (existing) {
        // Update existing
        const updated: Setting = {
          ...existing,
          value: data.value,
          category: data.category || existing.category,
          description: data.description !== undefined ? data.description : existing.description,
          updated_at: now
        };
        settings.set(data.key, updated);
        return updated;
      }

      // Create new
      const newSetting: Setting = {
        id: generateId(),
        key: data.key,
        value: data.value,
        category: data.category || 'general',
        description: data.description || null,
        created_at: now,
        updated_at: now
      };
      settings.set(data.key, newSetting);
      return newSetting;
    },

    async deleteSetting(key: string): Promise<void> {
      settings.delete(key);
    },

    // Test helpers
    addSetting(setting: Setting): void {
      settings.set(setting.key, setting);
    },

    clear(): void {
      settings.clear();
    },

    getAllSettingsRaw(): Setting[] {
      return Array.from(settings.values());
    }
  };
}
