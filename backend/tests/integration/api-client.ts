/**
 * Integration Test API Client
 *
 * HTTP client wrapper for integration tests with auth handling.
 * Adapted from stress test api-client for test assertions.
 */

import { TEST_CONFIG } from './config';
import { testContext, trackResource } from './setup';

interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
}

interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  tokens?: { accessToken?: string; refreshToken?: string };
  user?: { id: string; roles: string[] };
}

export class TestApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  public userId: string | null = null;
  public userRoles: string[] = [];

  constructor(baseUrl = TEST_CONFIG.api.baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set auth token directly (for reusing tokens across tests)
   */
  setToken(token: string | null): void {
    this.accessToken = token;
  }

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return this.accessToken;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Make HTTP request with full response details for assertions
   */
  async request<T = any>(
    endpoint: string,
    method: string,
    body?: any,
    options: { requiresAuth?: boolean; timeout?: number } = {}
  ): Promise<ApiResponse<T>> {
    const { requiresAuth = true, timeout = TEST_CONFIG.api.timeout } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        success: response.ok,
        status: response.status,
        data: data.data ?? data,
        error: data.error,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return { success: false, status: 0, error: 'Request timeout' };
      }
      return { success: false, status: 0, error: error.message };
    }
  }

  // ============ AUTH ============
  async register(
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>(
      '/auth/register',
      'POST',
      { email, password, full_name: fullName, phone },
      { requiresAuth: false }
    );

    if (result.success && result.data) {
      this.accessToken = result.data.accessToken || result.data.tokens?.accessToken || null;
      this.refreshToken = result.data.refreshToken || result.data.tokens?.refreshToken || null;
      this.userId = result.data.user?.id || null;
      this.userRoles = result.data.user?.roles || [];

      if (this.userId) {
        trackResource('users', this.userId);
      }
    }
    return result;
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>(
      '/auth/login',
      'POST',
      { email, password },
      { requiresAuth: false }
    );

    if (result.success && result.data) {
      this.accessToken = result.data.accessToken || result.data.tokens?.accessToken || null;
      this.refreshToken = result.data.refreshToken || result.data.tokens?.refreshToken || null;
      this.userId = result.data.user?.id || null;
      this.userRoles = result.data.user?.roles || [];
    }
    return result;
  }

  async logout(): Promise<ApiResponse> {
    const result = await this.request('/auth/logout', 'POST');
    if (result.success) {
      this.accessToken = null;
      this.refreshToken = null;
      this.userId = null;
      this.userRoles = [];
    }
    return result;
  }

  async refreshTokens(): Promise<ApiResponse<AuthResponse>> {
    if (!this.refreshToken) {
      return { success: false, status: 401, error: 'No refresh token available' };
    }

    const result = await this.request<AuthResponse>(
      '/auth/refresh',
      'POST',
      { refreshToken: this.refreshToken },
      { requiresAuth: false }
    );

    if (result.success && result.data) {
      this.accessToken = result.data.accessToken || result.data.tokens?.accessToken || null;
      this.refreshToken = result.data.refreshToken || result.data.tokens?.refreshToken || this.refreshToken;
    }
    return result;
  }

  async getProfile(): Promise<ApiResponse> {
    return this.request('/auth/me', 'GET');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.request('/auth/change-password', 'POST', { currentPassword, newPassword });
  }

  // ============ RESTAURANT ============
  async getRestaurantMenu(): Promise<ApiResponse> {
    return this.request('/restaurant/menu', 'GET', null, { requiresAuth: false });
  }

  async getRestaurantCategories(): Promise<ApiResponse> {
    return this.request('/restaurant/categories', 'GET', null, { requiresAuth: false });
  }

  async createRestaurantOrder(order: {
    customerName: string;
    customerPhone: string;
    orderType: 'dine_in' | 'takeaway' | 'delivery';
    items: { menuItemId: string; quantity: number; specialInstructions?: string }[];
    tableNumber?: string;
    notes?: string;
  }): Promise<ApiResponse> {
    const result = await this.request('/restaurant/orders', 'POST', order, { requiresAuth: false });
    if (result.success && result.data?.id) {
      trackResource('restaurant_orders', result.data.id);
    }
    return result;
  }

  async getRestaurantOrder(id: string): Promise<ApiResponse> {
    return this.request(`/restaurant/orders/${id}`, 'GET', null, { requiresAuth: false });
  }

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse> {
    return this.request(`/restaurant/orders/${id}/status`, 'PATCH', { status });
  }

  // ============ CHALETS ============
  async getChalets(): Promise<ApiResponse> {
    return this.request('/chalets', 'GET', null, { requiresAuth: false });
  }

  async getChalet(id: string): Promise<ApiResponse> {
    return this.request(`/chalets/${id}`, 'GET', null, { requiresAuth: false });
  }

  async getChaletAvailability(chaletId: string, startDate: string, endDate: string): Promise<ApiResponse> {
    return this.request(
      `/chalets/${chaletId}/availability?start_date=${startDate}&end_date=${endDate}`,
      'GET',
      null,
      { requiresAuth: false }
    );
  }

  async createBooking(booking: {
    chaletId: string;
    checkInDate: string;
    checkOutDate: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    numberOfGuests: number;
    paymentMethod?: string;
  }): Promise<ApiResponse> {
    const result = await this.request('/chalets/bookings', 'POST', booking, { requiresAuth: false });
    if (result.success && result.data?.id) {
      trackResource('chalet_bookings', result.data.id);
    }
    return result;
  }

  async getBooking(id: string): Promise<ApiResponse> {
    return this.request(`/chalets/bookings/${id}`, 'GET');
  }

  async checkIn(bookingId: string): Promise<ApiResponse> {
    return this.request(`/chalets/bookings/${bookingId}/check-in`, 'POST');
  }

  async checkOut(bookingId: string): Promise<ApiResponse> {
    return this.request(`/chalets/bookings/${bookingId}/check-out`, 'POST');
  }

  // ============ POOL ============
  async getPoolStatus(): Promise<ApiResponse> {
    return this.request('/pool/status', 'GET', null, { requiresAuth: false });
  }

  async getPoolTicketTypes(): Promise<ApiResponse> {
    return this.request('/pool/ticket-types', 'GET', null, { requiresAuth: false });
  }

  async purchasePoolTicket(ticket: {
    ticketTypeId: string;
    customerName: string;
    customerPhone: string;
    visitDate: string;
    quantity?: number;
    paymentMethod?: string;
  }): Promise<ApiResponse> {
    const result = await this.request('/pool/tickets', 'POST', ticket, { requiresAuth: false });
    if (result.success && result.data?.id) {
      trackResource('pool_tickets', result.data.id);
    }
    return result;
  }

  async getPoolTicket(id: string): Promise<ApiResponse> {
    return this.request(`/pool/tickets/${id}`, 'GET', null, { requiresAuth: false });
  }

  async validatePoolTicket(ticketId: string): Promise<ApiResponse> {
    return this.request(`/pool/tickets/${ticketId}/validate`, 'POST');
  }

  // ============ SNACK BAR ============
  async getSnackCategories(): Promise<ApiResponse> {
    return this.request('/snack/categories', 'GET', null, { requiresAuth: false });
  }

  async getSnackItems(): Promise<ApiResponse> {
    return this.request('/snack/items', 'GET', null, { requiresAuth: false });
  }

  async createSnackOrder(order: {
    customerName: string;
    customerPhone: string;
    items: { itemId: string; quantity: number }[];
    tableNumber?: string;
  }): Promise<ApiResponse> {
    const result = await this.request('/snack/orders', 'POST', order, { requiresAuth: false });
    if (result.success && result.data?.id) {
      trackResource('snack_orders', result.data.id);
    }
    return result;
  }

  // ============ PAYMENTS ============
  async createPaymentIntent(payment: {
    amount: number;
    currency: string;
    referenceType: string;
    referenceId: string;
  }): Promise<ApiResponse> {
    return this.request('/payments/intent', 'POST', payment);
  }

  async confirmPayment(paymentIntentId: string): Promise<ApiResponse> {
    return this.request('/payments/confirm', 'POST', { paymentIntentId });
  }

  // ============ ADMIN ============
  async getAdminDashboard(): Promise<ApiResponse> {
    return this.request('/admin/dashboard', 'GET');
  }

  async getAdminUsers(params?: { page?: number; limit?: number }): Promise<ApiResponse> {
    const query = params ? `?page=${params.page || 1}&limit=${params.limit || 20}` : '';
    return this.request(`/admin/users${query}`, 'GET');
  }

  async getAdminReports(type: string): Promise<ApiResponse> {
    return this.request(`/admin/reports/${type}`, 'GET');
  }

  // ============ HEALTH ============
  async healthCheck(): Promise<ApiResponse> {
    return this.request('/health', 'GET', null, { requiresAuth: false });
  }
}

/**
 * Create client pre-authenticated as admin
 */
export async function createAdminClient(): Promise<TestApiClient> {
  const client = new TestApiClient();

  if (testContext.adminToken) {
    client.setToken(testContext.adminToken);
  } else {
    const result = await client.login(
      TEST_CONFIG.users.admin.email,
      TEST_CONFIG.users.admin.password
    );
    if (result.success) {
      testContext.adminToken = client.getToken();
    }
  }

  return client;
}

/**
 * Create client pre-authenticated as staff
 */
export async function createStaffClient(): Promise<TestApiClient> {
  const client = new TestApiClient();

  if (testContext.staffToken) {
    client.setToken(testContext.staffToken);
  } else {
    const result = await client.login(
      TEST_CONFIG.users.staff.email,
      TEST_CONFIG.users.staff.password
    );
    if (result.success) {
      testContext.staffToken = client.getToken();
    }
  }

  return client;
}

/**
 * Create client pre-authenticated as customer
 */
export async function createCustomerClient(): Promise<TestApiClient> {
  const client = new TestApiClient();

  if (testContext.customerToken) {
    client.setToken(testContext.customerToken);
  } else {
    const result = await client.login(
      TEST_CONFIG.users.customer.email,
      TEST_CONFIG.users.customer.password
    );
    if (result.success) {
      testContext.customerToken = client.getToken();
    }
  }

  return client;
}

/**
 * Create unauthenticated client
 */
export function createGuestClient(): TestApiClient {
  return new TestApiClient();
}
