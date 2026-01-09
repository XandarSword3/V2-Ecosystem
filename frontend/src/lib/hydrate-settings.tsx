import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settingsStore';

export function HydrateSettingsFromBackend() {
  useEffect(() => {
    async function hydrate() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl.replace(/\/api\/?$/, '')}/api/settings`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.data) {
          if (data.data.theme) {
            useSettingsStore.getState().setResortTheme(data.data.theme);
          }
          if (typeof data.data.animationsEnabled === 'boolean') {
            useSettingsStore.getState().setAnimationsEnabled(data.data.animationsEnabled);
          }
          if (typeof data.data.reducedMotion === 'boolean') {
            useSettingsStore.getState().setReducedMotion(data.data.reducedMotion);
          }
          if (typeof data.data.soundEnabled === 'boolean') {
            useSettingsStore.getState().setSoundEnabled(data.data.soundEnabled);
          }
        }
      } catch (err) {
        // Silent fail, fallback to defaults
      }
    }
    hydrate();
  }, []);
  return null;
}
