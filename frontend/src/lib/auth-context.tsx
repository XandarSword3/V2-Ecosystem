'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from './api';
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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
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
        // Validate token with backend - this prevents localStorage spoofing
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Use server-validated user data, not localStorage
            const validatedUser: User = {
              id: data.data.id,
              email: data.data.email,
              fullName: data.data.full_name || data.data.fullName,
              phone: data.data.phone,
              profileImageUrl: data.data.profile_image_url || data.data.profileImageUrl,
              preferredLanguage: data.data.preferred_language || data.data.preferredLanguage || 'en',
              roles: data.data.roles || []
            };
            setUser(validatedUser);
            // Update localStorage with validated data
            localStorage.setItem('user', JSON.stringify(validatedUser));
          } else {
            throw new Error('Invalid session');
          }
        } else {
          // Token invalid - clear everything
          throw new Error('Token validation failed');
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

  const login = async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }

    const { user: userData, tokens } = data.data;
    
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
