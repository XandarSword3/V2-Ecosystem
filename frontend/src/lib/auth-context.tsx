'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL, memoryTokenStore, refreshAccessToken } from './api';
import { useCartStore } from '@/stores/cartStore';
import { authLogger } from './logger';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  profileImageUrl?: string;
  preferredLanguage: string;
  scope?: string;
  roles: string[];
  is_platform_admin?: boolean;
}

interface TwoFactorRequired {
  requiresTwoFactor: true;
  userId: string;
  email: string;
}

// Privileged account with no 2FA enrolled yet — login() is blocked (403)
// until the user completes setup using twoFactorSetupToken.
interface TwoFactorSetupRequired {
  requiresTwoFactorSetup: true;
  userId: string;
  email: string;
  twoFactorSetupToken: string;
}

interface LoginResult {
  user: User;
  requiresTwoFactor?: false;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<User | TwoFactorRequired | TwoFactorSetupRequired>;
  verify2FA: (userId: string, code: string) => Promise<User>;
  completeTwoFactorSetupLogin: (user: User, accessToken: string) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearCart = useCartStore((state) => state.clearCart);

  // Centralized session cleanup helper
  const clearLocalSession = useCallback(() => {
    memoryTokenStore.clear();
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('activePropertyId');
    document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
    clearCart();
    queryClient.clear();
    setUser(null);
  }, [clearCart, queryClient]);

  // Helper to notify other tabs of auth events
  const notifyAuthEvent = useCallback((type: 'LOGIN' | 'LOGOUT') => {
    if (typeof window === 'undefined') return;

    // Try BroadcastChannel first
    try {
      const channel = new BroadcastChannel('auth_sync');
      channel.postMessage({ type });
      channel.close();
    } catch (e) {
      // BroadcastChannel not supported, fall back to storage event
      // Storage events fire across tabs when localStorage changes
      const eventId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('auth_event', JSON.stringify({ type, timestamp: Date.now(), eventId }));
      // No immediate removal - let listener handle timestamp validation
    }
  }, []);

  useEffect(() => {
    // Handle OAuth callback - check for tokens in URL
    const handleOAuthCallback = () => {
      if (typeof window === 'undefined') return false;

      const params = new URLSearchParams(window.location.search);
      const oauth = params.get('oauth');
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');

      if (oauth === 'success' && accessToken && refreshToken) {
        // Store tokens from OAuth callback
        memoryTokenStore.set(accessToken);
        // localStorage.setItem('accessToken', accessToken); // Deprecated
        // localStorage.setItem('refreshToken', refreshToken); // Deprecated
        // Set accessToken cookie for middleware to read
        document.cookie = `accessToken=${accessToken}; path=/; max-age=604800; SameSite=Lax`;

        // Clean URL by removing OAuth params
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);

        authLogger.info('OAuth tokens received and stored');
        return true;
      }
      return false;
    };

    // Validate stored credentials on mount by checking with the server
    const validateSession = async () => {
      // First check for OAuth callback
      const oauthHandled = handleOAuthCallback();

      const storedUser = localStorage.getItem('user');
      let accessToken = memoryTokenStore.get();

      // Backward compatibility: if memory store is empty, check localStorage
      if (!accessToken) {
        accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
          memoryTokenStore.set(accessToken);
        }
      }

      // If we have the companion flag (indicating a valid session exists) but no access token,
      // try to refresh using the httpOnly refresh token cookie. This enables cross-tab session
      // recovery without guessing. The companion flag is set on login and cleared on logout.
      const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
      if (!accessToken && isAuthenticated) {
        try {
          accessToken = await refreshAccessToken();
          // We only have the token from the shared helper, not the user payload
          // (the helper doesn't expose it). Fall through to /auth/me below to
          // fetch and validate the user, same as the normal path.
        } catch (refreshError: any) {
          const status = refreshError?.response?.status;
          // Only a definitive rejection from the auth server (401/403) means
          // the refresh token is actually invalid. 429 (rate limited), 5xx,
          // and network errors are transient — treating them as "session
          // invalid" caused a login -> refresh -> 429 -> logout loop
          // whenever the refresh-endpoint rate limiter was already warm
          // (e.g. right after a prior loop, or concurrent mounts). Keep the
          // stored session in those cases; the api.ts response interceptor
          // will retry/refresh again on the next real request.
          if (status === 401 || status === 403) {
            authLogger.warn('Token refresh rejected, clearing credentials', { status });
            clearLocalSession();
          } else {
            authLogger.warn('Token refresh unavailable (transient), keeping session', { status });
          }
          setIsLoading(false);
          return;
        }
      }

      // If no access token (and OAuth didn't just set one, and refresh didn't work), nothing to validate
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        // Validate token with backend using the api instance (which handles token refresh)
        const response = await api.get('/auth/me');

        if (response.data.success && response.data.data) {
          // Use server-validated user data, not localStorage
          const validatedUser: User = {
            id: response.data.data.id,
            email: response.data.data.email,
            fullName: response.data.data.full_name || response.data.data.fullName,
            phone: response.data.data.phone,
            profileImageUrl: response.data.data.profile_image_url || response.data.data.profileImageUrl,
            preferredLanguage: response.data.data.preferred_language || response.data.data.preferredLanguage || 'en',
            scope: response.data.data.scope,
            roles: response.data.data.roles || [],
            is_platform_admin: response.data.data.is_platform_admin || false
          };
          setUser(validatedUser);
          // Update localStorage with validated data
          localStorage.setItem('user', JSON.stringify(validatedUser));

          // If this was an OAuth login, log success
          if (oauthHandled) {
            authLogger.info('OAuth login successful for:', validatedUser.email);
          }
        } else {
          throw new Error('Invalid session');
        }
      } catch (e) {
        // Clear invalid session data
        authLogger.warn('Session validation failed, clearing credentials');
        clearLocalSession();
      }

      setIsLoading(false);
    };

    validateSession();

    // BroadcastChannel listener for cross-tab sync
    let authChannel: BroadcastChannel | null = null;
    try {
      authChannel = new BroadcastChannel('auth_sync');
    } catch (e) {
      // BroadcastChannel not supported, will use storage event fallback
      console.warn('BroadcastChannel not supported, using storage event fallback');
    }

    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data.type === 'LOGIN') {
        // Another tab logged in - validate session to recover
        validateSession();
      } else if (event.data.type === 'LOGOUT') {
        // Another tab logged out - clear local session
        clearLocalSession();
        router.push('/');
      }
    };

    // Storage event fallback for browsers without BroadcastChannel support
    const processedEventIds = new Set<string>();
    const EVENT_WINDOW_MS = 5000; // 5 seconds window for valid events

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'auth_event' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          
          // Reject events older than the window (prevents stale events)
          if (Date.now() - data.timestamp > EVENT_WINDOW_MS) {
            return;
          }

          // Ignore duplicate events (prevents reprocessing)
          if (processedEventIds.has(data.eventId)) {
            return;
          }
          processedEventIds.add(data.eventId);

          // Clean up old eventIds periodically (keep last 100)
          if (processedEventIds.size > 100) {
            const oldest = Array.from(processedEventIds)[0];
            processedEventIds.delete(oldest);
          }

          if (data.type === 'LOGIN') {
            // Another tab logged in - validate session to recover
            validateSession();
          } else if (data.type === 'LOGOUT') {
            // Another tab logged out - clear local session
            clearLocalSession();
            router.push('/');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    if (authChannel) {
      authChannel.addEventListener('message', handleBroadcastMessage);
    }

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (authChannel) {
        authChannel.removeEventListener('message', handleBroadcastMessage);
        authChannel.close();
      }
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [router, queryClient, clearCart, clearLocalSession]);

  const login = async (email: string, password: string, captchaToken?: string): Promise<User | TwoFactorRequired | TwoFactorSetupRequired> => {
    let response;
    try {
      const payload: Record<string, string> = { email, password };
      if (captchaToken) payload.captchaToken = captchaToken;
      response = await api.post('/auth/login', payload);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { data?: { requiresTwoFactorSetup?: boolean; userId?: string; email?: string; twoFactorSetupToken?: string } } } };
      const errData = axiosErr.response?.data?.data;
      if (axiosErr.response?.status === 403 && errData?.requiresTwoFactorSetup) {
        return {
          requiresTwoFactorSetup: true,
          userId: errData.userId!,
          email: errData.email!,
          twoFactorSetupToken: errData.twoFactorSetupToken!,
        };
      }
      throw err;
    }
    const data = response.data;

    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    // Check if 2FA is required
    if (data.data.requiresTwoFactor) {
      return {
        requiresTwoFactor: true,
        userId: data.data.userId,
        email: data.data.email,
      };
    }

    const { user: userData, tokens } = data.data;

    if (!tokens?.accessToken) {
      throw new Error('Invalid login response - missing access token');
    }

    memoryTokenStore.set(tokens.accessToken);
      // localStorage.setItem('accessToken', tokens.accessToken); // Deprecated - use memory store
      // localStorage.setItem('refreshToken', tokens.refreshToken); // Deprecated - refresh token is httpOnly cookie
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('isAuthenticated', 'true'); // Companion flag for cross-tab recovery

      // Set accessToken cookie for middleware to read (if needed)
      document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=604800; SameSite=Lax`;

      setUser(userData);

      // Notify other tabs of login
      notifyAuthEvent('LOGIN');

    return userData;
  };

  const verify2FA = async (userId: string, code: string): Promise<User> => {
    const response = await api.post('/auth/2fa/verify', { userId, code });
    const data = response.data;

    if (!data.success) {
      throw new Error(data.error || '2FA verification failed');
    }

    const { user: userData, tokens } = data.data;

    if (!tokens?.accessToken) {
      throw new Error('Invalid response - missing access token');
    }

    memoryTokenStore.set(tokens.accessToken);
      // localStorage.setItem('accessToken', tokens.accessToken); // Deprecated - use memory store
      // localStorage.setItem('refreshToken', tokens.refreshToken); // Deprecated - refresh token is httpOnly cookie
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('isAuthenticated', 'true'); // Companion flag for cross-tab recovery

      // Set accessToken cookie for middleware to read (if needed)
      document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=604800; SameSite=Lax`;

      setUser(userData);

      // Notify other tabs of login
      notifyAuthEvent('LOGIN');

    return userData;
  };

  const completeTwoFactorSetupLogin = (userData: User, accessToken: string) => {
    memoryTokenStore.set(accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true'); // Companion flag for cross-tab recovery
    document.cookie = `accessToken=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
    setUser(userData);

    // Notify other tabs of login
    notifyAuthEvent('LOGIN');
  };

  const logout = () => {
    // Invalidate server-side session (fire-and-forget)
    // The httpOnly cookie is automatically sent by Axios via withCredentials: true
    api.post('/auth/logout').catch(() => {
      // Best-effort: still clear client state even if API call fails
    });
    
    clearLocalSession();

    // Notify other tabs of logout
    notifyAuthEvent('LOGOUT');

    router.push('/');
  };

  const refreshUser = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        verify2FA,
        completeTwoFactorSetupLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
