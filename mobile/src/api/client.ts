/**
 * API Client for V2 Resort Mobile App
 * 
 * Features:
 * - Automatic token refresh
 * - Request/response interceptors
 * - Platform headers (X-Platform, X-App-Version)
 * - Offline queue support
 * - Type-safe API methods
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/env';

// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'v2_access_token',
  REFRESH_TOKEN: 'v2_refresh_token',
  USER_DATA: 'v2_user_data',
  DEVICE_ID: 'v2_device_id',
} as const;

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  phone?: string;
  loyaltyPoints?: number;
}

// Token refresh state to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
};

/**
 * Create the API client instance
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_BASE_URL}/api/v1`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Request interceptor - add auth headers and platform info
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Add access token
      const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Add platform headers
      config.headers['X-Platform'] = Platform.OS;
      config.headers['X-App-Version'] = Application.nativeApplicationVersion || '1.0.0';
      
      // Add device ID if available
      const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
      if (deviceId) {
        config.headers['X-Device-ID'] = deviceId;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle token refresh
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiResponse>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // If 401 and not already retrying, attempt token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // Queue this request to retry after refresh completes
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return client(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
          
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          // Call refresh endpoint (uses base axios to avoid interceptor loop)
          const response = await axios.post<ApiResponse<AuthTokens>>(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            { refreshToken },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Platform': Platform.OS,
              },
            }
          );

          if (response.data.success && response.data.data) {
            const { accessToken, refreshToken: newRefreshToken } = response.data.data;

            // Store new tokens
            if (accessToken) await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, typeof accessToken === 'string' ? accessToken : String(accessToken));
            if (newRefreshToken) await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, typeof newRefreshToken === 'string' ? newRefreshToken : String(newRefreshToken));

            // Process queued requests
            processQueue(null, accessToken);

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return client(originalRequest);
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (refreshError) {
          processQueue(refreshError, null);
          
          // Clear tokens and user data on refresh failure
          await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
          await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
          await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
          
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

// Create singleton instance
export const apiClient = createApiClient();

/**
 * Auth API methods
 */
export const authApi = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<ApiResponse<AuthTokens & { user: User }>> {
    const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
    
    const response = await apiClient.post<ApiResponse<AuthTokens & { user: User }>>('/auth/login', {
      email,
      password,
      deviceId,
      platform: Platform.OS,
    });

    if (response.data.success && response.data.data) {
      const { accessToken, refreshToken, user } = response.data.data;
      
      // Store tokens and user data
      if (accessToken) await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, typeof accessToken === 'string' ? accessToken : String(accessToken));
      if (refreshToken) await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, typeof refreshToken === 'string' ? refreshToken : String(refreshToken));
      if (user) await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    }

    return response.data;
  },

  /**
   * Register new account
   */
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<ApiResponse<AuthTokens & { user: User }>> {
    const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
    
    const response = await apiClient.post<ApiResponse<AuthTokens & { user: User }>>('/auth/register', {
      ...data,
      deviceId,
      platform: Platform.OS,
    });

    if (response.data.success && response.data.data) {
      const { accessToken, refreshToken, user } = response.data.data;
      
      if (accessToken) await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, typeof accessToken === 'string' ? accessToken : String(accessToken));
      if (refreshToken) await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, typeof refreshToken === 'string' ? refreshToken : String(refreshToken));
      if (user) await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    }

    return response.data;
  },

  /**
   * Logout from current device
   */
  async logout(): Promise<void> {
    try {
      const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
      await apiClient.post('/auth/logout', { deviceId });
    } catch (error) {
      // Continue with local logout even if server call fails
      console.warn('Server logout failed:', error);
    } finally {
      // Clear local storage
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    }
  },

  /**
   * Logout from all devices
   */
  async logoutAll(): Promise<void> {
    try {
      await apiClient.post('/auth/logout-all');
    } finally {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    }
  },

  /**
   * Get current user profile
   */
  async getMe(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },

  /**
   * Refresh access token manually
   */
  async refreshToken(): Promise<ApiResponse<AuthTokens>> {
    const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!refreshToken) {
      return { success: false, error: 'No refresh token' };
    }

    const response = await axios.post<ApiResponse<AuthTokens>>(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      { refreshToken }
    );

    if (response.data.success && response.data.data) {
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, response.data.data.accessToken);
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, response.data.data.refreshToken);
    }

    return response.data;
  },

  /**
   * Check if user is authenticated (has valid tokens)
   */
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    return !!accessToken;
  },

  /**
   * Get stored user data
   */
  async getStoredUser(): Promise<User | null> {
    const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch {
        return null;
      }
    }
    return null;
  },
};

/**
 * Device API methods
 */
export const deviceApi = {
  /**
   * Register device for push notifications
   */
  async register(data: {
    token: string;
    platform: 'ios' | 'android';
    deviceName?: string;
  }): Promise<ApiResponse<{ deviceId: string }>> {
    const response = await apiClient.post<ApiResponse<{ deviceId: string }>>('/devices/register', data);
    
    if (response.data.success && response.data.data) {
      await SecureStore.setItemAsync(STORAGE_KEYS.DEVICE_ID, response.data.data.deviceId);
    }

    return response.data;
  },

  /**
   * Update push token
   */
  async updateToken(token: string): Promise<ApiResponse<void>> {
    const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
    
    if (!deviceId) {
      return { success: false, error: 'No device registered' };
    }

    const response = await apiClient.put<ApiResponse<void>>(`/devices/${deviceId}/token`, {
      token,
    });

    return response.data;
  },

  /**
   * Unregister device
   */
  async unregister(): Promise<ApiResponse<void>> {
    const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
    
    if (!deviceId) {
      return { success: true };
    }

    const response = await apiClient.delete<ApiResponse<void>>(`/devices/${deviceId}`);
    
    if (response.data.success) {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.DEVICE_ID);
    }

    return response.data;
  },

  /**
   * List user's devices
   */
  async list(): Promise<ApiResponse<Array<{
    id: string;
    platform: string;
    deviceName?: string;
    lastActive: string;
    isCurrent: boolean;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/devices');
    return response.data;
  },
};

export default apiClient;
