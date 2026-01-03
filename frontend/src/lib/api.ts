import axios from 'axios';

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
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
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
};

// Restaurant API
export const restaurantApi = {
  getMenu: (moduleId?: string) => api.get('/restaurant/menu', { params: { moduleId } }),
  getMenuByCategory: (categoryId: string, moduleId?: string) => 
    api.get(`/restaurant/menu/category/${categoryId}`, { params: { moduleId } }),
  createOrder: (data: any) => api.post('/restaurant/orders', data),
  getMyOrders: () => api.get('/restaurant/my-orders'),
  getOrderStatus: (orderId: string) => api.get(`/restaurant/orders/${orderId}`),
};

// Snack Bar API
export const snackApi = {
  getItems: () => api.get('/snack/items'),
  createOrder: (data: any) => api.post('/snack/orders', data),
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
  createBooking: (data: any) => api.post('/chalets/bookings', data),
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
  purchaseTicket: (data: any) => api.post('/pool/tickets', data),
  getMyTickets: () => api.get('/pool/my-tickets'),
  getTicket: (id: string) => api.get(`/pool/tickets/${id}`),
};

// Modules API
export const modulesApi = {
  getAll: (activeOnly = false) => api.get(`/admin/modules${activeOnly ? '?activeOnly=true' : ''}`),
  getById: (id: string) => api.get(`/admin/modules/${id}`),
  create: (data: any) => api.post('/admin/modules', data),
  update: (id: string, data: any) => api.put(`/admin/modules/${id}`, data),
  delete: (id: string) => api.delete(`/admin/modules/${id}`),
};

// Payments API
export const paymentsApi = {
  createPaymentIntent: (data: { amount: number; referenceType: string; referenceId: string }) =>
    api.post('/payments/create-intent', data),
};

export default api;
