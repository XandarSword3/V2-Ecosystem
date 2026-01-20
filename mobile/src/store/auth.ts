/**
 * Auth Store (Zustand)
 * 
 * Manages authentication state across the app.
 * Uses Zustand for state management with persist.
 */

import { create } from 'zustand';
import { authApi, User, AuthTokens } from '../api/client';
import { unregisterDevice } from '../services/push-notifications';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  /**
   * Initialize auth state from storage
   */
  initialize: async () => {
    try {
      set({ isLoading: true });
      
      const isAuth = await authApi.isAuthenticated();
      
      if (isAuth) {
        const storedUser = await authApi.getStoredUser();
        
        if (storedUser) {
          set({
            user: storedUser,
            isAuthenticated: true,
          });
        } else {
          // Try to fetch user from API
          try {
            const response = await authApi.getMe();
            if (response.success && response.data) {
              set({
                user: response.data,
                isAuthenticated: true,
              });
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
    set({ isLoading: true, error: null });
    
    try {
      const response = await authApi.login(email, password);
      
      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
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
      });
    }
  },

  /**
   * Logout from all devices
   */
  logoutAll: async () => {
    set({ isLoading: true });
    
    try {
      await authApi.logoutAll();
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
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
}));

export default useAuthStore;
