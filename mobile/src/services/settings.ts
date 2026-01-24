import { apiClient } from '../api/client';

export interface UserPreferences {
  theme: 'beach' | 'mountain' | 'sunset' | 'forest' | 'midnight';
  darkMode: boolean;
  notifications: boolean;
}

export const settingsApi = {
  getPreferences: async () => {
    return apiClient.get<{ preferences: UserPreferences }>('/users/me/preferences');
  },
  
  updatePreferences: async (preferences: Partial<UserPreferences>) => {
    return apiClient.put<{ preferences: UserPreferences }>('/users/me/preferences', preferences);
  },
};
