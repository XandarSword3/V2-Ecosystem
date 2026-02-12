import axios from 'axios';

// Types for API requests
interface CreateOrderData {
  customerName?: string;
  customerPhone?: string;
  items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
  orderType?: string;
  paymentMethod?: string;
  specialInstructions?: string;
  tableNumber?: string;
  chaletNumber?: string;
  // Discount integration fields
  couponCode?: string;
  giftCardRedemptions?: Array<{ code: string; amount: number }>;
  loyaltyPointsToRedeem?: number;
  loyaltyPointsDollarValue?: number;
}

interface CreateSnackOrderData {
  customerName?: string;
  customerPhone?: string;
  items: Array<{ itemId: string; quantity: number; notes?: string }>;
  paymentMethod: 'cash' | 'card';
  notes?: string;
}

interface CreateBookingData {
  chaletId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  addOns?: Array<{ addOnId: string; quantity: number }>;
  specialRequests?: string;
  paymentMethod: 'cash' | 'card' | 'online';
}

interface PurchaseTicketData {
  sessionId: string;
  ticketDate: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  numberOfGuests: number;
  numberOfAdults?: number;
  numberOfChildren?: number;
  paymentMethod: 'cash' | 'card' | 'online';
}

interface CreateModuleData {
  template_type: string;
  name: string;
  slug?: string;
  description?: string;
  settings?: Record<string, unknown>;
  settings_version?: number;
}

// API_URL should NOT include /api - we add it in baseURL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Ensure we don't double up on /api
const cleanUrl = API_URL.replace(/\/api\/?$/, '');

// Export the base API URL for use in other files
export const API_BASE_URL = `${cleanUrl}/api/v1`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CRITICAL: Send cookies (CSRF token) with requests
  timeout: 30000, // 30 second timeout
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'], // Idempotent methods
};

// Calculate delay with exponential backoff and jitter
const getRetryDelay = (retryCount: number): number => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
    RETRY_CONFIG.maxDelay
  );
  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
};

// Check if request should be retried
const shouldRetry = (error: any, retryCount: number): boolean => {
  if (retryCount >= RETRY_CONFIG.maxRetries) return false;

  // Network errors (no response)
  if (!error.response) return true;

  const status = error.response.status;
  const method = error.config?.method?.toUpperCase() || 'GET';

  // Only retry idempotent methods on server errors
  if (RETRY_CONFIG.retryableStatuses.includes(status)) {
    return RETRY_CONFIG.retryableMethods.includes(method);
  }

  return false;
};

// Sleep helper
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// CSRF token management
let csrfTokenPromise: Promise<string | null> | null = null;

/**
 * Ensure we have a valid CSRF token before making mutation requests
 * This fetches a token from the server if we don't have one in cookies
 */
async function ensureCsrfToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // Check if we already have a token in cookies
  const existingToken = getCookie('csrf-token');
  if (existingToken) return existingToken;
  
  // If we're already fetching, wait for that promise
  if (csrfTokenPromise) return csrfTokenPromise;
  
  // Fetch a new token
  csrfTokenPromise = (async () => {
    try {
      const response = await axios.get(`${API_BASE_URL.replace('/api/v1', '')}/api/csrf-token`, {
        withCredentials: true,
      });
      return response.data?.csrfToken || null;
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error);
      return null;
    } finally {
      // Reset promise after a short delay so we can try again if needed
      setTimeout(() => { csrfTokenPromise = null; }, 1000);
    }
  })();
  
  return csrfTokenPromise;
}

// Track if we're currently refreshing to avoid multiple refreshes
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper to check if token is close to expiring
const isTokenExpiringSoon = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const bufferMs = 60000; // 1 minute buffer
    return exp - now < bufferMs;
  } catch {
    return true; // If we can't parse, assume it's expiring
  }
};

// Helper to get cookie value by name
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : undefined;
};

// Request interceptor to add auth token, CSRF token, and check expiration
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      let token = localStorage.getItem('accessToken');

      // Check if token is close to expiring and proactively refresh
      if (token && isTokenExpiringSoon(token) && !isRefreshing) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
          try {
            isRefreshing = true;
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
            const { accessToken, refreshToken: newRefreshToken } = response.data.data;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            token = accessToken;
          } catch {
            // Refresh failed, continue with old token
          } finally {
            isRefreshing = false;
          }
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add CSRF token for non-GET requests (Double Submit Cookie pattern)
      const method = config.method?.toUpperCase();
      if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        // First try to get from cookie
        let csrfToken = getCookie('csrf-token');
        
        // If no cookie, fetch a token first
        if (!csrfToken) {
          csrfToken = await ensureCsrfToken() || undefined;
        }
        
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh with queue and retry logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Initialize retry count
    originalRequest._retryCount = originalRequest._retryCount || 0;

    // Handle CSRF token errors (403 with csrfToken in response)
    if (error.response?.status === 403 && error.response?.data?.csrfToken && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      // The server provided a new CSRF token, retry the request
      originalRequest.headers['X-CSRF-Token'] = error.response.data.csrfToken;
      return api(originalRequest);
    }

    // Handle retry logic for network errors and server errors (not 401)
    if (error.response?.status !== 401 && shouldRetry(error, originalRequest._retryCount)) {
      originalRequest._retryCount += 1;
      const delay = getRetryDelay(originalRequest._retryCount - 1);
      console.log(`Retrying request (${originalRequest._retryCount}/${RETRY_CONFIG.maxRetries}) after ${delay}ms...`);
      await sleep(delay);
      return api(originalRequest);
    }

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, add to queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        // Validate that we have a real refresh token
        if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          processQueue(null, accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } else {
          // No valid refresh token
          processQueue(new Error('No valid refresh token'), null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      } catch (refreshError: any) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: { email: string; password: string; fullName: string; phone?: string }) =>
    api.post('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  // FIX Iter-12: backend expects 'newPassword', not 'password'
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  getProfile: () => api.get('/auth/me'),

  // Two-Factor Authentication
  get2FAStatus: () => api.get('/auth/2fa/status'),

  setup2FA: () => api.post('/auth/2fa/setup'),

  enable2FA: (code: string) => api.post('/auth/2fa/enable', { code }),

  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),

  verify2FA: (userId: string, code: string, isBackupCode?: boolean) =>
    api.post('/auth/2fa/verify', { userId, code, isBackupCode }),

  regenerateBackupCodes: (code: string) =>
    api.post('/auth/2fa/backup-codes', { code }),
};

// Restaurant API
export const restaurantApi = {
  getMenu: (moduleId?: string) => api.get('/restaurant/menu', { params: { moduleId } }),
  getMenuByCategory: (categoryId: string, moduleId?: string) =>
    api.get(`/restaurant/menu/category/${categoryId}`, { params: { moduleId } }),
  createOrder: (data: CreateOrderData) => api.post('/restaurant/orders', data),
  getMyOrders: () => api.get('/restaurant/my-orders'),
  getOrderStatus: (orderId: string) => api.get(`/restaurant/orders/${orderId}`),
};

// Snack Bar API
export const snackApi = {
  getItems: (moduleId?: string) => api.get('/snack/items', { params: { moduleId } }),
  createOrder: (data: CreateSnackOrderData) => api.post('/snack/orders', data),
  getMyOrders: () => api.get('/snack/orders/my'),
  getOrder: (orderId: string) => api.get(`/snack/orders/${orderId}`),
};

// Chalets API
export const chaletsApi = {
  getChalets: (moduleId?: string) => api.get('/chalets', { params: { moduleId } }),
  getChalet: (id: string) => api.get(`/chalets/${id}`),
  getAvailability: (chaletId: string, checkIn: string, checkOut: string) =>
    api.get(`/chalets/${chaletId}/availability`, { params: { checkIn, checkOut } }),
  getAddOns: (moduleId?: string) => api.get('/chalets/add-ons', { params: { moduleId } }),
  createBooking: (data: CreateBookingData) => api.post('/chalets/bookings', data),
  getMyBookings: () => api.get('/chalets/my-bookings'),
  getBookingDetails: (bookingId: string) => api.get(`/chalets/bookings/${bookingId}`),
};

// Pool API
export const poolApi = {
  getSessions: (date?: string, moduleId?: string) =>
    api.get('/pool/sessions', { params: { date, moduleId } }),
  getSession: (id: string) => api.get(`/pool/sessions/${id}`),
  getSessionAvailability: (sessionId: string, date: string) =>
    api.get(`/pool/sessions/${sessionId}/availability`, { params: { date } }),
  // FIX: Iteration 6 - Add bulk availability endpoint (returns sessions with live sold/available counts)
  getAvailability: (date: string, moduleId?: string) =>
    api.get('/pool/availability', { params: { date, moduleId } }),
  purchaseTicket: (data: PurchaseTicketData) => api.post('/pool/tickets', data),
  getMyTickets: () => api.get('/pool/my-tickets'),
  getTicket: (id: string) => api.get(`/pool/tickets/${id}`),
};

// Modules API
export const modulesApi = {
  getAll: (activeOnly = false) => api.get(`/admin/modules${activeOnly ? '?activeOnly=true' : ''}`),
  getById: (id: string) => api.get(`/admin/modules/${id}`),
  create: (data: CreateModuleData) => api.post('/admin/modules', data),
  update: (id: string, data: Partial<CreateModuleData>) => api.put(`/admin/modules/${id}`, data),
  delete: (id: string, force = false) => api.delete(`/admin/modules/${id}${force ? '?force=true' : ''}`),
};

// Inventory API
export const inventoryApi = {
  getItems: (params?: any) => api.get('/inventory/items', { params }),
  getRecipe: (menuItemId: string) => api.get(`/inventory/items/recipe/${menuItemId}`),
  updateRecipe: (menuItemId: string, ingredients: any[]) =>
    api.post(`/inventory/items/recipe/${menuItemId}`, { ingredients }),
  getSessionRecipe: (sessionId: string) => api.get(`/inventory/sessions/recipe/${sessionId}`),
  updateSessionRecipe: (sessionId: string, ingredients: any[]) =>
    api.post(`/inventory/sessions/recipe/${sessionId}`, { ingredients }),
};

// Payments API
export const paymentsApi = {
  createPaymentIntent: (data: { amount: number; referenceType: string; referenceId: string }) =>
    api.post('/payments/create-intent', data),
};

// Support API
export const supportApi = {
  submitContact: (data: { name: string; email: string; phone?: string; subject: string; message: string }) =>
    api.post('/support/contact', data),
};

export default api;
