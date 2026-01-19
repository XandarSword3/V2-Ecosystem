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
}

// API_URL should NOT include /api - we add it in baseURL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Ensure we don't double up on /api
const cleanUrl = API_URL.replace(/\/api\/?$/, '');

// Export the base API URL for use in other files
export const API_BASE_URL = `${cleanUrl}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        // Validate that we have a real refresh token (not null, undefined, or the string "undefined")
        if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } else {
          // No valid refresh token - clear tokens and don't redirect automatically
          // (let the calling code handle the failure)
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // Don't automatically redirect - let the component handle the auth state
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
  
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
  
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
  getAddOns: () => api.get('/chalets/add-ons'),
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

// Payments API
export const paymentsApi = {
  createPaymentIntent: (data: { amount: number; referenceType: string; referenceId: string }) =>
    api.post('/payments/create-intent', data),
};

export default api;
