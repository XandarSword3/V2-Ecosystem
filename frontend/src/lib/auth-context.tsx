'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, API_BASE_URL } from './api';
import { authLogger } from './logger';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  profileImageUrl?: string;
  preferredLanguage: string;
  roles: string[];
}

interface TwoFactorRequired {
  requiresTwoFactor: true;
  userId: string;
  email: string;
}

interface LoginResult {
  user: User;
  requiresTwoFactor?: false;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User | TwoFactorRequired>;
  verify2FA: (userId: string, code: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Validate stored credentials on mount by checking with the server
    const validateSession = async () => {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');
      
      if (!storedUser || !accessToken) {
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
            roles: response.data.data.roles || []
          };
          setUser(validatedUser);
          // Update localStorage with validated data
          localStorage.setItem('user', JSON.stringify(validatedUser));
        } else {
          throw new Error('Invalid session');
        }
      } catch (e) {
        // Clear invalid session data
        authLogger.warn('Session validation failed, clearing credentials');
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      }
      
      setIsLoading(false);
    };
    
    validateSession();
  }, []);

  const login = async (email: string, password: string): Promise<User | TwoFactorRequired> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
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
    
    // Debug logging
    console.log('[Auth] Login response tokens:', tokens);
    console.log('[Auth] accessToken:', tokens?.accessToken?.substring(0, 20) + '...');
    console.log('[Auth] refreshToken:', tokens?.refreshToken?.substring(0, 20) + '...');
    
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      console.error('[Auth] Missing tokens in login response!');
      throw new Error('Invalid login response - missing tokens');
    }
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    setUser(userData);
    
    return userData;
  };

  const verify2FA = async (userId: string, code: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || '2FA verification failed');
    }

    const { user: userData, tokens } = data.data;
    
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error('Invalid response - missing tokens');
    }
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    setUser(userData);
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
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
