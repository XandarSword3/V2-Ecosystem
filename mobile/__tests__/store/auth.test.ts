/**
 * Auth Store Tests
 * 
 * Comprehensive test coverage for useAuthStore including:
 * - Initialization
 * - Login (success/failure)
 * - Two-factor authentication
 * - Biometric authentication
 * - Registration (success/failure)
 * - Logout (single device/all devices)
 * - Token refresh
 * - Error handling
 * - State transitions
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/store/auth';
import { authApi, twoFactorApi, STORAGE_KEYS } from '../../src/api/client';
import { createMockUser, createMockAuthTokens } from '../__mocks__/fixtures';

declare global {
  function clearAllMockStorage(): void;
}

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
  twoFactorApi: {
    verifyLogin: jest.fn(),
    initiateSetup: jest.fn(),
    enableTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
    getStatus: jest.fn(),
    regenerateBackupCodes: jest.fn(),
    verifyWithBackupCode: jest.fn(),
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

// Mock biometric service
jest.mock('../../src/services/biometric', () => ({
  biometricService: {
    checkCapabilities: jest.fn().mockResolvedValue({
      isAvailable: true,
      biometricTypes: ['fingerprint'],
      isEnrolled: true,
      securityLevel: 'biometric',
    }),
    isBiometricLoginEnabled: jest.fn().mockResolvedValue(false),
    getBiometricCredentials: jest.fn().mockResolvedValue(null),
    enableBiometricLogin: jest.fn().mockResolvedValue({ success: true }),
    disableBiometricLogin: jest.fn().mockResolvedValue(undefined),
    clearBiometricData: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockTwoFactorApi = twoFactorApi as jest.Mocked<typeof twoFactorApi>;

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,
      twoFactorPending: null,
      twoFactorStatus: null,
      twoFactorSetup: null,
      biometricCapabilities: null,
      isBiometricEnabled: false,
    });
    
    jest.clearAllMocks();
    global.clearAllMockStorage();
    
    // Default mock for 2FA status (called after successful login)
    mockTwoFactorApi.getStatus.mockResolvedValue({
      success: true,
      data: { enabled: false, method: null, backupCodesRemaining: 0 },
    });
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

  // =========================================================================
  // Two-Factor Authentication Tests
  // =========================================================================

  describe('Two-Factor Authentication', () => {
    it('should set twoFactorPending when login requires 2FA', async () => {
      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: {
          requiresTwoFactor: true,
          userId: 'user-123',
          email: 'test@example.com',
        },
      } as any);

      const { result } = renderHook(() => useAuthStore());

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password');
      });

      expect(loginResult).toBe(false); // Not fully authenticated
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.twoFactorPending).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should complete login after successful 2FA verification', async () => {
      const mockUser = createMockUser();
      
      // Set up pending 2FA
      useAuthStore.setState({
        twoFactorPending: {
          userId: 'user-123',
          email: 'test@example.com',
        },
      });

      mockTwoFactorApi.verifyLogin.mockResolvedValue({
        success: true,
        data: {
          ...createMockAuthTokens(),
          user: mockUser,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      let verifyResult: boolean = false;
      await act(async () => {
        verifyResult = await result.current.verify2FA('123456');
      });

      expect(verifyResult).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.twoFactorPending).toBeNull();
      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle invalid 2FA code', async () => {
      useAuthStore.setState({
        twoFactorPending: {
          userId: 'user-123',
          email: 'test@example.com',
        },
      });

      mockTwoFactorApi.verifyLogin.mockResolvedValue({
        success: false,
        error: 'Invalid code',
      });

      const { result } = renderHook(() => useAuthStore());

      let verifyResult: boolean = false;
      await act(async () => {
        verifyResult = await result.current.verify2FA('000000');
      });

      expect(verifyResult).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid code');
    });

    it('should cancel 2FA flow', async () => {
      useAuthStore.setState({
        twoFactorPending: {
          userId: 'user-123',
          email: 'test@example.com',
        },
        error: 'Invalid code',
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.cancel2FA();
      });

      expect(result.current.twoFactorPending).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should verify with backup code', async () => {
      const mockUser = createMockUser();
      
      useAuthStore.setState({
        twoFactorPending: {
          userId: 'user-123',
          email: 'test@example.com',
        },
      });

      mockTwoFactorApi.verifyWithBackupCode.mockResolvedValue({
        success: true,
        data: {
          ...createMockAuthTokens(),
          user: mockUser,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      let verifyResult: boolean = false;
      await act(async () => {
        verifyResult = await result.current.verify2FABackup('backup-code-123');
      });

      expect(verifyResult).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should initiate 2FA setup', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: createMockUser(),
      });

      mockTwoFactorApi.initiateSetup.mockResolvedValue({
        success: true,
        data: {
          secret: 'JBSWY3DPEHPK3PXP',
          qrCodeUrl: 'data:image/png;base64,xxx',
          backupCodes: ['code1', 'code2', 'code3'],
        },
      });

      const { result } = renderHook(() => useAuthStore());

      let setupResult: boolean = false;
      await act(async () => {
        setupResult = await result.current.initiate2FASetup();
      });

      expect(setupResult).toBe(true);
      expect(result.current.twoFactorSetup).not.toBeNull();
      expect(result.current.twoFactorSetup?.secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('should enable 2FA with valid code', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: createMockUser(),
        twoFactorSetup: {
          secret: 'JBSWY3DPEHPK3PXP',
          qrCodeUrl: 'data:image/png;base64,xxx',
          backupCodes: ['code1', 'code2', 'code3'],
        },
      });

      mockTwoFactorApi.enableTwoFactor.mockResolvedValue({
        success: true,
        data: { backupCodes: ['code1', 'code2', 'code3'] },
      });

      const { result } = renderHook(() => useAuthStore());

      let enableResult: boolean = false;
      await act(async () => {
        enableResult = await result.current.enable2FA('123456');
      });

      expect(enableResult).toBe(true);
      expect(result.current.twoFactorSetup).toBeNull();
    });

    it('should disable 2FA', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: createMockUser(),
        twoFactorStatus: { enabled: true, method: 'totp', backupCodesRemaining: 5 },
      });

      mockTwoFactorApi.disableTwoFactor.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useAuthStore());

      let disableResult: boolean = false;
      await act(async () => {
        disableResult = await result.current.disable2FA('password', '123456');
      });

      expect(disableResult).toBe(true);
      expect(result.current.twoFactorStatus?.enabled).toBe(false);
    });

    it('should regenerate backup codes', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: createMockUser(),
        twoFactorStatus: { enabled: true, method: 'totp', backupCodesRemaining: 2 },
      });

      const newCodes = ['new-code-1', 'new-code-2', 'new-code-3', 'new-code-4', 'new-code-5'];
      
      mockTwoFactorApi.regenerateBackupCodes.mockResolvedValue({
        success: true,
        data: { backupCodes: newCodes },
      });

      const { result } = renderHook(() => useAuthStore());

      let codes: string[] | null = null;
      await act(async () => {
        codes = await result.current.regenerateBackupCodes('password');
      });

      expect(codes).toEqual(newCodes);
      expect(result.current.twoFactorStatus?.backupCodesRemaining).toBe(5);
    });

    it('should return null if no pending 2FA when verifying', async () => {
      const { result } = renderHook(() => useAuthStore());

      let verifyResult: boolean = false;
      await act(async () => {
        verifyResult = await result.current.verify2FA('123456');
      });

      expect(verifyResult).toBe(false);
      expect(result.current.error).toBe('No 2FA verification pending');
    });
  });

  // =========================================================================
  // Biometric Authentication Tests
  // =========================================================================

  describe('Biometric Authentication', () => {
    it('should check biometric capabilities', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkBiometricCapabilities();
      });

      expect(result.current.biometricCapabilities).not.toBeNull();
      expect(result.current.biometricCapabilities?.isAvailable).toBe(true);
      expect(result.current.biometricCapabilities?.biometricTypes).toContain('fingerprint');
    });

    it('should enable biometric login', async () => {
      const mockUser = createMockUser();
      useAuthStore.setState({
        isAuthenticated: true,
        user: mockUser,
      });

      const { biometricService } = require('../../src/services/biometric');
      biometricService.enableBiometricLogin.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuthStore());

      let enableResult: boolean = false;
      await act(async () => {
        enableResult = await result.current.enableBiometricLogin('password123');
      });

      expect(enableResult).toBe(true);
      expect(result.current.isBiometricEnabled).toBe(true);
    });

    it('should fail to enable biometric login without user', async () => {
      const { result } = renderHook(() => useAuthStore());

      let enableResult: boolean = false;
      await act(async () => {
        enableResult = await result.current.enableBiometricLogin('password123');
      });

      expect(enableResult).toBe(false);
      expect(result.current.error).toBe('No user logged in');
    });

    it('should disable biometric login', async () => {
      useAuthStore.setState({
        isBiometricEnabled: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.disableBiometricLogin();
      });

      expect(result.current.isBiometricEnabled).toBe(false);
    });

    it('should login with biometric credentials', async () => {
      const mockUser = createMockUser();
      const { biometricService } = require('../../src/services/biometric');
      
      biometricService.getBiometricCredentials.mockResolvedValue({
        email: 'biometric@test.com',
        encryptedPassword: 'stored-password',
        createdAt: new Date().toISOString(),
      });

      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: {
          ...createMockAuthTokens(),
          user: mockUser,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.loginWithBiometric();
      });

      expect(loginResult).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockAuthApi.login).toHaveBeenCalledWith('biometric@test.com', 'stored-password');
    });

    it('should fail biometric login when no credentials stored', async () => {
      const { biometricService } = require('../../src/services/biometric');
      biometricService.getBiometricCredentials.mockResolvedValue(null);

      const { result } = renderHook(() => useAuthStore());

      let loginResult: boolean = false;
      await act(async () => {
        loginResult = await result.current.loginWithBiometric();
      });

      expect(loginResult).toBe(false);
      expect(result.current.error).toBe('Biometric authentication failed');
    });
  });
});
