/**
 * Auth Store Tests
 * 
 * Comprehensive test coverage for useAuthStore including:
 * - Initialization
 * - Login (success/failure)
 * - Registration (success/failure)
 * - Logout (single device/all devices)
 * - Token refresh
 * - Error handling
 * - State transitions
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/store/auth';
import { authApi, STORAGE_KEYS } from '../../src/api/client';
import { createMockUser, createMockAuthTokens } from '../__mocks__/fixtures';

// Mock the API client module
jest.mock('../../src/api/client', () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    getMe: jest.fn(),
    isAuthenticated: jest.fn(),
    getStoredUser: jest.fn(),
  },
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'v2_access_token',
    REFRESH_TOKEN: 'v2_refresh_token',
    USER_DATA: 'v2_user_data',
    DEVICE_ID: 'v2_device_id',
  },
}));

// Mock push notifications service
jest.mock('../../src/services/push-notifications', () => ({
  unregisterDevice: jest.fn().mockResolvedValue(true),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
    
    jest.clearAllMocks();
    global.clearAllMockStorage();
  });

  // =========================================================================
  // Initial State Tests
  // =========================================================================

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide all expected actions', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(typeof result.current.initialize).toBe('function');
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.register).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.logoutAll).toBe('function');
      expect(typeof result.current.refreshUser).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  // =========================================================================
  // Initialization Tests
  // =========================================================================

  describe('initialize()', () => {
    it('should set isInitialized to true after initialization', async () => {
      mockAuthApi.isAuthenticated.mockResolvedValue(false);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should load stored user when authenticated', async () => {
      const mockUser = createMockUser({ email: 'stored@test.com' });
      
      mockAuthApi.isAuthenticated.mockResolvedValue(true);
      mockAuthApi.getStoredUser.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isInitialized).toBe(true);
    });

    it('should fetch user from API when stored user not available', async () => {
      const mockUser = createMockUser({ email: 'api@test.com' });
      
      mockAuthApi.isAuthenticated.mockResolvedValue(true);
      mockAuthApi.getStoredUser.mockResolvedValue(null);
      mockAuthApi.getMe.mockResolvedValue({ success: true, data: mockUser });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockAuthApi.getMe).toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle API failure during initialization', async () => {
      mockAuthApi.isAuthenticated.mockResolvedValue(true);
      mockAuthApi.getStoredUser.mockResolvedValue(null);
      mockAuthApi.getMe.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isInitialized).toBe(true);
    });

    it('should set isLoading during initialization', async () => {
      mockAuthApi.isAuthenticated.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(false), 100))
      );

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.initialize();
      });

      // Check loading state immediately
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // =========================================================================
  // Login Tests
  // =========================================================================

  describe('login()', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = createMockUser({ email: 'test@example.com' });
      const mockTokens = createMockAuthTokens();

      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: {
          ...mockTokens,
          user: mockUser,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password123');
      });

      expect(loginResult).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle login failure with API error response', async () => {
      mockAuthApi.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const { result } = renderHook(() => useAuthStore());

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.login('wrong@email.com', 'wrongpass');
      });

      expect(loginResult).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe('Invalid credentials');
    });

    it('should handle login failure with network error', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useAuthStore());

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password');
      });

      expect(loginResult).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Network Error');
    });

    it('should handle login failure with axios error response', async () => {
      const axiosError = {
        response: {
          data: {
            error: 'Account locked',
          },
        },
      };
      mockAuthApi.login.mockRejectedValue(axiosError);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('locked@example.com', 'password');
      });

      expect(result.current.error).toBe('Account locked');
    });

    it('should set isLoading during login', async () => {
      mockAuthApi.login.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { ...createMockAuthTokens(), user: createMockUser() },
        }), 100))
      );

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.login('test@example.com', 'password');
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should clear previous error on new login attempt', async () => {
      // First, set an error
      useAuthStore.setState({ error: 'Previous error' });

      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: { ...createMockAuthTokens(), user: createMockUser() },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // Registration Tests
  // =========================================================================

  describe('register()', () => {
    it('should successfully register a new user', async () => {
      const mockUser = createMockUser({
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
      });
      const mockTokens = createMockAuthTokens();

      mockAuthApi.register.mockResolvedValue({
        success: true,
        data: {
          ...mockTokens,
          user: mockUser,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      let registerResult: boolean = false;
      await act(async () => {
        registerResult = await result.current.register({
          email: 'newuser@example.com',
          password: 'securePassword123',
          firstName: 'New',
          lastName: 'User',
        });
      });

      expect(registerResult).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
    });

    it('should handle registration failure with duplicate email', async () => {
      mockAuthApi.register.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      const { result } = renderHook(() => useAuthStore());

      let registerResult: boolean = false;
      await act(async () => {
        registerResult = await result.current.register({
          email: 'existing@example.com',
          password: 'password123',
        });
      });

      expect(registerResult).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Email already exists');
    });

    it('should handle registration failure with network error', async () => {
      mockAuthApi.register.mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register({
          email: 'test@example.com',
          password: 'password',
        });
      });

      expect(result.current.error).toBe('Network Error');
    });

    it('should include optional fields in registration', async () => {
      mockAuthApi.register.mockResolvedValue({
        success: true,
        data: {
          ...createMockAuthTokens(),
          user: createMockUser({ phone: '+1234567890' }),
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register({
          email: 'test@example.com',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
        });
      });

      expect(mockAuthApi.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
      });
    });
  });

  // =========================================================================
  // Logout Tests
  // =========================================================================

  describe('logout()', () => {
    it('should clear authentication state on logout', async () => {
      // Setup authenticated state
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockAuthApi.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should complete logout even if API call fails', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockAuthApi.logout.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set isLoading during logout', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockAuthApi.logout.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.logout();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // =========================================================================
  // Logout All Tests
  // =========================================================================

  describe('logoutAll()', () => {
    it('should clear authentication state on logout all', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockAuthApi.logoutAll.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should complete logout all even if API call fails', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockAuthApi.logoutAll.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  // =========================================================================
  // Refresh User Tests
  // =========================================================================

  describe('refreshUser()', () => {
    it('should update user data from API', async () => {
      const updatedUser = createMockUser({
        firstName: 'Updated',
        lastName: 'Name',
      });

      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockAuthApi.getMe.mockResolvedValue({
        success: true,
        data: updatedUser,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toEqual(updatedUser);
    });

    it('should not refresh if not authenticated', async () => {
      useAuthStore.setState({
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(mockAuthApi.getMe).not.toHaveBeenCalled();
    });

    it('should handle refresh failure gracefully', async () => {
      const originalUser = createMockUser();

      useAuthStore.setState({
        user: originalUser,
        isAuthenticated: true,
      });

      mockAuthApi.getMe.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshUser();
      });

      // User should remain unchanged on error
      expect(result.current.user).toEqual(originalUser);
    });
  });

  // =========================================================================
  // Clear Error Tests
  // =========================================================================

  describe('clearError()', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should not affect other state when clearing error', () => {
      const mockUser = createMockUser();

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        error: 'Some error',
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle concurrent login attempts', async () => {
      mockAuthApi.login.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { ...createMockAuthTokens(), user: createMockUser() },
        }), 50))
      );

      const { result } = renderHook(() => useAuthStore());

      // Start two login attempts simultaneously
      await act(async () => {
        const promises = [
          result.current.login('user1@test.com', 'password1'),
          result.current.login('user2@test.com', 'password2'),
        ];
        await Promise.all(promises);
      });

      // Should handle gracefully without crashing
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle empty response data', async () => {
      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: undefined,
      } as any);

      const { result } = renderHook(() => useAuthStore());

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password');
      });

      expect(loginResult).toBe(false);
      expect(result.current.error).toBe('Login failed');
    });

    it('should maintain state consistency after multiple operations', async () => {
      const mockUser = createMockUser();
      
      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: { ...createMockAuthTokens(), user: mockUser },
      });
      mockAuthApi.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuthStore());

      // Login
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      expect(result.current.isAuthenticated).toBe(true);

      // Logout
      await act(async () => {
        await result.current.logout();
      });
      expect(result.current.isAuthenticated).toBe(false);

      // Login again
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });
  });
});
