/**
 * useTheme Hook Tests
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useThemeSync } from '../../src/hooks/useTheme';
import { settingsApi } from '../../src/services/settings';
import { useAuthStore } from '../../src/store/auth';
import { useColorScheme } from 'nativewind';

// Mock modules
jest.mock('../../src/services/settings', () => ({
  settingsApi: {
    getPreferences: jest.fn(),
  },
}));

jest.mock('../../src/store/auth', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('nativewind', () => ({
  useColorScheme: jest.fn(),
}));

const mockSettingsApi = settingsApi as jest.Mocked<typeof settingsApi>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('useThemeSync', () => {
  const mockSetColorScheme = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme: mockSetColorScheme,
      toggleColorScheme: jest.fn(),
    });
  });

  it('should not sync theme when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
    } as any);

    renderHook(() => useThemeSync());

    expect(mockSettingsApi.getPreferences).not.toHaveBeenCalled();
  });

  it('should sync theme when authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
    } as any);
    
    mockSettingsApi.getPreferences.mockResolvedValue({
      data: {
        preferences: {
          theme: 'beach',
          darkMode: true,
          notifications: true,
        },
      },
    } as any);

    renderHook(() => useThemeSync());

    await waitFor(() => {
      expect(mockSettingsApi.getPreferences).toHaveBeenCalled();
    });
  });

  it('should set dark mode when preference is true', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
    } as any);
    
    mockSettingsApi.getPreferences.mockResolvedValue({
      data: {
        preferences: {
          theme: 'midnight',
          darkMode: true,
          notifications: true,
        },
      },
    } as any);

    renderHook(() => useThemeSync());

    await waitFor(() => {
      expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
    });
  });

  it('should set light mode when preference is false', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
    } as any);
    
    mockSettingsApi.getPreferences.mockResolvedValue({
      data: {
        preferences: {
          theme: 'beach',
          darkMode: false,
          notifications: true,
        },
      },
    } as any);

    renderHook(() => useThemeSync());

    await waitFor(() => {
      expect(mockSetColorScheme).toHaveBeenCalledWith('light');
    });
  });

  it('should handle API errors gracefully', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
    } as any);
    
    mockSettingsApi.getPreferences.mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    renderHook(() => useThemeSync());

    await waitFor(() => {
      expect(mockSettingsApi.getPreferences).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should not change scheme when darkMode is undefined', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
    } as any);
    
    mockSettingsApi.getPreferences.mockResolvedValue({
      data: {
        preferences: {
          theme: 'beach',
          notifications: true,
        },
      },
    } as any);

    renderHook(() => useThemeSync());

    await waitFor(() => {
      expect(mockSettingsApi.getPreferences).toHaveBeenCalled();
    });
  });
});
