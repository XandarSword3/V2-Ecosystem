'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  login: (email: string, password: string) => Promise<User | TwoFactorRequired | TwoFactorSetupRequired>;
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

      // If we have a stored user but no access token, try to refresh using the httpOnly refresh token cookie.
      // Routed through the shared single-flight refreshAccessToken() (api.ts) instead of
      // calling api.post('/auth/refresh') directly — under React StrictMode's double-mount in
      // dev, this effect runs twice almost simultaneously, and a second independent refresh call
      // would present the now-rotated-out refresh cookie and get 401'd, logging the user out.
      if (!accessToken && storedUser) {
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
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
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
        memoryTokenStore.clear();
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      }

      setIsLoading(false);
    };

    validateSession();
  }, []);

  const login = async (email: string, password: string): Promise<User | TwoFactorRequired | TwoFactorSetupRequired> => {
    let response;
    try {
      response = await api.post('/auth/login', { email, password });
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

      // Set accessToken cookie for middleware to read (if needed)
      document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=604800; SameSite=Lax`;

      setUser(userData);

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

      // Set accessToken cookie for middleware to read (if needed)
      document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=604800; SameSite=Lax`;

      setUser(userData);

    return userData;
  };

  const completeTwoFactorSetupLogin = (userData: User, accessToken: string) => {
    memoryTokenStore.set(accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    document.cookie = `accessToken=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
    setUser(userData);
  };

  const logout = () => {
    // Invalidate server-side session (fire-and-forget)
    const refreshToken = localStorage.getItem('refreshToken');
    api.post('/auth/logout', { refreshToken }).catch(() => {
      // Best-effort: still clear client state even if API call fails
    });
    memoryTokenStore.clear();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('activePropertyId');
    // Clear accessToken cookie
    document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
    clearCart();
    queryClient.clear();
    setUser(null);
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
