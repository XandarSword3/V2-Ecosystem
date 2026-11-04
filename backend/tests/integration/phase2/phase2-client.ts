/**
 * Phase 2 Verification Program â€” Extended API Client
 *
 * Engine-refit aligned (ARCHITECTURE_LAW.md):
 * - Commerce records are `transactions` rows (never menu_service_orders / capacity_access_tickets / â€¦).
 * - Customer module routes: `/{moduleSlug}/orders|bookings|tickets|sessions`.
 * - Staff module routes: `/staff/modules/{slug}/â€¦` (entry, exit, capacity, validate-ticket).
 */

import { TEST_CONFIG } from '../config';
import { ModuleSlug, trackTransaction } from '../engine-refit-helpers';
import { generate as generateOtp } from 'otplib';

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
   * Tenant/property context sent with every request (X-Tenant-ID /
   * X-Property-Id). Admin settings and module writes are stamped with the
   * property â€” without these headers site_settings writes fail on the
   * property_id NOT NULL constraint. Static like csrfToken: configured once
   * by the suite bootstrap, shared by every client instance.
   */
  private static defaultHeaders: Record<string, string> = {};

  /**
   * Static CSRF token shared across all Phase2Client instances.
   * The API uses Double Submit Cookie pattern â€” we send the same
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

  static setDefaultHeaders(headers: Record<string, string>): void {
    Phase2Client.defaultHeaders = { ...headers };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Core HTTP â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      ...Phase2Client.defaultHeaders,
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async login(email: string, password: string): Promise<ApiResponse> {
    const res = await this.post('/auth/login', { email, password }, { auth: false });
    if (res.success && res.data) {
      this.token = res.data.accessToken || res.data.tokens?.accessToken || null;
      this.userId = res.data.user?.id || res.data.id || null;
    }
    return res;
  }

  /**
   * Admin login implementing the real mandatory-2FA operator journey (Q103):
   *
   * 1. POST /auth/login â†’ 403 TWO_FACTOR_SETUP_REQUIRED with a short-lived
   *    twoFactorSetupToken (privileged scopes without 2FA get no session).
   * 2. POST /auth/2fa/setup (Bearer setupToken) â†’ one-time plain `secret`.
   * 3. POST /auth/2fa/enable (Bearer setupToken + TOTP code) â†’ the API
   *    completes login on the spot and returns real access tokens.
   *
   * The harness re-enrolls on every run (it clears two_factor_* rows for the
   * phase2 admin user), so this path is deterministic. If the account already
   * has 2FA enabled the login answers `requiresTwoFactor` instead â€” we surface
   * a clear error rather than guessing codes.
   */
  async loginAsAdmin(email: string, password: string): Promise<ApiResponse> {
    const res = await this.post('/auth/login', { email, password }, { auth: false });

    // Path A: plain login succeeded (non-privileged scope or 2FA satisfied)
    if (res.success && res.data) {
      this.token = res.data.accessToken || res.data.tokens?.accessToken || null;
      this.userId = res.data.user?.id || res.data.id || null;
      return res;
    }

    const code2fa = res.raw?.code;
    const setupPayload = res.raw?.data || {};

    // Path B: mandatory 2FA enrollment required (privileged scope, 2FA off)
    if (res.status === 403 && code2fa === 'TWO_FACTOR_SETUP_REQUIRED') {
      const setupToken = setupPayload.twoFactorSetupToken;
      const enrollUserId = setupPayload.userId;
      if (!setupToken || !enrollUserId) {
        return { ...res, error: 'TWO_FACTOR_SETUP_REQUIRED without setup token' };
      }

      // /2fa/setup and /2fa/enable are guarded by
      // authenticateForTwoFactorEnrollment, which accepts only the short-lived
      // setup token â€” use it as the bearer for both calls.
      this.setToken(setupToken);
      const setupRes = await this.post('/auth/2fa/setup', {});
      const secret = setupRes.data?.secret;
      if (!setupRes.success || !secret) {
        this.setToken(null);
        return { ...setupRes, error: setupRes.error || '2FA setup returned no secret' };
      }

      const totpCode = await generateOtp({ secret, digits: 6, period: 30, algorithm: 'sha1' } as any);
      const enableRes = await this.post('/auth/2fa/enable', { code: totpCode });
      if (!enableRes.success) {
        this.setToken(null);
        return { ...enableRes, error: enableRes.error || '2FA enable failed' };
      }

      // The enable response completes the login: real access token inside.
      this.token = enableRes.data?.accessToken || enableRes.data?.tokens?.accessToken || null;
      this.userId = enableRes.data?.user?.id || enrollUserId;
      return enableRes;
    }

    // Path C: 2FA already enrolled â€” needs a code we don't have
    if (res.raw?.data?.requiresTwoFactor || setupPayload.requiresTwoFactor) {
      return {
        ...res,
        error: 'Account already has 2FA enabled; harness must clear two_factor_* rows before login',
      };
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
        // Registration succeeded but no token â€” login to get one
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Admin Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getSettings(): Promise<ApiResponse> {
    return this.get('/admin/settings');
  }

  async updateSettings(key: string, value: any): Promise<ApiResponse> {
    return this.put('/admin/settings', { key, value });
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Modules â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getModules(): Promise<ApiResponse> {
    return this.get('/admin/modules');
  }

  async createModule(data: {
    name: string;
    slug: string;
    description?: string;
    /** Canonical engine type (ARCHITECTURE_LAW.md) â€” the API schema rejects legacy template names. */
    engine_type: string;
    is_active?: boolean;
    show_in_main?: boolean;
    settings?: any;
  }): Promise<ApiResponse> {
    return this.post('/admin/modules', data);
  }

  async updateModule(id: string, data: any): Promise<ApiResponse> {
    return this.put(`/admin/modules/${id}`, data);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ MenuService â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getMenu(moduleId?: string): Promise<ApiResponse> {
    const qs = moduleId ? `?moduleId=${moduleId}` : '';
    // Resolve the slug from the module id — getMenu is also used for
    // non-restaurant modules (e.g. the kiosk module's categories).
    const slug = await this.resolveModuleSlug(moduleId);
    const itemsRes = await this.get(`/${slug}/items${qs}`);
    if (itemsRes.success) return itemsRes;
    return this.get(`/${slug}/menu${qs}`);
  }

  /**
   * Module-scoped routes mount by slug, but callers pass a module_id. Resolve
   * the slug via /admin/modules (cached per client instance) so the request
   * lands on the right module's route.
   */
  private moduleSlugCache: Map<string, string> | null = null;

  private async resolveModuleSlug(moduleId?: string): Promise<string> {
    if (!moduleId) return ModuleSlug.RESTAURANT;
    if (!this.moduleSlugCache) {
      const res = await this.getModules();
      const mods = Array.isArray(res.data) ? res.data : res.data?.modules || [];
      this.moduleSlugCache = new Map(mods.map((m: any) => [m.id, m.slug]));
    }
    return this.moduleSlugCache.get(moduleId) ?? ModuleSlug.RESTAURANT;
  }

  async createCategory(data: {
    name: string;
    module_id: string;
    display_order?: number;
    sort_order?: number;
    description?: string;
  }): Promise<ApiResponse> {
    // Module-scoped catalog route (the old global /admin/import/menu route
    // no longer exists). The mounted module comes from the slug in the URL.
    const slug = await this.resolveModuleSlug(data.module_id);
    // Idempotent for repeated suite runs: catalog_categories has a unique
    // (name, module_id) constraint, and the route's error body doesn't carry
    // the duplicate detail — so resolve-then-create instead.
    const list = await this.get(`/${slug}/categories`);
    const cats = Array.isArray(list.data) ? list.data : list.data?.categories || [];
    const existing = cats.find((c: any) => c.name === data.name);
    if (existing) {
      return { success: true, status: 200, data: { id: existing.id, category: existing } };
    }
    const res = await this.post(`/${slug}/admin/categories`, {
      name: data.name,
      description: data.description,
    });
    if (res.success) {
      const created = res.data as any;
      return { ...res, data: { id: created?.id, category: created } };
    }
    return res;
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
    const slug = await this.resolveModuleSlug(data.module_id);
    const res = await this.post(`/${slug}/admin/items`, {
      name: data.name,
      category_id: data.category_id,
      price: data.price,
      description: data.description,
      is_available: data.is_available,
      is_featured: data.is_featured,
      is_vegetarian: data.is_vegetarian,
      is_vegan: data.is_vegan,
      is_gluten_free: data.is_gluten_free,
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
      applicableEntityTypes: ['catalog_item'],
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
        entityType: 'catalog_item',
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

  /**
   * Create a service location (Engine A Refit Phase 3 â€” replaces the dead
   * /tables stub). Legacy table fields map onto service locations:
   * table_number â†’ name; capacity/section have no storage anymore.
   */
  async createTable(data: {
    table_number: string;
    capacity?: number;
    section?: string;
    module_id?: string;
  }): Promise<ApiResponse> {
    const slug = await this.resolveModuleSlug(data.module_id);
    return this.post(`/${slug}/admin/service-locations`, {
      name: data.table_number,
    });
  }

  async getTables(moduleId?: string): Promise<ApiResponse> {
    const slug = await this.resolveModuleSlug(moduleId);
    return this.get(`/${slug}/service-locations`);
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
      catalog_item_id: item.menuItemId,
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ AccommodationUnits â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getAccommodationUnits(): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.ACCOMMODATION_UNITS}/availability`);
  }

  async getChalet(id: string): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings/${id}`);
  }

  async createAccommodationUnit(data: {
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
    const res = await this.post(`/${ModuleSlug.ACCOMMODATION_UNITS}/import/commit`, {
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
      return this.post(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings`, data);
    }
    return res;
  }

  async createPriceRule(data: {
    unit_id?: string | null;
    name: string;
    start_date: string;
    end_date: string;
    price_multiplier?: number;
    price?: number;
    priority?: number;
    is_active?: boolean;
  }): Promise<ApiResponse> {
    return this.post('/accommodation-units/admin/price-rules', data);
  }

  async createAddOn(data: {
    name: string;
    description?: string;
    price: number;
    price_type?: string;
    is_active?: boolean;
  }): Promise<ApiResponse> {
    return this.post('/accommodation-units/admin/add-ons', data);
  }

  async getAddOns(moduleId?: string): Promise<ApiResponse> {
    const qs = moduleId ? `?moduleId=${moduleId}` : '';
    return this.get(`/${ModuleSlug.ACCOMMODATION_UNITS}/add-ons${qs}`);
  }

  async getAccommodationAvailability(
    unitId: string,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse> {
    return this.get(
      `/${ModuleSlug.ACCOMMODATION_UNITS}/availability?start=${startDate}&end=${endDate}`,
    );
  }

  async createBooking(data: {
    unitId: string;
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
    const res = await this.post(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings`, {
      unit_id: data.unitId,
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
    return this.get(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings/${id}`);
  }

  async checkInBooking(bookingId: string): Promise<ApiResponse> {
    return this.patch(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings/${bookingId}/status`, { status: 'active' });
  }

  async checkOutBooking(bookingId: string): Promise<ApiResponse> {
    return this.patch(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings/${bookingId}/status`, { status: 'used' });
  }

  async cancelBooking(bookingId: string): Promise<ApiResponse> {
    return this.patch(`/${ModuleSlug.ACCOMMODATION_UNITS}/bookings/${bookingId}/status`, { status: 'cancelled' });
  }

  async getAccommodationSettings(): Promise<ApiResponse> {
    return this.get('/accommodation-units/admin/settings');
  }

  async updateAccommodationSettings(data: any): Promise<ApiResponse> {
    return this.put('/accommodation-units/admin/settings', data);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Pool â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getCapacityWindows(moduleId?: string): Promise<ApiResponse> {
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
    // capacity_windows.starts_at/ends_at are timestamptz — a bare 'HH:mm'
    // fails the cast, so normalize time-only values onto today's date.
    const toTimestamp = (t: string): string =>
      /^\d{1,2}:\d{2}$/.test(t) ? `${new Date().toISOString().slice(0, 10)}T${t}:00` : t;
    return this.post(`/${ModuleSlug.POOL}/import/commit`, {
      moduleId: data.module_id,
      items: [
        {
          name: data.name,
          startTime: toTimestamp(data.start_time),
          endTime: toTimestamp(data.end_time),
          capacity: data.max_capacity ?? data.capacity ?? 50,
          adultPrice: data.adult_price ?? data.price ?? 15,
          childPrice: data.child_price ?? 8,
        },
      ],
    });
  }

  async purchaseCapacityTicket(data: {
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

  async getCapacityTicket(id: string): Promise<ApiResponse> {
    return this.get(`/${ModuleSlug.POOL}/tickets/${id}`);
  }

  async validateCapacityTicket(transactionId: string): Promise<ApiResponse> {
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Loyalty â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Coupons â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Gift Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Housekeeping â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Admin Users â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getAdminUsers(params?: { type?: string }): Promise<ApiResponse> {
    const qs = params?.type ? `?type=${params.type}` : '';
    return this.get(`/admin/users${qs}`);
  }

  async createAdminUser(data: {
    name?: string;
    fullName?: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    roles?: string[];
    scope?: string;
  }): Promise<ApiResponse> {
    // API schema (createUserSchemaWithScope) expects `fullName` â€” normalize
    // the legacy `name`/`full_name` aliases callers may still pass.
    const payload = {
      ...data,
      fullName: data.fullName || (data as any).full_name || data.name,
    };
    delete (payload as any).name;
    delete (payload as any).full_name;
    return this.post('/admin/users', payload);
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Admin Dashboard & Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getDashboard(): Promise<ApiResponse> {
    // /admin/dashboard was deleted by design (admin.routes.ts): the frontend
    // redirects to /admin/modules and revenue data lives under /admin/reports.
    return this.get('/admin/reports/overview');
  }

  async getDashboardRevenue(): Promise<ApiResponse> {
    return this.get('/admin/reports/occupancy');
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Auth (2FA, GDPR) â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
