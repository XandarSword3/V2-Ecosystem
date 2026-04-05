/**
 * In-Memory Settings Repository
 * Test double for SettingsRepository using in-memory data structures.
 */

import type { SettingsRepository, Setting, SettingCategory } from '../container/types.js';

export interface InMemorySettingsRepo extends SettingsRepository {
  addSetting(setting: Setting): void;
  reset(): void;
}

export function createInMemorySettingsRepository(): InMemorySettingsRepo {
  const settings = new Map<string, Setting>();

  return {
    addSetting(setting: Setting) {
      settings.set(setting.key, setting);
    },
    reset() {
      settings.clear();
    },

    async getAllSettings() {
      return [...settings.values()];
    },

    async getSettingsByCategory(category: SettingCategory) {
      return [...settings.values()].filter(s => s.category === category);
    },

    async getSettingByKey(key: string) {
      return settings.get(key) ?? null;
    },

    async upsertSetting(data) {
      const existing = settings.get(data.key);
      const now = new Date().toISOString();
      const setting: Setting = {
        id: existing?.id ?? crypto.randomUUID(),
        key: data.key,
        value: data.value,
        category: data.category ?? existing?.category ?? 'general',
        description: data.description ?? existing?.description ?? null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      settings.set(data.key, setting);
      return setting;
    },

    async deleteSetting(key: string) {
      settings.delete(key);
    },
  };
}
