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
  twoFactorEnabled?: boolean;
}

// 2FA Types
export interface TwoFactorRequired {
  requiresTwoFactor: true;
  userId: string;
  email: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  method: 'totp' | 'sms' | null;
  backupCodesRemaining: number;
}

export type LoginResult = (AuthTokens & { user: User }) | TwoFactorRequired;


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

  /**
   * Request password reset email
   */
  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/forgot-password', {
      email,
    });
    return response.data;
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/reset-password', {
      token,
      password,
    });
    return response.data;
  },
};

/**
 * Two-Factor Authentication API methods
 */
export const twoFactorApi = {
  /**
   * Verify 2FA code during login
   */
  async verifyLogin(userId: string, code: string): Promise<ApiResponse<AuthTokens & { user: User }>> {
    const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
    
    const response = await apiClient.post<ApiResponse<AuthTokens & { user: User }>>('/auth/2fa/verify', {
      userId,
      code,
      deviceId,
      platform: Platform.OS,
    });

    if (response.data.success && response.data.data) {
      const { accessToken, refreshToken, user } = response.data.data;
      
      if (accessToken) await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      if (refreshToken) await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      if (user) await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    }

    return response.data;
  },

  /**
   * Initiate 2FA setup - get QR code and secret
   */
  async initiateSetup(): Promise<ApiResponse<TwoFactorSetup>> {
    const response = await apiClient.post<ApiResponse<TwoFactorSetup>>('/auth/2fa/setup');
    return response.data;
  },

  /**
   * Enable 2FA with verification code
   */
  async enableTwoFactor(code: string): Promise<ApiResponse<{ backupCodes: string[] }>> {
    const response = await apiClient.post<ApiResponse<{ backupCodes: string[] }>>('/auth/2fa/enable', {
      code,
    });
    return response.data;
  },

  /**
   * Disable 2FA
   */
  async disableTwoFactor(password: string, code?: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<ApiResponse<void>>('/auth/2fa/disable', {
      password,
      code,
    });
    return response.data;
  },

  /**
   * Get 2FA status for current user
   */
  async getStatus(): Promise<ApiResponse<TwoFactorStatus>> {
    const response = await apiClient.get<ApiResponse<TwoFactorStatus>>('/auth/2fa/status');
    return response.data;
  },

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(password: string): Promise<ApiResponse<{ backupCodes: string[] }>> {
    const response = await apiClient.post<ApiResponse<{ backupCodes: string[] }>>('/auth/2fa/backup-codes', {
      password,
    });
    return response.data;
  },

  /**
   * Verify with backup code (login flow)
   */
  async verifyWithBackupCode(userId: string, backupCode: string): Promise<ApiResponse<AuthTokens & { user: User }>> {
    const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
    
    const response = await apiClient.post<ApiResponse<AuthTokens & { user: User }>>('/auth/2fa/verify-backup', {
      userId,
      backupCode,
      deviceId,
      platform: Platform.OS,
    });

    if (response.data.success && response.data.data) {
      const { accessToken, refreshToken, user } = response.data.data;
      
      if (accessToken) await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      if (refreshToken) await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      if (user) await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    }

    return response.data;
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

/**
 * Profile API methods
 */
export const profileApi = {
  /**
   * Update user profile
   */
  async update(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<ApiResponse<User>> {
    const response = await apiClient.put<ApiResponse<User>>('/users/me', data);
    if (response.data.success && response.data.data) {
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.data));
    }
    return response.data;
  },

  /**
   * Change password
   */
  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    const response = await apiClient.put<ApiResponse<void>>('/users/me/password', data);
    return response.data;
  },
};

/**
 * Loyalty API methods
 */
export const loyaltyApi = {
  /**
   * Get loyalty status (alias for getBalance with extended data)
   */
  async getStatus(): Promise<ApiResponse<{
    points: number;
    tier: string;
    tierBenefits: string[];
    nextTier: string | null;
    pointsToNextTier: number | null;
    lifetimePoints: number;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>('/loyalty/status');
    return response.data;
  },

  /**
   * Get loyalty balance and tier info
   */
  async getBalance(): Promise<ApiResponse<{
    points: number;
    tier: string;
    tierMultiplier: number;
    nextTier?: string;
    pointsToNextTier?: number;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>('/loyalty/balance');
    return response.data;
  },

  /**
   * Get points history
   */
  async getHistory(page?: number, limit?: number): Promise<ApiResponse<Array<{
    id: string;
    type: 'earn' | 'redeem';
    points: number;
    description: string;
    date: string;
    category: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/loyalty/history', { 
      params: { page, limit } 
    });
    // Transform response if needed
    const data = response.data.data;
    if (data?.transactions) {
      return { ...response.data, data: data.transactions };
    }
    return response.data;
  },

  /**
   * Get available rewards
   */
  async getAvailableRewards(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    pointsCost: number;
    description: string;
    available: boolean;
    category: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/loyalty/rewards');
    return response.data;
  },

  /**
   * Redeem a reward
   */
  async redeemReward(rewardId: string): Promise<ApiResponse<{ success: boolean }>> {
    const response = await apiClient.post<ApiResponse<any>>(`/loyalty/rewards/${rewardId}/redeem`);
    return response.data;
  },
};

/**
 * Gift Card API methods
 */
export const giftCardApi = {
  /**
   * Check gift card balance
   */
  async checkBalance(code: string): Promise<ApiResponse<{
    code: string;
    balance: number;
    expiresAt?: string;
    isValid: boolean;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>(`/giftcards/balance/${code}`);
    return response.data;
  },

  /**
   * Get user's gift cards (alias: getMyCards)
   */
  async getMyCards(): Promise<ApiResponse<Array<{
    id: string;
    code: string;
    balance: number;
    initialValue: number;
    status: 'active' | 'depleted' | 'expired';
    expiresAt: string | null;
    createdAt: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/giftcards/my');
    return response.data;
  },

  /**
   * Get user's gift cards
   */
  async list(): Promise<ApiResponse<Array<{
    id: string;
    code: string;
    balance: number;
    expiresAt?: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/giftcards/my');
    return response.data;
  },

  /**
   * Get gift card transaction history
   */
  async getHistory(): Promise<ApiResponse<Array<{
    id: string;
    type: 'purchase' | 'redeem' | 'refund';
    amount: number;
    description: string;
    date: string;
    cardCode: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/giftcards/history');
    return response.data;
  },

  /**
   * Purchase a gift card
   */
  async purchase(data: {
    amount: number;
    recipientEmail: string;
    recipientName?: string;
    message?: string;
  }): Promise<ApiResponse<{
    id: string;
    code: string;
    balance: number;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/giftcards/purchase', data);
    return response.data;
  },

  /**
   * Redeem a gift card code
   */
  async redeem(code: string): Promise<ApiResponse<{
    id: string;
    balance: number;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/giftcards/redeem', { code });
    return response.data;
  },
};

/**
 * Restaurant API methods  
 */
export const restaurantApi = {
  /**
   * Get restaurant modules
   */
  async getModules(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    type: string;
    description?: string;
    image?: string;
    isActive: boolean;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/modules?type=restaurant');
    return response.data;
  },

  /**
   * Get menu categories
   */
  async getCategories(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    icon: string;
    itemCount: number;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/restaurant/categories');
    return response.data;
  },

  /**
   * Get menu items (optionally filtered by category)
   */
  async getMenu(categoryId?: string): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string | null;
    available: boolean;
    preparationTime: number;
    dietaryFlags: string[];
    allergens: string[];
    popular: boolean;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/restaurant/menu', { 
      params: categoryId ? { category: categoryId } : undefined 
    });
    return response.data;
  },

  /**
   * Get menu items for a module
   */
  async getModuleMenu(moduleId: string, params?: { category?: string }): Promise<ApiResponse<{
    categories: string[];
    items: Array<{
      id: string;
      name: string;
      description?: string;
      price: number;
      category: string;
      image?: string;
      isAvailable: boolean;
    }>;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>(`/restaurant/${moduleId}/menu`, { params });
    return response.data;
  },

  /**
   * Get cart items
   */
  async getCart(): Promise<ApiResponse<Array<{
    id: string;
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/restaurant/cart');
    return response.data;
  },

  /**
   * Add item to cart
   */
  async addToCart(data: {
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }): Promise<ApiResponse<{ id: string }>> {
    const response = await apiClient.post<ApiResponse<any>>('/restaurant/cart', data);
    return response.data;
  },

  /**
   * Update cart item
   */
  async updateCartItem(itemId: string, data: {
    quantity?: number;
    specialInstructions?: string;
  }): Promise<ApiResponse<void>> {
    const response = await apiClient.put<ApiResponse<any>>(`/restaurant/cart/${itemId}`, data);
    return response.data;
  },

  /**
   * Remove item from cart
   */
  async removeFromCart(itemId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<any>>(`/restaurant/cart/${itemId}`);
    return response.data;
  },

  /**
   * Place order
   */
  async placeOrder(data: {
    items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>;
    deliveryOption: 'room' | 'pickup';
    roomNumber?: string;
    specialInstructions?: string;
    couponCode?: string;
  }): Promise<ApiResponse<{
    orderId: string;
    orderNumber: string;
    total: number;
    status: string;
  }>> {
    // Transform to API format
    const apiData = {
      items: data.items.map(i => ({ 
        itemId: i.menuItemId, 
        quantity: i.quantity, 
        notes: i.specialInstructions 
      })),
      deliveryOption: data.deliveryOption,
      roomNumber: data.roomNumber,
      notes: data.specialInstructions,
      couponCode: data.couponCode,
    };
    const response = await apiClient.post<ApiResponse<any>>('/restaurant/orders', apiData);
    return response.data;
  },

  /**
   * Get user's orders
   */
  async getOrders(params?: { page?: number; limit?: number; status?: string }): Promise<ApiResponse<Array<{
    id: string;
    orderNumber: string;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    deliveryOption: 'room' | 'pickup';
    roomNumber?: string;
    createdAt: string;
    estimatedTime?: number;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/restaurant/orders', { params });
    // Transform paginated response to array
    const data = response.data.data;
    if (data?.orders) {
      return { ...response.data, data: data.orders };
    }
    return response.data;
  },
};

/**
 * Snack Bar API methods
 */
export const snackApi = {
  /**
   * Get snack bar items
   */
  async getItems(moduleId?: string): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl?: string;
    available: boolean;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/snack/items', {
      params: moduleId ? { moduleId } : undefined,
    });
    return response.data;
  },

  /**
   * Get snack bar categories
   */
  async getCategories(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    itemCount: number;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/snack/categories');
    return response.data;
  },

  /**
   * Place a snack bar order
   */
  async createOrder(data: {
    items: Array<{
      itemId: string;
      quantity: number;
      notes?: string;
    }>;
    paymentMethod: 'cash' | 'card';
    notes?: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<ApiResponse<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/snack/orders', data);
    return response.data;
  },

  /**
   * Get user's snack orders
   */
  async getOrders(): Promise<ApiResponse<Array<{
    id: string;
    orderNumber: string;
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: 'cash' | 'card';
    createdAt: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/snack/orders/my');
    return response.data;
  },

  /**
   * Get specific snack order
   */
  async getOrder(orderId: string): Promise<ApiResponse<{
    id: string;
    orderNumber: string;
    status: string;
    items: Array<{ name: string; quantity: number; price: number; notes?: string }>;
    total: number;
    paymentMethod: 'cash' | 'card';
    createdAt: string;
    updatedAt: string;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>(`/snack/orders/${orderId}`);
    return response.data;
  },
};

/**
 * Pool API methods
 */
export const poolApi = {
  /**
   * Get pool info
   */
  async getInfo(): Promise<ApiResponse<{
    id: string;
    name: string;
    description: string;
    amenities: string[];
    hours: string;
    rules: string[];
  }>> {
    const response = await apiClient.get<ApiResponse<any>>('/pool/info');
    return response.data;
  },

  /**
   * Get pool areas
   */
  async getAreas(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description?: string;
    capacity: number;
    currentOccupancy: number;
    image?: string;
    isOpen: boolean;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/pool/areas');
    return response.data;
  },

  /**
   * Get availability for a date
   */
  async getAvailability(date: string): Promise<ApiResponse<Array<{
    id: string;
    startTime: string;
    endTime: string;
    available: boolean;
    spotsAvailable: number;
    maxCapacity: number;
    price: number;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/pool/availability', {
      params: { date }
    });
    return response.data;
  },

  /**
   * Get user's bookings
   */
  async getMyBookings(): Promise<ApiResponse<Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    guests: number;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/pool/bookings/my');
    return response.data;
  },

  /**
   * Book a pool slot
   */
  async book(data: {
    date: string;
    slotId: string;
    guests: number;
  }): Promise<ApiResponse<{
    bookingId: string;
    qrCode: string;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/pool/book', data);
    return response.data;
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<any>>(`/pool/bookings/${bookingId}`);
    return response.data;
  },

  /**
   * Book pool ticket
   */
  async bookTicket(data: {
    areaId?: string;
    date: string;
    quantity: number;
  }): Promise<ApiResponse<{
    ticketId: string;
    qrCode: string;
    validFrom: string;
    validTo: string;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/pool/tickets', data);
    return response.data;
  },

  /**
   * Get user's tickets
   */
  async getTickets(): Promise<ApiResponse<Array<{
    id: string;
    qrCode: string;
    status: string;
    validFrom: string;
    validTo: string;
    area?: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/pool/tickets/my');
    return response.data;
  },
};

/**
 * Coupon API methods
 */
export const couponApi = {
  /**
   * Validate coupon code
   */
  async validate(code: string, context?: { moduleId?: string; subtotal?: number }): Promise<ApiResponse<{
    code: string;
    discount: number;
    type: 'percentage' | 'fixed';
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    isValid: boolean;
    message?: string;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/coupons/validate', { code, ...context });
    // Normalize response to include both formats
    if (response.data.data) {
      const data = response.data.data;
      response.data.data = {
        ...data,
        discount: data.discountValue || data.discount,
        type: data.discountType || data.type,
      };
    }
    return response.data;
  },
};

/**
 * Payment API methods
 */
export const paymentApi = {
  /**
   * Create payment intent
   */
  async createIntent(data: {
    amount: number;
    orderId?: string;
    bookingId?: string;
    couponCode?: string;
    giftCardCode?: string;
    loyaltyPointsToRedeem?: number;
  }): Promise<ApiResponse<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    discounts: Array<{ type: string; amount: number }>;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/payments/create-intent', data);
    return response.data;
  },

  /**
   * Confirm payment
   */
  async confirm(paymentIntentId: string): Promise<ApiResponse<{
    status: string;
    receiptUrl?: string;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/payments/confirm', { paymentIntentId });
    return response.data;
  },
};

/**
 * Chalets API methods
 */
export const chaletsApi = {
  /**
   * Get all chalets
   */
  async getChalets(moduleId?: string): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description?: string;
    basePrice: number;
    maxGuests: number;
    bedrooms: number;
    bathrooms: number;
    amenities: string[];
    images: string[];
    isAvailable: boolean;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/chalets', { 
      params: moduleId ? { moduleId } : undefined 
    });
    return response.data;
  },

  /**
   * Get single chalet details
   */
  async getChalet(id: string): Promise<ApiResponse<{
    id: string;
    name: string;
    description?: string;
    basePrice: number;
    maxGuests: number;
    bedrooms: number;
    bathrooms: number;
    amenities: string[];
    images: string[];
    isAvailable: boolean;
    rules?: string[];
  }>> {
    const response = await apiClient.get<ApiResponse<any>>(`/chalets/${id}`);
    return response.data;
  },

  /**
   * Check availability
   */
  async getAvailability(chaletId: string, checkIn: string, checkOut: string): Promise<ApiResponse<{
    isAvailable: boolean;
    totalPrice: number;
    nights: number;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>(`/chalets/${chaletId}/availability`, {
      params: { checkIn, checkOut }
    });
    return response.data;
  },

  /**
   * Get add-ons for chalets
   */
  async getAddOns(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/chalets/add-ons');
    return response.data;
  },

  /**
   * Create a booking
   */
  async createBooking(data: {
    chaletId: string;
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests: number;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    addOns?: Array<{ addOnId: string; quantity: number }>;
    specialRequests?: string;
  }): Promise<ApiResponse<{
    id: string;
    bookingNumber: string;
    status: string;
    totalPrice: number;
  }>> {
    const response = await apiClient.post<ApiResponse<any>>('/chalets/bookings', data);
    return response.data;
  },

  /**
   * Get user's bookings
   */
  async getMyBookings(): Promise<ApiResponse<Array<{
    id: string;
    bookingNumber: string;
    chalet: { id: string; name: string; images: string[] };
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests: number;
    totalPrice: number;
    status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
    createdAt: string;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/chalets/my-bookings');
    return response.data;
  },

  /**
   * Get booking details
   */
  async getBookingDetails(bookingId: string): Promise<ApiResponse<{
    id: string;
    bookingNumber: string;
    chalet: { id: string; name: string; images: string[]; amenities: string[] };
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests: number;
    totalPrice: number;
    status: string;
    addOns: Array<{ name: string; price: number; quantity: number }>;
    specialRequests?: string;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>(`/chalets/bookings/${bookingId}`);
    return response.data;
  },
};

/**
 * Modules API methods (for dynamic resort modules)
 */
export const modulesApi = {
  /**
   * Get all modules
   */
  async getModules(type?: string): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    slug: string;
    type: 'restaurant' | 'pool' | 'chalets' | 'snack' | 'spa';
    description?: string;
    image?: string;
    isActive: boolean;
    settings?: Record<string, any>;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>('/modules', { 
      params: type ? { type } : undefined 
    });
    return response.data;
  },

  /**
   * Get single module
   */
  async getModule(idOrSlug: string): Promise<ApiResponse<{
    id: string;
    name: string;
    slug: string;
    type: string;
    description?: string;
    image?: string;
    isActive: boolean;
    settings?: Record<string, any>;
  }>> {
    const response = await apiClient.get<ApiResponse<any>>(`/modules/${idOrSlug}`);
    return response.data;
  },
};

/**
 * Bookings API methods (unified access to all bookings)
 */
export const bookingsApi = {
  /**
   * Get all user bookings (chalets, pool, etc.)
   */
  async getMyBookings(): Promise<ApiResponse<Array<{
    id: string;
    type: 'chalet' | 'pool' | 'spa';
    bookingNumber: string;
    date: string;
    endDate?: string;
    status: string;
    details: Record<string, any>;
  }>>> {
    // Combine chalet and pool bookings
    const [chaletRes, poolRes] = await Promise.all([
      chaletsApi.getMyBookings().catch(() => ({ success: false, data: [] as any })),
      poolApi.getMyBookings().catch(() => ({ success: false, data: [] as any })),
    ]);

    const bookings: any[] = [];
    
    if (chaletRes.success && chaletRes.data) {
      chaletRes.data.forEach((b: any) => {
        bookings.push({
          id: b.id,
          type: 'chalet',
          bookingNumber: b.bookingNumber,
          date: b.checkInDate,
          endDate: b.checkOutDate,
          status: b.status,
          details: b,
        });
      });
    }

    if (poolRes.success && poolRes.data) {
      poolRes.data.forEach((b: any) => {
        bookings.push({
          id: b.id,
          type: 'pool',
          bookingNumber: b.id,
          date: b.date,
          status: b.status,
          details: b,
        });
      });
    }

    return { success: true, data: bookings };
  },
};

export default apiClient;
