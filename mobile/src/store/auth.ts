/**
 * Auth Store (Zustand)
 * 
 * Manages authentication state across the app.
 * Features:
 * - Standard email/password login
 * - Two-factor authentication (2FA/TOTP)
 * - Biometric authentication
 * - Session management
 */

import { create } from 'zustand';
import { 
  authApi, 
  twoFactorApi,
  User, 
  AuthTokens, 
  TwoFactorRequired,
  TwoFactorSetup,
  TwoFactorStatus,
} from '../api/client';
import { unregisterDevice } from '../services/push-notifications';
import { biometricService, BiometricCapabilities } from '../services/biometric';

// Type guard for 2FA required response
export function isTwoFactorRequired(result: any): result is TwoFactorRequired {
  return result && result.requiresTwoFactor === true;
}

export interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // 2FA State
  twoFactorPending: {
    userId: string;
    email: string;
  } | null;
  twoFactorStatus: TwoFactorStatus | null;
  twoFactorSetup: TwoFactorSetup | null;
  
  // Biometric State
  biometricCapabilities: BiometricCapabilities | null;
  isBiometricEnabled: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithBiometric: () => Promise<boolean>;
  verify2FA: (code: string) => Promise<boolean>;
  verify2FABackup: (backupCode: string) => Promise<boolean>;
  cancel2FA: () => void;
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  
  // 2FA Management
  initiate2FASetup: () => Promise<boolean>;
  enable2FA: (code: string) => Promise<boolean>;
  disable2FA: (password: string, code?: string) => Promise<boolean>;
  refresh2FAStatus: () => Promise<void>;
  regenerateBackupCodes: (password: string) => Promise<string[] | null>;
  
  // Biometric Management
  checkBiometricCapabilities: () => Promise<void>;
  enableBiometricLogin: (password: string) => Promise<boolean>;
  disableBiometricLogin: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  
  // 2FA State
  twoFactorPending: null,
  twoFactorStatus: null,
  twoFactorSetup: null,
  
  // Biometric State
  biometricCapabilities: null,
  isBiometricEnabled: false,

  /**
   * Initialize auth state from storage
   */
  initialize: async () => {
    try {
      set({ isLoading: true });
      
      // Check biometric capabilities
      const capabilities = await biometricService.checkCapabilities();
      const biometricEnabled = await biometricService.isBiometricLoginEnabled();
      
      set({
        biometricCapabilities: capabilities,
        isBiometricEnabled: biometricEnabled,
      });
      
      const isAuth = await authApi.isAuthenticated();
      
      if (isAuth) {
        const storedUser = await authApi.getStoredUser();
        
        if (storedUser) {
          set({
            user: storedUser,
            isAuthenticated: true,
          });
          
          // Fetch 2FA status in background
          get().refresh2FAStatus();
        } else {
          // Try to fetch user from API
          try {
            const response = await authApi.getMe();
            if (response.success && response.data) {
              set({
                user: response.data,
                isAuthenticated: true,
              });
              get().refresh2FAStatus();
            }
          } catch {
            // Token might be invalid
            set({ isAuthenticated: false, user: null });
          }
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isAuthenticated: false, user: null });
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  /**
   * Login user
   */
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null, twoFactorPending: null });
    
    try {
      const response = await authApi.login(email, password);
      
      if (response.success && response.data) {
        // Check if 2FA is required
        if (isTwoFactorRequired(response.data)) {
          set({
            twoFactorPending: {
              userId: response.data.userId,
              email: response.data.email,
            },
            isLoading: false,
          });
          return false; // Not fully authenticated yet
        }
        
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
          twoFactorPending: null,
        });
        
        // Fetch 2FA status
        get().refresh2FAStatus();
        
        return true;
      } else {
        set({
          error: response.error || 'Login failed',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Login with biometric authentication
   */
  loginWithBiometric: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const credentials = await biometricService.getBiometricCredentials();
      
      if (!credentials) {
        set({
          error: 'Biometric authentication failed',
          isLoading: false,
        });
        return false;
      }
      
      // Login with stored credentials
      return await get().login(credentials.email, credentials.encryptedPassword);
    } catch (error: any) {
      set({
        error: error.message || 'Biometric login failed',
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Verify 2FA code
   */
  verify2FA: async (code: string) => {
    const pending = get().twoFactorPending;
    
    if (!pending) {
      set({ error: 'No 2FA verification pending' });
      return false;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const response = await twoFactorApi.verifyLogin(pending.userId, code);
      
      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
          twoFactorPending: null,
        });
        
        get().refresh2FAStatus();
        return true;
      } else {
        set({
          error: response.error || 'Invalid code',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Verification failed';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Verify with backup code
   */
  verify2FABackup: async (backupCode: string) => {
    const pending = get().twoFactorPending;
    
    if (!pending) {
      set({ error: 'No 2FA verification pending' });
      return false;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const response = await twoFactorApi.verifyWithBackupCode(pending.userId, backupCode);
      
      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
          twoFactorPending: null,
        });
        
        get().refresh2FAStatus();
        return true;
      } else {
        set({
          error: response.error || 'Invalid backup code',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Verification failed';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Cancel 2FA verification flow
   */
  cancel2FA: () => {
    set({ twoFactorPending: null, error: null });
  },

  /**
   * Register new user
   */
  register: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await authApi.register(data);
      
      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      } else {
        set({
          error: response.error || 'Registration failed',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Logout from current device
   */
  logout: async () => {
    set({ isLoading: true });
    
    try {
      // Unregister push notifications
      await unregisterDevice();
      
      // Clear biometric credentials
      await biometricService.clearBiometricData();
      
      // Logout from API
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        twoFactorPending: null,
        twoFactorStatus: null,
        twoFactorSetup: null,
        isBiometricEnabled: false,
      });
    }
  },

  /**
   * Logout from all devices
   */
  logoutAll: async () => {
    set({ isLoading: true });
    
    try {
      // Clear biometric credentials
      await biometricService.clearBiometricData();
      
      await authApi.logoutAll();
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        twoFactorPending: null,
        twoFactorStatus: null,
        twoFactorSetup: null,
        isBiometricEnabled: false,
      });
    }
  },

  /**
   * Refresh user data from API
   */
  refreshUser: async () => {
    if (!get().isAuthenticated) return;
    
    try {
      const response = await authApi.getMe();
      
      if (response.success && response.data) {
        set({ user: response.data });
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },

  // =========================================================================
  // 2FA Management Methods
  // =========================================================================

  /**
   * Initiate 2FA setup - get QR code and secret
   */
  initiate2FASetup: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await twoFactorApi.initiateSetup();
      
      if (response.success && response.data) {
        set({
          twoFactorSetup: response.data,
          isLoading: false,
        });
        return true;
      } else {
        set({
          error: response.error || 'Failed to initiate 2FA setup',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '2FA setup failed';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Enable 2FA with verification code
   */
  enable2FA: async (code: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await twoFactorApi.enableTwoFactor(code);
      
      if (response.success) {
        set({
          twoFactorSetup: null,
          isLoading: false,
        });
        
        // Refresh 2FA status
        await get().refresh2FAStatus();
        
        return true;
      } else {
        set({
          error: response.error || 'Invalid code',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to enable 2FA';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Disable 2FA
   */
  disable2FA: async (password: string, code?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await twoFactorApi.disableTwoFactor(password, code);
      
      if (response.success) {
        set({
          twoFactorStatus: { enabled: false, method: null, backupCodesRemaining: 0 },
          isLoading: false,
        });
        return true;
      } else {
        set({
          error: response.error || 'Failed to disable 2FA',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to disable 2FA';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Refresh 2FA status from API
   */
  refresh2FAStatus: async () => {
    if (!get().isAuthenticated) return;
    
    try {
      const response = await twoFactorApi.getStatus();
      
      if (response.success && response.data) {
        set({ twoFactorStatus: response.data });
      }
    } catch (error) {
      // Non-critical, silently fail
      console.warn('Failed to fetch 2FA status:', error);
    }
  },

  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes: async (password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await twoFactorApi.regenerateBackupCodes(password);
      
      if (response.success && response.data) {
        // Update backup codes count
        const currentStatus = get().twoFactorStatus;
        if (currentStatus) {
          set({
            twoFactorStatus: {
              ...currentStatus,
              backupCodesRemaining: response.data.backupCodes.length,
            },
          });
        }
        
        set({ isLoading: false });
        return response.data.backupCodes;
      } else {
        set({
          error: response.error || 'Failed to regenerate backup codes',
          isLoading: false,
        });
        return null;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to regenerate backup codes';
      set({
        error: errorMessage,
        isLoading: false,
      });
      return null;
    }
  },

  // =========================================================================
  // Biometric Management Methods
  // =========================================================================

  /**
   * Check device biometric capabilities
   */
  checkBiometricCapabilities: async () => {
    try {
      const capabilities = await biometricService.checkCapabilities();
      const isEnabled = await biometricService.isBiometricLoginEnabled();
      
      set({
        biometricCapabilities: capabilities,
        isBiometricEnabled: isEnabled,
      });
    } catch (error) {
      console.error('Failed to check biometric capabilities:', error);
    }
  },

  /**
   * Enable biometric login
   */
  enableBiometricLogin: async (password: string) => {
    const user = get().user;
    
    if (!user?.email) {
      set({ error: 'No user logged in' });
      return false;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const result = await biometricService.enableBiometricLogin(user.email, password);
      
      if (result.success) {
        set({
          isBiometricEnabled: true,
          isLoading: false,
        });
        return true;
      } else {
        set({
          error: result.error || 'Failed to enable biometric login',
          isLoading: false,
        });
        return false;
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to enable biometric login',
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Disable biometric login
   */
  disableBiometricLogin: async () => {
    try {
      await biometricService.disableBiometricLogin();
      set({ isBiometricEnabled: false });
    } catch (error) {
      console.error('Failed to disable biometric login:', error);
    }
  },
}));

export default useAuthStore;
