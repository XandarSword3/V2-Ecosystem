import { getSupabase } from '../../../database/connection.js';
import { emitToAll } from '../../../socket/index.js';

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  category?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

interface SettingsMap {
  [key: string]: unknown;
}

export class SettingsService {
  private supabase = getSupabase();

  async getAllSettings(): Promise<SettingsMap> {
    const { data, error } = await this.supabase
      .from('settings')
      .select('key, value');

    if (error) throw error;

    const settings: SettingsMap = {};
    ((data || []) as SettingRow[]).forEach(row => {
      settings[row.key] = row.value;
    });

    return settings;
  }

  async getSettingsByCategory(category: string): Promise<SettingsMap> {
    const { data, error } = await this.supabase
      .from('settings')
      .select('key, value')
      .eq('category', category);

    if (error) throw error;

    const settings: SettingsMap = {};
    ((data || []) as SettingRow[]).forEach(row => {
      settings[row.key] = row.value;
    });

    return settings;
  }

  async getSetting(key: string): Promise<unknown> {
    const { data, error } = await this.supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data?.value;
  }

  async updateSetting(key: string, value: unknown, category?: string): Promise<void> {
    const { error } = await this.supabase
      .from('settings')
      .upsert({
        key,
        value,
        category,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (error) throw error;

    // Emit socket event for real-time updates
    emitToAll('settings:updated', { key, value });
  }

  async updateMultipleSettings(settings: Record<string, unknown>, category?: string): Promise<void> {
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      category,
      updated_at: new Date().toISOString()
    }));

    for (const update of updates) {
      const { error } = await this.supabase
        .from('settings')
        .upsert(update, { onConflict: 'key' });

      if (error) throw error;
    }

    // Emit socket event for real-time updates
    emitToAll('settings:bulk-updated', settings);
  }

  async deleteSetting(key: string): Promise<void> {
    const { error } = await this.supabase
      .from('settings')
      .delete()
      .eq('key', key);

    if (error) throw error;
    
    emitToAll('settings:deleted', { key });
  }

  // Specialized settings methods
  async getNavbarConfig(): Promise<unknown> {
    return this.getSetting('navbar');
  }

  async updateNavbarConfig(config: unknown): Promise<void> {
    await this.updateSetting('navbar', config, 'appearance');
  }

  async getFooterConfig(): Promise<unknown> {
    return this.getSetting('footer');
  }

  async updateFooterConfig(config: unknown): Promise<void> {
    await this.updateSetting('footer', config, 'appearance');
  }

  async getAppearanceSettings(): Promise<SettingsMap> {
    return this.getSettingsByCategory('appearance');
  }

  async getBusinessSettings(): Promise<SettingsMap> {
    return this.getSettingsByCategory('business');
  }
}

export const settingsService = new SettingsService();
