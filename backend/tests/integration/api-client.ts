/**
 * Integration Test API Client
 *
 * HTTP client for integration tests. All module commerce is engine-based:
 * records are stored in `transactions` (see ARCHITECTURE_LAW.md).
 * Module slugs (`/restaurant`, `/chalets`, `/pool`, `/snack-bar`) expose REST
 * surfaces; staff operations use `/staff/modules/:slug/*`.
 */

import { TEST_CONFIG } from './config';
import { testContext, trackResource, trackTransaction } from './setup';
import { ModuleSlug } from './engine-refit-helpers';

interface ApiResponse<T = unknown> {
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

  setToken(token: string | null): void {
    this.accessToken = token;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async request<T = unknown>(
    endpoint: string,
    method: string,
    body?: unknown,
    options: { requiresAuth?: boolean; timeout?: number } = {},
  ): Promise<ApiResponse<T>> {
    const { requiresAuth = true, timeout = TEST_CONFIG.api.timeout } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Integration-Test': 'true',
    };

    if (requiresAuth && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
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

      let data: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const payload = data as { data?: T; error?: string };
      return {
        success: response.ok,
        status: response.status,
        data: payload.data ?? (data as T),
        error: payload.error,
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const err = error as { name?: string; message?: string };
      if (err.name === 'AbortError') {
        return { success: false, status: 0, error: 'Request timeout' };
      }
      return { success: false, status: 0, error: err.message ?? 'Request failed' };
    }
  }

  // ============ AUTH ============

  async register(
    email: string,
    password: string,
    fullName: string,
    phone?: string,
  ): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>(
      '/auth/register',
      'POST',
      { email, password, fullName, phone },
      { requiresAuth: false },
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
      { requiresAuth: false },
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
      { requiresAuth: false },
    );

    if (result.success && result.data) {
      this.accessToken = result.data.accessToken || result.data.tokens?.accessToken || null;
      this.refreshToken =
        result.data.refreshToken || result.data.tokens?.refreshToken || this.refreshToken;
    }
    return result;
  }

  async getProfile(): Promise<ApiResponse> {
    return this.request('/auth/me', 'GET');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.request('/auth/change-password', 'POST', { currentPassword, newPassword });
  }

  // ============ RESTAURANT (menu_service → instant_transaction) ============

  async getRestaurantMenu(): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.RESTAURANT}/items`, 'GET');
  }

  /** Creates an `instant_transaction` row via the restaurant module API. */
  async createRestaurantTransaction(order: {
    customerName: string;
    customerPhone: string;
    orderType: 'dine_in' | 'takeaway' | 'delivery';
    items: { menuItemId: string; quantity: number; specialInstructions?: string }[];
    tableNumber?: string;
    notes?: string;
  }): Promise<ApiResponse> {
    const items = order.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
    }));
    const result = await this.request(`/${ModuleSlug.RESTAURANT}/orders`, 'POST', {
      items,
      notes: order.notes,
      metadata: {
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        order_type: order.orderType,
        table_number: order.tableNumber,
      },
    });
    if (result.success && result.data && typeof result.data === 'object' && 'id' in result.data) {
      trackTransaction(String((result.data as { id: string }).id));
    }
    return result;
  }

  async getRestaurantTransaction(id: string): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.RESTAURANT}/orders/${id}`, 'GET');
  }

  async updateRestaurantTransactionStatus(id: string, status: string): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.RESTAURANT}/orders/${id}/status`, 'PATCH', { status });
  }

  // ============ CHALETS (multi_day_booking → time_exclusive_reservation) ============

  async getChaletUnits(): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.CHALETS}/availability`, 'GET');
  }

  async getChaletAvailability(startDate: string, endDate: string): Promise<ApiResponse> {
    return this.request(
      `/${ModuleSlug.CHALETS}/availability?start=${startDate}&end=${endDate}`,
      'GET',
    );
  }

  async createChaletReservation(reservation: {
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    numberOfGuests: number;
    totalAmount?: number;
    paymentMethod?: string;
  }): Promise<ApiResponse> {
    const result = await this.request(`/${ModuleSlug.CHALETS}/bookings`, 'POST', {
      unit_id: reservation.unitId,
      check_in_date: reservation.checkInDate,
      check_out_date: reservation.checkOutDate,
      total_amount: reservation.totalAmount ?? 0,
      metadata: {
        customer_name: reservation.customerName,
        customer_email: reservation.customerEmail,
        customer_phone: reservation.customerPhone,
        number_of_guests: reservation.numberOfGuests,
        payment_method: reservation.paymentMethod,
      },
    });
    if (result.success && result.data && typeof result.data === 'object' && 'id' in result.data) {
      trackTransaction(String((result.data as { id: string }).id));
    }
    return result;
  }

  async getChaletReservation(id: string): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.CHALETS}/bookings/${id}`, 'GET');
  }

  async updateChaletReservationStatus(
    reservationId: string,
    status: string,
  ): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.CHALETS}/bookings/${reservationId}/status`, 'PATCH', {
      status,
    });
  }

  // ============ POOL (session_access → shared_capacity_access) ============

  async getPoolSessions(): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.POOL}/sessions`, 'GET');
  }

  async purchasePoolAccess(ticket: {
    sessionId: string;
    quantity?: number;
    unitPrice?: number;
  }): Promise<ApiResponse> {
    const result = await this.request(`/${ModuleSlug.POOL}/tickets`, 'POST', {
      session_id: ticket.sessionId,
      quantity: ticket.quantity ?? 1,
      unit_price: ticket.unitPrice ?? 0,
    });
    if (result.success && result.data && typeof result.data === 'object' && 'id' in result.data) {
      trackTransaction(String((result.data as { id: string }).id));
    }
    return result;
  }

  async getPoolTransaction(id: string): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.POOL}/tickets/${id}`, 'GET');
  }

  async validatePoolTransaction(transactionId: string): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.POOL}/tickets/${transactionId}/validate`, 'PATCH');
  }

  async recordPoolEntry(transactionId: string): Promise<ApiResponse> {
    return this.request(`/staff/modules/${ModuleSlug.POOL}/entry`, 'POST', {
      ticketId: transactionId,
    });
  }

  async recordPoolExit(transactionId: string): Promise<ApiResponse> {
    return this.request(`/staff/modules/${ModuleSlug.POOL}/exit`, 'POST', {
      ticketId: transactionId,
    });
  }

  async getPoolCapacity(): Promise<ApiResponse> {
    return this.request(`/staff/modules/${ModuleSlug.POOL}/capacity`, 'GET');
  }

  // ============ SNACK BAR (menu_service → instant_transaction) ============

  async getSnackMenu(): Promise<ApiResponse> {
    return this.request(`/${ModuleSlug.SNACK_BAR}/items`, 'GET');
  }

  async createSnackTransaction(order: {
    items: { menuItemId: string; quantity: number }[];
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse> {
    const items = order.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
    }));
    const result = await this.request(`/${ModuleSlug.SNACK_BAR}/orders`, 'POST', {
      items,
      metadata: order.metadata,
    });
    if (result.success && result.data && typeof result.data === 'object' && 'id' in result.data) {
      trackTransaction(String((result.data as { id: string }).id));
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

  // ── Aliases for older scenario tests (engine-refit implementations only) ──

  async createRestaurantOrder(
    order: Parameters<TestApiClient['createRestaurantTransaction']>[0],
  ) {
    return this.createRestaurantTransaction(order);
  }

  async getRestaurantOrder(id: string) {
    return this.getRestaurantTransaction(id);
  }

  async updateOrderStatus(id: string, status: string) {
    return this.updateRestaurantTransactionStatus(id, status);
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
    totalAmount?: number;
  }) {
    return this.createChaletReservation({
      unitId: booking.chaletId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      numberOfGuests: booking.numberOfGuests,
      paymentMethod: booking.paymentMethod,
      totalAmount: booking.totalAmount,
    });
  }

  async getBooking(id: string) {
    return this.getChaletReservation(id);
  }

  async checkIn(reservationId: string) {
    return this.updateChaletReservationStatus(reservationId, 'active');
  }

  async checkOut(reservationId: string) {
    return this.updateChaletReservationStatus(reservationId, 'used');
  }

  async getChalet(id: string) {
    return this.getChaletReservation(id);
  }

  async purchasePoolTicket(ticket: {
    sessionId: string;
    customerName?: string;
    customerPhone?: string;
    numberOfGuests?: number;
    ticketDate?: string;
    visitDate?: string;
    paymentMethod?: string;
    ticketTypeId?: string;
    quantity?: number;
    unitPrice?: number;
  }) {
    return this.purchasePoolAccess({
      sessionId: ticket.sessionId,
      quantity: ticket.numberOfGuests ?? ticket.quantity ?? 1,
      unitPrice: ticket.unitPrice ?? 0,
    });
  }

  async getPoolTicket(id: string) {
    return this.getPoolTransaction(id);
  }

  async validatePoolTicket(transactionId: string) {
    return this.validatePoolTransaction(transactionId);
  }

  async getPoolStatus() {
    return this.getPoolSessions();
  }

  async createSnackOrder(
    order: Parameters<TestApiClient['createSnackTransaction']>[0],
  ) {
    return this.createSnackTransaction(order);
  }
}

export async function createAdminClient(): Promise<TestApiClient> {
  const client = new TestApiClient();

  if (testContext.adminToken) {
    client.setToken(testContext.adminToken);
  } else {
    const result = await client.login(
      TEST_CONFIG.users.admin.email,
      TEST_CONFIG.users.admin.password,
    );
    if (result.success) {
      testContext.adminToken = client.getToken();
    }
  }

  return client;
}

export async function createStaffClient(): Promise<TestApiClient> {
  const client = new TestApiClient();

  if (testContext.staffToken) {
    client.setToken(testContext.staffToken);
  } else {
    const result = await client.login(
      TEST_CONFIG.users.staff.email,
      TEST_CONFIG.users.staff.password,
    );
    if (result.success) {
      testContext.staffToken = client.getToken();
    }
  }

  return client;
}

export async function createCustomerClient(): Promise<TestApiClient> {
  const client = new TestApiClient();

  if (testContext.customerToken) {
    client.setToken(testContext.customerToken);
  } else {
    const result = await client.login(
      TEST_CONFIG.users.customer.email,
      TEST_CONFIG.users.customer.password,
    );
    if (result.success) {
      testContext.customerToken = client.getToken();
    }
  }

  return client;
}

export function createGuestClient(): TestApiClient {
  return new TestApiClient();
}
