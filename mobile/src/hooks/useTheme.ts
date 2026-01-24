import { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { settingsApi } from '../services/settings';
import { useAuthStore } from '../store/auth';

export function useThemeSync() {
  const { setColorScheme } = useColorScheme();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    const syncTheme = async () => {
      try {
        const response = await settingsApi.getPreferences();
        if (response.data?.preferences?.darkMode !== undefined) {
          setColorScheme(response.data.preferences.darkMode ? 'dark' : 'light');
        }
      } catch (error) {
        console.log('Failed to sync theme', error);
      }
    };

    syncTheme();
  }, [isAuthenticated]);
}
