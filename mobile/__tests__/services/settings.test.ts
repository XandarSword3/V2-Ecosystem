/**
 * Settings Service Tests
 */
import { settingsApi, UserPreferences } from '../../src/services/settings';
import { apiClient } from '../../src/api/client';

// Mock the API client
jest.mock('../../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('settingsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should fetch user preferences', async () => {
      const mockPreferences: UserPreferences = {
        theme: 'beach',
        darkMode: false,
        notifications: true,
      };
      
      mockApiClient.get.mockResolvedValue({
        data: { preferences: mockPreferences },
      });

      const result = await settingsApi.getPreferences();

      expect(mockApiClient.get).toHaveBeenCalledWith('/users/me/preferences');
      expect(result.data?.preferences).toEqual(mockPreferences);
    });

    it('should handle API errors', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(settingsApi.getPreferences()).rejects.toThrow('Network error');
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const updatedPreferences: Partial<UserPreferences> = {
        darkMode: true,
      };
      
      mockApiClient.put.mockResolvedValue({
        data: {
          preferences: {
            theme: 'beach',
            darkMode: true,
            notifications: true,
          },
        },
      });

      const result = await settingsApi.updatePreferences(updatedPreferences);

      expect(mockApiClient.put).toHaveBeenCalledWith('/users/me/preferences', updatedPreferences);
      expect(result.data?.preferences.darkMode).toBe(true);
    });

    it('should update multiple preferences', async () => {
      const updatedPreferences: Partial<UserPreferences> = {
        theme: 'mountain',
        notifications: false,
      };
      
      mockApiClient.put.mockResolvedValue({
        data: {
          preferences: {
            theme: 'mountain',
            darkMode: false,
            notifications: false,
          },
        },
      });

      const result = await settingsApi.updatePreferences(updatedPreferences);

      expect(mockApiClient.put).toHaveBeenCalledWith('/users/me/preferences', updatedPreferences);
      expect(result.data?.preferences.theme).toBe('mountain');
      expect(result.data?.preferences.notifications).toBe(false);
    });

    it('should handle API errors when updating', async () => {
      mockApiClient.put.mockRejectedValue(new Error('Failed to update'));

      await expect(settingsApi.updatePreferences({ darkMode: true })).rejects.toThrow('Failed to update');
    });
  });
});
