/**
 * Phase 2 Verification Program — Extended API Client
 *
 * Engine-refit aligned (ARCHITECTURE_LAW.md):
 * - Commerce records are `transactions` rows (never restaurant_orders / pool_tickets / …).
 * - Customer module routes: `/{moduleSlug}/orders|bookings|tickets|sessions`.
 * - Staff module routes: `/staff/modules/{slug}/…` (entry, exit, capacity, validate-ticket).
 */

import { TEST_CONFIG } from '../config';
import { ModuleSlug, trackTransaction } from '../engine-refit-helpers';

interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  raw?: any;
}

export class Phase2Client {
  private baseUrl: string;
  private token: string | null = null;
  public userId: string | null = null;

  /**
   * Static CSRF token shared across all Phase2Client instances.
   * The API uses Double Submit Cookie pattern — we send the same
   * arbitrary token in both the `Cookie: csrf-token=<tok>` header
   * and the `X-CSRF-Token: <tok>` header.
   */
  private static csrfToken: string = 'phase2-integration-test-csrf-token-' +
    Math.random().toString(36).slice(2);

  constructor(baseUrl = TEST_CONFIG.api.baseUrl) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  // ───────── Core HTTP ─────────

  private static readonly SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

  async request<T = any>(
    endpoint: string,
    method: string,
    body?: any,
    opts: { auth?: boolean; timeout?: number } = {}
  ): Promise<ApiResponse<T>> {
    const { auth = true, timeout = 30_000 } = opts;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Integration-Test': 'true',
    };
    if (auth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Include CSRF token for all write methods (POST, PUT, PATCH, DELETE)
    if (!Phase2Client.SAFE_METHODS.includes(method.toUpperCase())) {
      headers['X-CSRF-Token'] = Phase2Client.csrfToken;
      headers['Cookie'] = `csrf-token=${Phase2Client.csrfToken}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      let data: any;
      const ct = res.headers.get('content-type');
      if (ct?.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      return {
        success: res.ok,
        status: res.status,
        data: data?.data ?? data,
        error: data?.error ?? data?.message,
        raw: data,
      };
    } catch (err: any) {
      clearTimeout(timer);
      return {
        success: false,
        status: 0,
        error: err.name === 'AbortError' ? 'Request timeout' : err.message,
      };
    }
  }

  get<T = any>(endpoint: string, opts?: { auth?: boolean }) {
    return this.request<T>(endpoint, 'GET', undefined, opts);
  }
  post<T = any>(endpoint: string, body?: any, opts?: { auth?: boolean }) {
    return this.request<T>(endpoint, 'POST', body, opts);
  }
  put<T = any>(endpoint: string, body?: any, opts?: { auth?: boolean }) {
    return this.request<T>(endpoint, 'PUT', body, opts);
  }
  patch<T = any>(endpoint: string, body?: any, opts?: { auth?: boolean }) {
    return this.request<T>(endpoint, 'PATCH', body, opts);
  }
  delete<T = any>(endpoint: string, opts?: { auth?: boolean }) {
    return this.request<T>(endpoint, 'DELETE', undefined, opts);
  }

  // ───────── Auth ─────────

  async login(email: string, password: string): Promise<ApiResponse> {
    const res = await this.post('/auth/login', { email, password }, { auth: false });
    if (res.success && res.data) {
      this.token = res.data.accessToken || res.data.tokens?.accessToken || null;
      this.userId = res.data.user?.id || res.data.id || null;
    }
    return res;
  }

  async register(data: {
    email: string;
    password: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<ApiResponse> {
    const res = await this.post('/auth/register', data, { auth: false });
    if (res.success && res.data) {
      // Registration response may or may not include tokens.
      // Try to extract tokens; if not present, auto-login.
      const accessToken = res.data.accessToken || res.data.tokens?.accessToken;
      if (accessToken) {
        this.token = accessToken;
        this.userId = res.data.user?.id || res.data.id || null;
      } else {
        // Registration succeeded but no token — login to get one
        this.userId = res.data.user?.id || res.data.id || null;
        const loginRes = await this.login(data.email, data.password);
        if (!loginRes.success) {
          // Return the original registration success but note the login failure
          res.error = `Registered but login failed: ${loginRes.error}`;
        }
      }
    }
    return res;
  }

  // ───────── Admin Settings ─────────

  async getSettings(): Promise<ApiResponse> {
    return this.get('/admin/settings');
  }

  async updateSettings(key: string, value: any): Promise<ApiResponse> {
    return this.put('/admin/settings', { key, value });
  }

  // ───────── Modules ─────────

  async getModules(): Promise<ApiResponse> {
    return this.get('/admin/modules');
  }

  async createModule(data: {
    name: string;
    slug: string;
    description?: string;
    template_type: string;
    is_active?: boolean;
    show_in_main?: boolean;
    settings?: any;
  }): Promise<ApiResponse> {
    return this.post('/admin/modules', data);
  }

  async updateModule(id: string, data: any): Promise<ApiResponse> {
    return this.put(`/admin/modules/${id}`, data);
  }

  // ───────── Restaurant ─────────

  async getMenu(moduleId?: string): Promise<ApiResponse> {
    const qs = moduleId ? `?moduleId=${moduleId}` : '';
    const itemsRes = await this.get(`/${ModuleSlug.RESTAURANT}/items${qs}`);
    if (itemsRes.success) return itemsRes;
    return this.get(`/${ModuleSlug.RESTAURANT}/menu${qs}`);
  }

  async createCategory(data: {
    name: string;
    module_id: string;
    display_order?: number;
    sort_order?: number;
    description?: string;
  }): Promise<ApiResponse> {
    const res = await this.post('/admin/import/menu', {
      moduleId: data.module_id,
      items: [
        {
          name: `${data.name} Placeholder`,
          category: data.name,
          price: 0,
          is_available: false,
        },
      ],
    });

    if (!res.success) return res;
    const first = Array.isArray(res.data) ? res.data[0] : null;
    const categoryId = first?.category_id;
    return {
      ...res,
      data: {
        id: categoryId,
        category: { id: categoryId },
      },
    };
  }

  async createMenuItem(data: {
    name: string;
    category_id: string;
    price: number;
    module_id: string;
    description?: string;
    is_available?: boolean;
    is_featured?: boolean;
    is_vegetarian?: boolean;
    is_vegan?: boolean;
    is_gluten_free?: boolean;
  }): Promise<ApiResponse> {
    const res = await this.post('/admin/import/menu', {
      moduleId: data.module_id,
      items: [
        {
          name: data.name,
          category_id: data.category_id,
          price: data.price,
          description: data.description,
          is_available: data.is_available,
          is_featured: data.is_featured,
          is_vegetarian: data.is_vegetarian,
          is_vegan: data.is_vegan,
          is_gluten_free: data.is_gluten_free,
        },
      ],
    });

    if (!res.success) return res;
    const first = Array.isArray(res.data) ? res.data[0] : null;
    return {
      ...res,
      data: first || res.data,
    };
  }

  async createModifierGroup(data: {
    name: string;
    min_selections?: number;
    max_selections?: number;
    is_required?: boolean;
    module_id?: string;
    options?: {
      name: string;
      price?: number;
      is_available?: boolean;
    }[];
  }): Promise<ApiResponse> {
    const selectionMode = (data.max_selections ?? 1) > 1 ? 'multiple' : 'single';
    const groupRes = await this.post('/customizations/groups', {
      name: data.name,
      selectionMode,
      minSelections: data.min_selections ?? 0,
      maxSelections: data.max_selections ?? 1,
      isRequired: data.is_required ?? false,
      applicableEntityTypes: ['menu_item'],
      isGlobal: false,
    });

    if (!groupRes.success) return groupRes;

    const groupId = groupRes.data?.id;
    if (!groupId) return groupRes;

    const options: Array<{ id: string; name: string }> = [];
    if (Array.isArray(data.options)) {
      for (const option of data.options) {
        const optionRes = await this.post('/customizations/options', {
          groupId,
          name: option.name,
          customizationType: 'add',
          priceAdjustment: option.price ?? 0,
          priceType: 'fixed',
          isAvailable: option.is_available ?? true,
        });
        if (optionRes.success && optionRes.data?.id) {
          options.push({ id: optionRes.data.id, name: option.name });
        }
      }
    }

    return {
      ...groupRes,
      data: {
        id: groupId,
        options,
      },
    };
  }

  async linkModifiersToItem(
    menuItemId: string,
    modifierGroupIds: { groupId: string; sortOrder?: number }[]
  ): Promise<ApiResponse> {
    let lastRes: ApiResponse = { success: true, status: 200 };
    for (const modifier of modifierGroupIds) {
      lastRes = await this.post('/customizations/entity-links', {
        entityType: 'menu_item',
        entityId: menuItemId,
        customizationGroupId: modifier.groupId,
        sortOrder: modifier.sortOrder ?? 0,
        isEnabled: true,
        priceMultiplier: 1,
      });
      if (!lastRes.success) {
        return lastRes;
      }
    }
    return lastRes;
  }

  async createTable(data: {
    table_number: string;
    capacity?: number;
    section?: string;
    module_id?: string;
  }): Promise<ApiResponse> {
    return this.post('/restaurant/admin/tables', data);
  }

  async getTables(moduleId?: string): Promise<ApiResponse> {
    const qs = moduleId ? `?moduleId=${moduleId}` : '';
    return this.get(`/restaurant/tables${qs}`);
  }

  async createOrder(data: {
    customerName: string;
    customerPhone?: string;
    orderType: string;
    tableNumber?: string;
    items: {
      menuItemId: string;
      quantity: number;
      notes?: string;
      selectedModifiers?: any;
      modifierTotal?: number;
    }[];
    paymentMethod: string;
    specialInstructions?: string;
    couponCode?: string;
    giftCardRedemptions?: any;
    loyaltyPointsToRedeem?: number;
    loyaltyPointsDollarValue?: number;
  }): Promise<ApiResponse> {
    const items = data.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
    }));
    const res = await this.post(`/${ModuleSlug.RESTAURANT}/orders`, {
      items,
      metadata: {
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        order_type: data.orderType,
        table_number: data.tableNumber,
        payment_method: data.paymentMethod,
        coupon_code: data.couponCode,
      },
    });
    if (res.success && res.data?.id) {
      trackTransaction(res.data.id);
    }
    return res;
  }

  async getOrder(id: string): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.RESTAURANT}/orders/${id}`);
  }

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse> {
    return this.patch(`/${ModuleSlug.RESTAURANT}/orders/${id}/status`, { status });
  }

  // ───────── Chalets ─────────

  async getChalets(): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.CHALETS}/availability`);
  }

  async getChalet(id: string): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.CHALETS}/bookings/${id}`);
  }

  async createChalet(data: {
    name: string;
    description?: string;
    capacity?: number;
    base_price?: number;
    price_per_night?: number;
    weekend_price?: number;
    images?: string[];
    is_active?: boolean;
    module_id?: string;
  }): Promise<ApiResponse> {
    const res = await this.post(`/${ModuleSlug.CHALETS}/import/commit`, {
      moduleId: data.module_id,
      items: [
        {
          name: data.name,
          description: data.description,
          maxGuests: data.capacity ?? 2,
          basePrice: data.base_price ?? data.price_per_night ?? 100,
        },
      ],
    });
    if (!res.success) {
      return this.post(`/${ModuleSlug.CHALETS}/bookings`, data);
    }
    return res;
  }

  async createPriceRule(data: {
    chalet_id?: string | null;
    name: string;
    start_date: string;
    end_date: string;
    price_multiplier?: number;
    price?: number;
    priority?: number;
    is_active?: boolean;
  }): Promise<ApiResponse> {
    return this.post('/chalets/admin/price-rules', data);
  }

  async createAddOn(data: {
    name: string;
    description?: string;
    price: number;
    price_type?: string;
    is_active?: boolean;
  }): Promise<ApiResponse> {
    return this.post('/chalets/admin/add-ons', data);
  }

  async getAddOns(moduleId?: string): Promise<ApiResponse> {
    const qs = moduleId ? `?moduleId=${moduleId}` : '';
    return this.get(`/chalets/add-ons${qs}`);
  }

  async getChaletAvailability(
    chaletId: string,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse> {
    return this.get(
      `/${ModuleSlug.CHALETS}/availability?start=${startDate}&end=${endDate}`,
    );
  }

  async createBooking(data: {
    chaletId: string;
    checkInDate: string;
    checkOutDate: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    numberOfGuests: number;
    paymentMethod?: string;
    addOns?: { addOnId: string; quantity?: number }[];
    notes?: string;
  }): Promise<ApiResponse> {
    const res = await this.post(`/${ModuleSlug.CHALETS}/bookings`, {
      unit_id: data.chaletId,
      check_in_date: data.checkInDate,
      check_out_date: data.checkOutDate,
      total_amount: 0,
      metadata: {
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        customer_phone: data.customerPhone,
        number_of_guests: data.numberOfGuests,
        payment_method: data.paymentMethod,
        add_ons: data.addOns,
      },
    });
    if (res.success && res.data?.id) {
      trackTransaction(res.data.id);
    }
    return res;
  }

  async getBooking(id: string): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.CHALETS}/bookings/${id}`);
  }

  async checkInBooking(bookingId: string): Promise<ApiResponse> {
    return this.patch(`/${ModuleSlug.CHALETS}/bookings/${bookingId}/status`, { status: 'active' });
  }

  async checkOutBooking(bookingId: string): Promise<ApiResponse> {
    return this.patch(`/${ModuleSlug.CHALETS}/bookings/${bookingId}/status`, { status: 'used' });
  }

  async cancelBooking(bookingId: string): Promise<ApiResponse> {
    return this.patch(`/${ModuleSlug.CHALETS}/bookings/${bookingId}/status`, { status: 'cancelled' });
  }

  async getChaletSettings(): Promise<ApiResponse> {
    return this.get('/chalets/admin/settings');
  }

  async updateChaletSettings(data: any): Promise<ApiResponse> {
    return this.put('/chalets/admin/settings', data);
  }

  // ───────── Pool ─────────

  async getPoolSessions(moduleId?: string): Promise<ApiResponse> {
    const qs = moduleId ? `?moduleId=${moduleId}` : '';
    return this.get(`/${ModuleSlug.POOL}/sessions${qs}`);
  }

  async createPoolSession(data: {
    name: string;
    start_time: string;
    end_time: string;
    max_capacity?: number;
    capacity?: number;
    adult_price?: number;
    child_price?: number;
    price?: number;
    module_id?: string;
    gender_restriction?: string;
  }): Promise<ApiResponse> {
    return this.post(`/${ModuleSlug.POOL}/import/commit`, {
      moduleId: data.module_id,
      items: [
        {
          name: data.name,
          startTime: data.start_time,
          endTime: data.end_time,
          capacity: data.max_capacity ?? data.capacity ?? 50,
          adultPrice: data.adult_price ?? data.price ?? 15,
          childPrice: data.child_price ?? 8,
        },
      ],
    });
  }

  async purchasePoolTicket(data: {
    sessionId: string;
    customerName: string;
    customerPhone?: string;
    numberOfGuests?: number;
    ticketDate?: string;
    visitDate?: string;
    paymentMethod?: string;
    guestType?: string;
  }): Promise<ApiResponse> {
    const res = await this.post(`/${ModuleSlug.POOL}/tickets`, {
      session_id: data.sessionId,
      quantity: data.numberOfGuests ?? 1,
      unit_price: 0,
      metadata: {
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        ticket_date: data.ticketDate ?? data.visitDate,
        payment_method: data.paymentMethod,
      },
    });
    if (res.success && res.data?.id) {
      trackTransaction(res.data.id);
    }
    return res;
  }

  async getPoolTicket(id: string): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.POOL}/tickets/${id}`);
  }

  async validatePoolTicket(transactionId: string): Promise<ApiResponse> {
    const patchRes = await this.patch(`/${ModuleSlug.POOL}/tickets/${transactionId}/validate`);
    if (patchRes.status !== 404) return patchRes;
    return this.post(`/staff/modules/${ModuleSlug.POOL}/validate-ticket`, {
      ticketNumber: transactionId,
    });
  }

  async recordPoolEntry(transactionId: string): Promise<ApiResponse> {
    return this.post(`/staff/modules/${ModuleSlug.POOL}/entry`, { ticketId: transactionId });
  }

  async recordPoolExit(transactionId: string): Promise<ApiResponse> {
    return this.post(`/staff/modules/${ModuleSlug.POOL}/exit`, { ticketId: transactionId });
  }

  async getPoolCapacity(): Promise<ApiResponse> {
    return this.get(`/staff/modules/${ModuleSlug.POOL}/capacity`);
  }

  async getPoolAvailability(date?: string, sessionId?: string): Promise<ApiResponse> {
    const params: string[] = [];
    if (date) params.push(`date=${date}`);
    if (sessionId) params.push(`sessionId=${sessionId}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.get(`/${ModuleSlug.POOL}/sessions${qs}`);
  }

  async getPoolSettings(): Promise<ApiResponse> {
    return this.get('/pool/settings');
  }

  async updatePoolSettings(data: any): Promise<ApiResponse> {
    return this.put('/pool/admin/settings', data);
  }

  async resetPoolOccupancy(): Promise<ApiResponse> {
    return this.post('/pool/admin/reset-occupancy');
  }

  // ───────── Loyalty ─────────

  async getLoyaltySettings(): Promise<ApiResponse> {
    return this.get('/loyalty/settings');
  }

  async updateLoyaltySettings(data: any): Promise<ApiResponse> {
    return this.put('/loyalty/settings', data);
  }

  async getLoyaltyTiers(): Promise<ApiResponse> {
    return this.get('/loyalty/tiers');
  }

  async createLoyaltyTier(data: {
    name: string;
    min_points?: number;
    points_multiplier?: number;
    points_required?: number;
    color?: string;
    benefits?: any;
    is_active?: boolean;
  }): Promise<ApiResponse> {
    return this.post('/loyalty/tiers', data);
  }

  async enrollLoyalty(): Promise<ApiResponse> {
    return this.post('/loyalty/enroll');
  }

  async getMyLoyalty(): Promise<ApiResponse> {
    return this.get('/loyalty/me');
  }

  async getMyLoyaltyTransactions(): Promise<ApiResponse> {
    return this.get('/loyalty/me/transactions');
  }

  async getLoyaltyAccounts(): Promise<ApiResponse> {
    return this.get('/loyalty/accounts');
  }

  async getLoyaltyAccount(userId: string): Promise<ApiResponse> {
    return this.get(`/loyalty/accounts/${userId}`);
  }

  async earnLoyaltyPoints(data: {
    userId: string;
    points: number;
    reason?: string;
    orderId?: string;
  }): Promise<ApiResponse> {
    return this.post('/loyalty/earn', data);
  }

  async redeemLoyaltyPoints(data: {
    userId: string;
    points: number;
    reason?: string;
  }): Promise<ApiResponse> {
    return this.post('/loyalty/redeem', data);
  }

  async adjustLoyaltyPoints(data: {
    userId: string;
    points: number;
    reason?: string;
  }): Promise<ApiResponse> {
    return this.post('/loyalty/adjust', data);
  }

  // ───────── Coupons ─────────

  async getCoupons(): Promise<ApiResponse> {
    return this.get('/coupons');
  }

  async createCoupon(data: Record<string, any>): Promise<ApiResponse> {
    return this.post('/coupons', data);
  }

  async validateCoupon(
    code: string,
    orderTotal?: number,
    moduleSlug?: string
  ): Promise<ApiResponse> {
    const body: any = { code };
    if (orderTotal !== undefined) body.orderTotal = orderTotal;
    if (moduleSlug) body.moduleSlug = moduleSlug;
    return this.post('/coupons/validate', body, { auth: false });
  }

  async applyCoupon(code: string, orderTotal?: number): Promise<ApiResponse> {
    return this.post('/coupons/apply', { code, order_total: orderTotal });
  }

  // ───────── Gift Cards ─────────

  async getGiftCards(): Promise<ApiResponse> {
    return this.get('/giftcards');
  }

  async createGiftCard(data: Record<string, any>): Promise<ApiResponse> {
    return this.post('/giftcards', data);
  }

  async checkGiftCardBalance(code: string): Promise<ApiResponse> {
    return this.get(`/giftcards/check/${code}`, { auth: false });
  }

  async redeemGiftCard(code: string, amount: number): Promise<ApiResponse> {
    return this.post('/giftcards/redeem', { code, amount });
  }

  // ───────── Housekeeping ─────────

  async getHousekeepingTaskTypes(): Promise<ApiResponse> {
    return this.get('/housekeeping/task-types');
  }

  async createHousekeepingTaskType(data: {
    name: string;
    description?: string;
  }): Promise<ApiResponse> {
    return this.post('/housekeeping/task-types', data);
  }

  async getHousekeepingTasks(): Promise<ApiResponse> {
    return this.get('/housekeeping/tasks');
  }

  async createHousekeepingTask(data: {
    title: string;
    description?: string;
    task_type?: string;
    priority?: string;
    assigned_to?: string;
    location?: string;
  }): Promise<ApiResponse> {
    return this.post('/housekeeping/tasks', data);
  }

  async startHousekeepingTask(taskId: string): Promise<ApiResponse> {
    return this.post(`/housekeeping/tasks/${taskId}/start`);
  }

  async completeHousekeepingTask(taskId: string): Promise<ApiResponse> {
    return this.post(`/housekeeping/tasks/${taskId}/complete`);
  }

  // ───────── Admin Users ─────────

  async getAdminUsers(params?: { type?: string }): Promise<ApiResponse> {
    const qs = params?.type ? `?type=${params.type}` : '';
    return this.get(`/admin/users${qs}`);
  }

  async createAdminUser(data: {
    name?: string;
    full_name?: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    roles?: string[];
  }): Promise<ApiResponse> {
    return this.post('/admin/users', data);
  }

  async updateUserRoles(
    userId: string,
    roles: string[]
  ): Promise<ApiResponse> {
    return this.put(`/admin/users/${userId}/roles`, { roles });
  }

  async updateAdminUser(
    userId: string,
    data: { fullName?: string; phone?: string; isActive?: boolean; emailVerified?: boolean; preferredLanguage?: string }
  ): Promise<ApiResponse> {
    return this.put(`/admin/users/${userId}`, data);
  }

  // ───────── Admin Dashboard & Reports ─────────

  async getDashboard(): Promise<ApiResponse> {
    return this.get('/admin/dashboard');
  }

  async getDashboardRevenue(): Promise<ApiResponse> {
    return this.get('/admin/dashboard/revenue');
  }

  // ───────── Payments ─────────

  async createPaymentIntent(data: {
    amount: number;
    currency?: string;
    referenceType: string;
    referenceId: string;
  }): Promise<ApiResponse> {
    return this.post('/payments/intent', data);
  }

  async confirmPayment(paymentIntentId: string): Promise<ApiResponse> {
    return this.post('/payments/confirm', { paymentIntentId });
  }

  // ───────── Auth (2FA, GDPR) ─────────

  async enable2FA(): Promise<ApiResponse> {
    return this.post('/auth/2fa/setup');
  }

  async verify2FA(code: string): Promise<ApiResponse> {
    return this.post('/auth/2fa/verify', { code }, { auth: false });
  }

  async getProfile(): Promise<ApiResponse> {
    return this.get('/auth/me');
  }

  async deleteAccount(): Promise<ApiResponse> {
    return this.delete('/auth/me');
  }

  async requestGDPRData(): Promise<ApiResponse> {
    return this.get('/gdpr/export');
  }

  async requestGDPRDeletion(): Promise<ApiResponse> {
    return this.post('/gdpr/delete-request');
  }

  // ───────── Health ─────────

  async health(): Promise<ApiResponse> {
    return this.get('/health', { auth: false });
  }
}

/**
 * Convenience: create a client and log in.
 */
export async function createAuthenticatedClient(
  email: string,
  password: string
): Promise<Phase2Client> {
  const client = new Phase2Client();
  const res = await client.login(email, password);
  if (!res.success) {
    throw new Error(`Login failed for ${email}: ${res.error} (status ${res.status})`);
  }
  return client;
}
