'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

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
    // Check for stored user on mount
    const storedUser = localStorage.getItem('user');
    const accessToken = localStorage.getItem('accessToken');
    
    console.log('[AUTH CONTEXT] Checking stored auth...');
    console.log('[AUTH CONTEXT] Has stored user:', !!storedUser);
    console.log('[AUTH CONTEXT] Has access token:', !!accessToken);
    
    if (storedUser && accessToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('[AUTH CONTEXT] Restored user:', parsedUser.email);
        console.log('[AUTH CONTEXT] User roles:', parsedUser.roles);
        setUser(parsedUser);
      } catch (e) {
        console.error('[AUTH CONTEXT] Failed to parse stored user');
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    console.log('[AUTH CONTEXT] Login called for:', email);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
    
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log('[AUTH CONTEXT] Login response:', data);

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }

    const { user: userData, tokens } = data.data;
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    setUser(userData);
    console.log('[AUTH CONTEXT] User set:', userData);
    
    return userData;
  };

  const logout = () => {
    console.log('[AUTH CONTEXT] Logout called');
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
