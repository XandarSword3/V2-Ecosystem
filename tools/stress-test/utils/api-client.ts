import { CONFIG } from '../config';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  tokens?: { accessToken?: string; refreshToken?: string };
  user?: { id: string; roles: string[] };
}

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private csrfToken: string | null = null;
  private cookies: Map<string, string> = new Map();
  public userId: string | null = null;
  public userRoles: string[] = [];

  constructor(baseUrl = CONFIG.API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  // Parse Set-Cookie headers and store cookies
  private parseCookies(setCookieHeaders: string | string[] | null): void {
    if (!setCookieHeaders) return;

    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const header of headers) {
      const parts = header.split(';')[0]; // Get name=value part only
      const [name, ...valueParts] = parts.split('=');
      if (name && valueParts.length > 0) {
        this.cookies.set(name.trim(), valueParts.join('=').trim());
      }
    }
  }

  // Get cookies string for request header
  private getCookieString(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  // Fetch CSRF token from the server
  async fetchCsrfToken(): Promise<boolean> {
    try {
      // Use the non-versioned endpoint for CSRF token
      const baseWithoutV1 = this.baseUrl.replace('/api/v1', '/api');
      const headers: Record<string, string> = {};

      const cookieStr = this.getCookieString();
      if (cookieStr) {
        headers['Cookie'] = cookieStr;
      }

      const response = await fetch(`${baseWithoutV1}/csrf-token`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        // Parse and store cookies from response
        const setCookie = response.headers.get('set-cookie');
        this.parseCookies(setCookie);

        const data = await response.json() as { csrfToken?: string };
        this.csrfToken = data.csrfToken || null;

        // Also store the token in cookies if returned in body
        if (this.csrfToken) {
          this.cookies.set('csrf-token', this.csrfToken);
        }

        return true;
      }
      return false;
    } catch (error) {
      // CSRF token fetch failed - will proceed without it
      return false;
    }
  }

  public async request<T>(
    endpoint: string,
    method: string,
    body?: any,
    requiresAuth = true,
    isReplay = false, // Prevent infinite recursion on replays
    options: { timeout?: number; signal?: AbortSignal } = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Include CSRF token for mutating requests
    if (this.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    // Include cookies
    const cookieStr = this.getCookieString();
    if (cookieStr) {
      headers['Cookie'] = cookieStr;
    }

    // --- CHAOS INJECTION ---
    if (CONFIG.CHAOS_CONFIG.ENABLED && !isReplay) { // Don't apply chaos to the replay itself to avoid infinite loops

      // 1. Artificial Latency
      if (Math.random() < CONFIG.CHAOS_CONFIG.LATENCY_CHANCE) {
        const delay = Math.floor(Math.random() * (CONFIG.CHAOS_CONFIG.LATENCY_MS.max - CONFIG.CHAOS_CONFIG.LATENCY_MS.min + 1)) + CONFIG.CHAOS_CONFIG.LATENCY_MS.min;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 2. Network Drop/Error
      if (Math.random() < CONFIG.CHAOS_CONFIG.ERROR_CHANCE) {
        return { success: false, error: 'CHAOS_NETWORK_DROP: Connection reset by peer' };
      }

      // 3. Partial Service Outages (Simulated 503)
      if (CONFIG.CHAOS_CONFIG.OUTAGE_PATTERNS) {
        for (const [path, prob] of Object.entries(CONFIG.CHAOS_CONFIG.OUTAGE_PATTERNS)) {
          if (endpoint.startsWith(path) && Math.random() < prob) {
            return { success: false, error: 'CHAOS_SERVICE_OUTAGE: 503 Service Unavailable' };
          }
        }
      }

      // 4. Request Replay (Idempotency Test)
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && Math.random() < CONFIG.CHAOS_CONFIG.REPLAY_CHANCE) {
        // Fire and forget the duplicate request
        this.request(endpoint, method, body, requiresAuth, true, options).catch(() => { });
      }
    }
    // -----------------------

    try {
      if (CONFIG.VERBOSE_LOGGING) {
        console.log(`[ApiClient] Requesting: ${method} ${this.baseUrl}${endpoint}`);
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: options.signal
      };

      // Handle timeout if provided
      let timeoutId;
      if (options.timeout) {
        const controller = new AbortController();
        if (options.signal) {
          // If explicit signal provided, we need to respect it too... 
          // but combining signals is tricky without Node 18+ AbortSignal.any()
          // For now, simpler implementation: timeout creates its own signal if none provided
          // OR we just use fetch's signal.
          // Best to just use the one provided or create one.
        } else {
          fetchOptions.signal = controller.signal;
        }
        timeoutId = setTimeout(() => controller.abort(), options.timeout);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

      if (timeoutId) clearTimeout(timeoutId);

      // Parse and store cookies from response
      const setCookie = response.headers.get('set-cookie');
      this.parseCookies(setCookie);

      const data: any = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || `HTTP ${response.status}` };
      }

      return { success: true, data: data.data || data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============ AUTH ============
  async register(email: string, password: string, fullName: string, phone?: string): Promise<boolean> {
    // Fetch CSRF token before registration
    await this.fetchCsrfToken();

    const result = await this.request<AuthResponse>('/auth/register', 'POST', {
      email,
      password,
      fullName,
      phone,
    }, false);

    if (result.success && result.data) {
      // If registration somehow returned tokens (for future compatibility)
      this.accessToken = result.data.accessToken || result.data.tokens?.accessToken || null;
      this.refreshToken = result.data.refreshToken || result.data.tokens?.refreshToken || null;
      this.userId = result.data.user?.id || null;
      this.userRoles = result.data.user?.roles || [];

      // Since our backend doesn't return tokens on register, we MUST login
      if (!this.accessToken) {
        await this.login(email, password);
      } else {
        // Fetch new CSRF token if we already have tokens
        await this.fetchCsrfToken();
      }
    }
    return result.success;
  }

  async login(email: string, password: string): Promise<boolean> {
    // Fetch CSRF token before login
    await this.fetchCsrfToken();

    const res = await this.request<AuthResponse>('/auth/login', 'POST', { email, password }, false);
    if (!res.success) {
      console.error('Login failed response:', JSON.stringify(res, null, 2));
    }
    if (res.success && res.data) {
      this.accessToken = res.data.accessToken || res.data.tokens?.accessToken || null;
      this.refreshToken = res.data.refreshToken || res.data.tokens?.refreshToken || null;
      this.userId = res.data.user?.id || null;
      this.userRoles = res.data.user?.roles || [];

      // Fetch new CSRF token after successful login (might change with session)
      await this.fetchCsrfToken();
    }
    return res.success;
  }

  async loginWithRetry(email: string, password: string, retries = 5): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.fetchCsrfToken();
        const success = await this.login(email, password);
        if (success) return true;

        // If login returned false (api error), log it and retry
        console.warn(`[ApiClient] Login attempt ${i + 1}/${retries} failed for ${email}`);
      } catch (e) {
        console.error(`[ApiClient] Login attempt ${i + 1}/${retries} exception:`, e);
      }

      if (i < retries - 1) {
        const backoff = 1000 * Math.pow(2, i); // 1s, 2s, 4s, 8s, 16s
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    return false;
  }

  async registerWithRetry(email: string, password: string, fullName: string, phone?: string, retries = 5): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.fetchCsrfToken();
        const success = await this.register(email, password, fullName, phone);
        if (success) return true;
        console.warn(`[ApiClient] Register attempt ${i + 1}/${retries} failed for ${email}`);
      } catch (e) {
        console.error(`[ApiClient] Register attempt ${i + 1}/${retries} exception:`, e);
      }

      if (i < retries - 1) {
        const backoff = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    return false;
  }

  async getProfile(): Promise<any> {
    return this.request('/auth/me', 'GET');
  }

  // ============ RESTAURANT ============
  async getRestaurantMenu(): Promise<ApiResponse> {
    return this.request('/restaurant/menu', 'GET', null, false);
  }

  async getRestaurantCategories(): Promise<ApiResponse> {
    return this.request('/restaurant/categories', 'GET', null, false);
  }

  async getRestaurantItem(id: string): Promise<ApiResponse> {
    return this.request(`/restaurant/items/${id}`, 'GET', null, false);
  }

  async createRestaurantOrder(order: {
    customerName: string;
    customerPhone: string;
    orderType: 'dine_in' | 'takeaway' | 'delivery';
    items: { menuItemId: string; quantity: number; specialInstructions?: string }[];
    tableNumber?: string;
    notes?: string;
  }): Promise<ApiResponse> {
    return this.request('/restaurant/orders', 'POST', order, false);
  }

  async getRestaurantOrder(id: string): Promise<ApiResponse> {
    return this.request(`/restaurant/orders/${id}`, 'GET', null, false);
  }

  async getRestaurantOrderStatus(id: string): Promise<ApiResponse> {
    return this.request(`/restaurant/orders/${id}/status`, 'GET', null, false);
  }

  async getMyRestaurantOrders(): Promise<ApiResponse> {
    return this.request('/restaurant/orders/my', 'GET');
  }

  // ============ SNACK BAR ============
  async getSnackCategories(): Promise<ApiResponse> {
    return this.request('/snack/categories', 'GET', null, false);
  }

  async getSnackItems(): Promise<ApiResponse> {
    return this.request('/snack/items', 'GET', null, false);
  }

  async getSnackOrderStatus(id: string): Promise<ApiResponse> {
    return this.request(`/snack/orders/${id}/status`, 'GET', null, false);
  }

  async createSnackOrder(order: {
    customerName: string;
    customerPhone: string;
    items: { itemId: string; quantity: number }[];
    paymentMethod: 'cash' | 'card';
    notes?: string;
  }): Promise<ApiResponse> {
    return this.request('/snack/orders', 'POST', order, false);
  }

  async getMySnackOrders(): Promise<ApiResponse> {
    return this.request('/snack/orders/my', 'GET');
  }

  // ============ CHALETS ============
  async getChalets(): Promise<ApiResponse> {
    return this.request('/chalets', 'GET', null, false);
  }

  async getChalet(id: string): Promise<ApiResponse> {
    return this.request(`/chalets/${id}`, 'GET', null, false);
  }

  async checkChaletAvailability(id: string, checkIn: string, checkOut: string): Promise<ApiResponse> {
    return this.request(`/chalets/${id}/availability?checkIn=${checkIn}&checkOut=${checkOut}`, 'GET', null, false);
  }

  async getChaletAddons(): Promise<ApiResponse> {
    return this.request('/chalets/add-ons', 'GET', null, false);
  }

  async createChaletBooking(booking: {
    chaletId: string;
    checkInDate: string;
    checkOutDate: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    numberOfGuests: number;
    paymentMethod: 'cash' | 'card' | 'online';
    addOns?: string[];
    notes?: string;
  }): Promise<ApiResponse> {
    return this.request('/chalets/bookings', 'POST', booking, false);
  }

  async getMyChaletBookings(): Promise<ApiResponse> {
    return this.request('/chalets/my-bookings', 'GET');
  }

  async cancelBooking(id: string): Promise<ApiResponse> {
    return this.request(`/chalets/bookings/${id}/cancel`, 'POST');
  }

  // ============ POOL ============
  async getPoolSessions(): Promise<ApiResponse> {
    return this.request('/pool/sessions', 'GET', null, false);
  }

  async getPoolSession(id: string): Promise<ApiResponse> {
    return this.request(`/pool/sessions/${id}`, 'GET', null, false);
  }

  async buyPoolTicket(ticket: {
    sessionId: string;
    ticketDate: string;
    numberOfGuests: number;
    numberOfAdults?: number;
    numberOfChildren?: number;
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    paymentMethod: 'cash' | 'card' | 'online';
  }): Promise<ApiResponse> {
    return this.request('/pool/tickets', 'POST', ticket, false);
  }

  async getMyPoolTickets(): Promise<ApiResponse> {
    return this.request('/pool/tickets/my', 'GET');
  }

  // ============ REVIEWS ============
  async getReviews(): Promise<ApiResponse> {
    return this.request('/reviews', 'GET', null, false);
  }

  async submitReview(review: {
    service_type: string;
    rating: number;
    text: string;
  }): Promise<ApiResponse> {
    return this.request('/reviews', 'POST', review);
  }

  // ============ SUPPORT ============
  async submitContactForm(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<ApiResponse> {
    return this.request('/support/contact', 'POST', data, false);
  }

  // ============ STAFF ENDPOINTS ============
  async getStaffOrders(module: 'restaurant' | 'snack'): Promise<ApiResponse> {
    return this.request(`/${module}/staff/orders`, 'GET');
  }

  async getLiveOrders(module: 'restaurant' | 'snack'): Promise<ApiResponse> {
    return this.request(`/${module}/staff/orders/live`, 'GET');
  }

  async updateOrderStatus(module: 'restaurant' | 'snack', orderId: string, status: string): Promise<ApiResponse> {
    return this.request(`/${module}/staff/orders/${orderId}/status`, 'PATCH', { status });
  }

  async updateOrderStatusWithRetry(module: 'restaurant' | 'snack', orderId: string, status: string, retries = 5): Promise<ApiResponse> {
    for (let i = 0; i < retries; i++) {
      const res = await this.updateOrderStatus(module, orderId, status);
      if (res.success) return res;
      if (i < retries - 1) {
        const backoff = 500 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    return { success: false, error: 'Failed after retries' };
  }

  async getTodayBookings(): Promise<ApiResponse> {
    return this.request('/chalets/staff/bookings/today', 'GET');
  }

  async checkinGuest(bookingId: string): Promise<ApiResponse> {
    return this.request(`/chalets/staff/bookings/${bookingId}/check-in`, 'PATCH');
  }

  async checkoutGuest(bookingId: string): Promise<ApiResponse> {
    return this.request(`/chalets/staff/bookings/${bookingId}/check-out`, 'PATCH');
  }

  async validatePoolTicket(ticketCode: string): Promise<ApiResponse> {
    return this.request('/pool/staff/validate', 'POST', { code: ticketCode });
  }

  async recordPoolEntry(ticketId: string): Promise<ApiResponse> {
    return this.request(`/pool/tickets/${ticketId}/entry`, 'POST');
  }

  async recordPoolExit(ticketId: string): Promise<ApiResponse> {
    return this.request(`/pool/tickets/${ticketId}/exit`, 'POST');
  }

  async getPoolCapacity(): Promise<ApiResponse> {
    return this.request('/pool/staff/capacity', 'GET');
  }

  async getTodayTickets(): Promise<ApiResponse> {
    return this.request('/pool/staff/tickets/today', 'GET');
  }

  async getTables(): Promise<ApiResponse> {
    return this.request('/restaurant/staff/tables', 'GET');
  }

  async recordPayment(data: {
    referenceType: 'restaurant_order' | 'snack_order' | 'chalet_booking' | 'pool_ticket';
    referenceId: string;
    amount: number;
    method: string;
    notes?: string;
  }): Promise<ApiResponse> {
    return this.request('/payments/record-manual', 'POST', data);
  }

  // ============ ADMIN ENDPOINTS ============
  async getDashboard(): Promise<ApiResponse> {
    return this.request('/admin/dashboard', 'GET');
  }

  async getRevenueStats(): Promise<ApiResponse> {
    return this.request('/admin/revenue', 'GET');
  }

  async getUsers(params?: { role?: string; limit?: number }): Promise<ApiResponse> {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return this.request(`/admin/users${query}`, 'GET');
  }

  async createUser(user: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    roles?: string[];
  }): Promise<ApiResponse> {
    return this.request('/admin/users', 'POST', user);
  }

  async updateUser(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/users/${id}`, 'PUT', data);
  }

  async updateUserRoles(id: string, roles: string[]): Promise<ApiResponse> {
    return this.request(`/admin/users/${id}/roles`, 'PUT', { roles });
  }

  // Note: getModules and updateModule moved to Dynamic Modules section below

  async getSettings(): Promise<ApiResponse> {
    return this.request('/admin/settings', 'GET');
  }

  async updateSettings(settings: any): Promise<ApiResponse> {
    return this.request('/admin/settings', 'PUT', settings);
  }

  async getAdminReviews(): Promise<ApiResponse> {
    return this.request('/reviews/admin', 'GET');
  }

  async approveReview(id: string): Promise<ApiResponse> {
    return this.request(`/reviews/${id}/status`, 'PATCH', { status: 'approved' });
  }

  async rejectReview(id: string): Promise<ApiResponse> {
    return this.request(`/admin/reviews/${id}/reject`, 'PUT');
  }

  async getAuditLogs(): Promise<ApiResponse> {
    return this.request('/admin/audit-logs', 'GET');
  }

  async createBackup(): Promise<ApiResponse> {
    return this.request('/admin/backups', 'POST');
  }

  async getBackups(): Promise<ApiResponse> {
    return this.request('/admin/backups', 'GET');
  }

  async deleteBackup(id: string): Promise<ApiResponse> {
    return this.request(`/admin/backups/${id}`, 'DELETE');
  }

  async compareTranslations(lang: string = 'en'): Promise<ApiResponse> {
    return this.request(`/admin/translations/frontend/compare?code=${lang}`, 'GET');
  }

  async getReports(type: string): Promise<ApiResponse> {
    return this.request(`/admin/reports/${type}`, 'GET');
  }

  // Menu Management - CORRECT PATHS: /restaurant/admin/... and /snack/admin/...
  async createMenuCategory(module: 'restaurant' | 'snack', data: any): Promise<ApiResponse> {
    return this.request(`/${module}/admin/categories`, 'POST', data);
  }

  async updateMenuCategory(module: 'restaurant' | 'snack', id: string, data: any): Promise<ApiResponse> {
    return this.request(`/${module}/admin/categories/${id}`, 'PUT', data);
  }

  async createMenuItem(module: 'restaurant' | 'snack', data: any): Promise<ApiResponse> {
    return this.request(`/${module}/admin/items`, 'POST', data);
  }

  async updateMenuItem(module: 'restaurant' | 'snack', id: string, data: any): Promise<ApiResponse> {
    return this.request(`/${module}/admin/items/${id}`, 'PUT', data);
  }

  async toggleItemAvailability(module: 'restaurant' | 'snack', id: string): Promise<ApiResponse> {
    return this.request(`/${module}/admin/items/${id}/availability`, 'PATCH');
  }

  // Chalet Management
  async createChalet(data: any): Promise<ApiResponse> {
    return this.request('/chalets/admin/chalets', 'POST', data);
  }

  async updateChalet(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/chalets/admin/chalets/${id}`, 'PUT', data);
  }

  // Pool Management
  async createPoolSession(data: any): Promise<ApiResponse> {
    return this.request('/pool/admin/sessions', 'POST', data);
  }

  async updatePoolSession(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/pool/admin/sessions/${id}`, 'PUT', data);
  }

  async updatePoolSettings(data: any): Promise<ApiResponse> {
    return this.request('/pool/admin/settings', 'PUT', data);
  }

  // ===== DYNAMIC MODULES =====

  // Public - get all active modules
  async getModules(): Promise<ApiResponse> {
    return this.request('/modules', 'GET');
  }

  // Public - get module by slug
  async getModuleBySlug(slug: string): Promise<ApiResponse> {
    return this.request(`/modules/${slug}`, 'GET');
  }

  // Public - get module menu (for menu_service type)
  async getModuleMenu(slug: string): Promise<ApiResponse> {
    return this.request(`/modules/${slug}/menu`, 'GET');
  }

  // Public - create order for a module
  async createModuleOrder(slug: string, data: any): Promise<ApiResponse> {
    return this.request(`/modules/${slug}/orders`, 'POST', data);
  }

  // Staff - get live orders for a module
  async getModuleLiveOrders(slug: string): Promise<ApiResponse> {
    return this.request(`/staff/modules/${slug}/orders/live`, 'GET');
  }

  // Staff - update module order status
  async updateModuleOrderStatus(slug: string, orderId: string, status: string): Promise<ApiResponse> {
    return this.request(`/staff/modules/${slug}/orders/${orderId}/status`, 'PUT', { status });
  }

  // Restaurant specific wrappers
  async updateRestaurantOrderStatus(orderId: string, status: string): Promise<ApiResponse> {
    return this.updateModuleOrderStatus('restaurant', orderId, status);
  }



  // Admin - get all modules (including inactive)
  async getAdminModules(): Promise<ApiResponse> {
    return this.request('/admin/modules', 'GET');
  }

  // Admin - create module
  async createModule(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    template_type: 'menu_service' | 'multi_day_booking' | 'session_access';
    is_active?: boolean;
    display_order?: number;
    settings?: any;
  }): Promise<ApiResponse> {
    return this.request('/admin/modules', 'POST', data);
  }

  // Admin - update module
  async updateModule(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/modules/${id}`, 'PUT', data);
  }

  // Admin - delete module
  async deleteModule(id: string): Promise<ApiResponse> {
    return this.request(`/admin/modules/${id}`, 'DELETE');
  }

  // Admin - create menu item for a module
  async createModuleMenuItem(moduleId: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/modules/${moduleId}/menu-items`, 'POST', data);
  }

  // Admin - update menu item for a module
  async updateModuleMenuItem(moduleId: string, itemId: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/modules/${moduleId}/menu-items/${itemId}`, 'PUT', data);
  }

  // ============ ENHANCED ADMIN CRUD OPERATIONS ============

  // User Management
  async deleteUser(id: string): Promise<ApiResponse> {
    return this.request(`/admin/users/${id}`, 'DELETE');
  }

  async getUserById(id: string): Promise<ApiResponse> {
    return this.request(`/admin/users/${id}`, 'GET');
  }

  // Restaurant Categories CRUD
  async getRestaurantAdminCategories(): Promise<ApiResponse> {
    return this.request('/restaurant/categories', 'GET');
  }

  async deleteMenuCategory(module: 'restaurant' | 'snack', id: string): Promise<ApiResponse> {
    return this.request(`/${module}/admin/categories/${id}`, 'DELETE');
  }

  // Restaurant Items CRUD
  async getRestaurantAdminItems(): Promise<ApiResponse> {
    return this.request('/restaurant/items', 'GET');
  }

  async deleteMenuItem(module: 'restaurant' | 'snack', id: string): Promise<ApiResponse> {
    return this.request(`/${module}/admin/items/${id}`, 'DELETE');
  }

  async updateRestaurantMenuItem(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/restaurant/admin/items/${id}`, 'PUT', data);
  }

  // Restaurant Tables CRUD
  async getRestaurantTables(): Promise<ApiResponse> {
    return this.request('/restaurant/staff/tables', 'GET');
  }

  async createRestaurantTable(data: any): Promise<ApiResponse> {
    return this.request('/restaurant/admin/tables', 'POST', data);
  }

  async updateRestaurantTable(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/restaurant/staff/tables/${id}`, 'PATCH', data);
  }

  async deleteRestaurantTable(id: string): Promise<ApiResponse> {
    return this.request(`/restaurant/admin/tables/${id}`, 'DELETE');
  }

  // Chalet CRUD
  async getAdminChalets(): Promise<ApiResponse> {
    return this.request('/chalets', 'GET');
  }

  async deleteChalet(id: string): Promise<ApiResponse> {
    return this.request(`/chalets/admin/chalets/${id}`, 'DELETE');
  }

  // Chalet Pricing Rules
  async getChaletPriceRules(): Promise<ApiResponse> {
    return this.request('/chalets/admin/price-rules', 'GET');
  }

  async createChaletPriceRule(data: any): Promise<ApiResponse> {
    return this.request('/chalets/admin/price-rules', 'POST', data);
  }

  async updateChaletPriceRule(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/chalets/admin/price-rules/${id}`, 'PUT', data);
  }

  async deleteChaletPriceRule(id: string): Promise<ApiResponse> {
    return this.request(`/chalets/admin/price-rules/${id}`, 'DELETE');
  }

  // Chalet Add-ons
  async getChaletAddonsAdmin(): Promise<ApiResponse> {
    return this.request('/chalets/add-ons', 'GET');
  }

  async createChaletAddon(data: any): Promise<ApiResponse> {
    return this.request('/chalets/admin/add-ons', 'POST', data);
  }

  async updateChaletAddon(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/chalets/admin/add-ons/${id}`, 'PUT', data);
  }

  async deleteChaletAddon(id: string): Promise<ApiResponse> {
    return this.request(`/chalets/admin/add-ons/${id}`, 'DELETE');
  }

  // Pool Sessions CRUD
  async getPoolAdminSessions(): Promise<ApiResponse> {
    return this.request('/pool/sessions', 'GET');
  }

  async deletePoolSession(id: string): Promise<ApiResponse> {
    return this.request(`/pool/admin/sessions/${id}`, 'DELETE');
  }

  async resetPoolOccupancy(): Promise<ApiResponse> {
    return this.request('/pool/admin/reset-occupancy', 'POST');
  }

  // Roles & Permissions
  async getRoles(): Promise<ApiResponse> {
    return this.request('/admin/roles', 'GET');
  }

  async createRole(data: { name: string; displayName?: string; description?: string; businessUnit?: string }): Promise<ApiResponse> {
    return this.request('/admin/roles', 'POST', data);
  }

  async updateRole(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/roles/${id}`, 'PUT', data);
  }

  async deleteRole(id: string): Promise<ApiResponse> {
    return this.request(`/admin/roles/${id}`, 'DELETE');
  }

  async getPermissions(): Promise<ApiResponse> {
    return this.request('/admin/permissions', 'GET');
  }

  // Booking Status Updates
  async updateBookingStatus(id: string, status: string): Promise<ApiResponse> {
    return this.request(`/chalets/admin/bookings/${id}/status`, 'PATCH', { status });
  }

  async getAdminBookings(): Promise<ApiResponse> {
    return this.request('/chalets/admin/bookings', 'GET');
  }

  // Settings (Homepage, Footer, Appearance)
  async getHomepageSettings(): Promise<ApiResponse> {
    return this.request('/admin/settings/homepage', 'GET');
  }

  async updateHomepageSettings(data: any): Promise<ApiResponse> {
    return this.request('/admin/settings/homepage', 'PUT', data);
  }

  async getFooterSettings(): Promise<ApiResponse> {
    return this.request('/admin/settings/footer', 'GET');
  }

  async updateFooterSettings(data: any): Promise<ApiResponse> {
    return this.request('/admin/settings/footer', 'PUT', data);
  }

  async getAppearanceSettings(): Promise<ApiResponse> {
    return this.request('/admin/settings/appearance', 'GET');
  }

  async updateAppearanceSettings(data: any): Promise<ApiResponse> {
    return this.request('/admin/settings/appearance', 'PUT', data);
  }

  // Notifications
  async getAdminNotifications(): Promise<ApiResponse> {
    return this.request('/admin/notifications', 'GET');
  }

  async sendNotification(data: { title: string; message: string; type: string; target_type: string }): Promise<ApiResponse> {
    return this.request('/admin/notifications', 'POST', data);
  }

  async markNotificationRead(id: string): Promise<ApiResponse> {
    return this.request(`/admin/notifications/${id}/read`, 'PUT');
  }

  // Translation Management
  async getTranslationStats(): Promise<ApiResponse> {
    return this.request('/admin/translations/stats', 'GET');
  }

  async getMissingTranslations(): Promise<ApiResponse> {
    return this.request('/admin/translations/missing', 'GET');
  }

  async updateTranslation(data: { table: string; id: string; field: string; language: string; value: string }): Promise<ApiResponse> {
    return this.request('/admin/translations/update', 'POST', data);
  }

  // Download URL for backup
  async getBackupDownloadUrl(id: string): Promise<ApiResponse> {
    return this.request(`/admin/backups/${id}/download`, 'GET');
  }

  // ============ GIFT CARDS ============
  async getGiftCardTemplates(): Promise<ApiResponse> {
    return this.request('/giftcards/templates', 'GET', undefined, false);
  }

  async purchaseGiftCard(data: { templateId: string; amount: number; recipientName: string; recipientEmail: string; message?: string; paymentMethod: string }): Promise<ApiResponse> {
    return this.request('/giftcards/purchase', 'POST', data);
  }

  async getMyGiftCards(): Promise<ApiResponse> {
    return this.request('/giftcards/my', 'GET');
  }

  async checkGiftCardBalance(code: string): Promise<ApiResponse> {
    return this.request(`/giftcards/check/${code}`, 'GET', undefined, false);
  }

  async getAllGiftCards(): Promise<ApiResponse> {
    return this.request('/giftcards', 'GET');
  }

  async createGiftCardAdmin(data: any): Promise<ApiResponse> {
    return this.request('/giftcards', 'POST', data);
  }

  async disableGiftCard(id: string): Promise<ApiResponse> {
    return this.request(`/giftcards/${id}/disable`, 'PUT');
  }

  async getGiftCardStats(): Promise<ApiResponse> {
    return this.request('/giftcards/stats', 'GET');
  }

  async redeemGiftCard(code: string, amount: number): Promise<ApiResponse> {
    return this.request('/giftcards/redeem', 'POST', { code, amount });
  }

  // ============ LOYALTY ============
  async getMyLoyalty(): Promise<ApiResponse> {
    return this.request('/loyalty/me', 'GET');
  }

  async enrollLoyalty(): Promise<ApiResponse> {
    return this.request('/loyalty/enroll', 'POST');
  }

  async getLoyaltyTiers(): Promise<ApiResponse> {
    return this.request('/loyalty/tiers', 'GET', undefined, false);
  }

  async getMyLoyaltyTransactions(): Promise<ApiResponse> {
    return this.request('/loyalty/me/transactions', 'GET');
  }

  async getAllLoyaltyAccounts(): Promise<ApiResponse> {
    return this.request('/loyalty/accounts', 'GET');
  }

  async getLoyaltyStats(): Promise<ApiResponse> {
    return this.request('/loyalty/stats', 'GET');
  }

  async adjustLoyaltyPoints(data: { userId: string; points: number; reason: string }): Promise<ApiResponse> {
    return this.request('/loyalty/adjust', 'POST', data);
  }

  async earnLoyaltyPoints(data: { userId: string; points: number; description?: string }): Promise<ApiResponse> {
    return this.request('/loyalty/earn', 'POST', data);
  }

  async redeemLoyaltyPoints(data: { userId: string; points: number }): Promise<ApiResponse> {
    return this.request('/loyalty/redeem', 'POST', data);
  }

  async adjustLoyaltyPointsWithRetry(data: { userId: string; points: number; reason: string }, retries = 5): Promise<ApiResponse> {
    for (let i = 0; i < retries; i++) {
      const res = await this.adjustLoyaltyPoints(data);
      if (res.success) return res;

      console.warn(`[ApiClient] adjustLoyaltyPoints attempt ${i + 1}/${retries} failed: ${res.error}`);

      if (i < retries - 1) {
        const backoff = 500 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    return { success: false, error: 'Failed after retries' };
  }

  async updateLoyaltySettings(data: any): Promise<ApiResponse> {
    return this.request('/loyalty/settings', 'PUT', data);
  }

  async createLoyaltyTier(data: any): Promise<ApiResponse> {
    return this.request('/loyalty/tiers', 'POST', data);
  }

  async deleteLoyaltyTier(id: string): Promise<ApiResponse> {
    return this.request(`/loyalty/tiers/${id}`, 'DELETE');
  }

  // ============ COUPONS ============
  async getActiveCoupons(): Promise<ApiResponse> {
    return this.request('/coupons/active', 'GET', undefined, false);
  }

  async validateCoupon(code: string): Promise<ApiResponse> {
    return this.request('/coupons/validate', 'POST', { code });
  }

  async applyCoupon(code: string, orderTotal: number): Promise<ApiResponse> {
    return this.request('/coupons/apply', 'POST', { code, orderTotal });
  }

  async getAllCoupons(): Promise<ApiResponse> {
    return this.request('/coupons', 'GET');
  }


  async createCoupon(data: any): Promise<ApiResponse> {
    return this.request('/coupons', 'POST', data);
  }

  async updateCoupon(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/coupons/${id}`, 'PUT', data);
  }

  async deleteCoupon(id: string): Promise<ApiResponse> {
    return this.request(`/coupons/${id}`, 'DELETE');
  }

  async getCouponStats(): Promise<ApiResponse> {
    return this.request('/coupons/stats', 'GET');
  }

  async generateCouponCode(): Promise<ApiResponse> {
    return this.request('/coupons/generate-code', 'GET');
  }

  // ============ GDPR / PRIVACY ============
  async getPrivacyDashboard(): Promise<ApiResponse> {
    return this.request('/gdpr/dashboard', 'GET');
  }

  async requestDataExport(): Promise<ApiResponse> {
    return this.request('/gdpr/export/request', 'POST');
  }

  async getExportStatus(): Promise<ApiResponse> {
    return this.request('/gdpr/export/status', 'GET');
  }

  async requestAccountDeletion(): Promise<ApiResponse> {
    return this.request('/gdpr/deletion/request', 'POST');
  }

  async getConsents(): Promise<ApiResponse> {
    return this.request('/gdpr/consents', 'GET');
  }

  async updateConsents(data: any): Promise<ApiResponse> {
    return this.request('/gdpr/consents', 'PUT', data);
  }

  async getProcessingLog(): Promise<ApiResponse> {
    return this.request('/gdpr/processing-log', 'GET');
  }

  // ============ INVENTORY ============
  async getInventoryItems(): Promise<ApiResponse> {
    return this.request('/inventory/items', 'GET');
  }

  async createInventoryItem(data: any): Promise<ApiResponse> {
    return this.request('/inventory/items', 'POST', data);
  }

  async updateInventoryItem(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/inventory/items/${id}`, 'PUT', data);
  }

  async deleteInventoryItem(id: string): Promise<ApiResponse> {
    return this.request(`/inventory/items/${id}`, 'DELETE');
  }

  async getInventoryCategories(): Promise<ApiResponse> {
    return this.request('/inventory/categories', 'GET');
  }

  async createInventoryCategory(data: any): Promise<ApiResponse> {
    return this.request('/inventory/categories', 'POST', data);
  }

  async recordInventoryTransaction(data: any): Promise<ApiResponse> {
    return this.request('/inventory/transactions', 'POST', data);
  }

  async getInventoryAlerts(): Promise<ApiResponse> {
    return this.request('/inventory/alerts', 'GET');
  }

  async resolveInventoryAlert(id: string): Promise<ApiResponse> {
    return this.request(`/inventory/alerts/${id}/resolve`, 'POST');
  }

  async getInventoryStats(): Promise<ApiResponse> {
    return this.request('/inventory/stats', 'GET');
  }

  // ============ HOUSEKEEPING ============
  async getHousekeepingTasks(): Promise<ApiResponse> {
    return this.request('/housekeeping/tasks', 'GET');
  }

  async createHousekeepingTask(data: any): Promise<ApiResponse> {
    return this.request('/housekeeping/tasks', 'POST', data);
  }

  async assignHousekeepingTask(taskId: string, staffId: string): Promise<ApiResponse> {
    return this.request(`/housekeeping/tasks/${taskId}/assign`, 'POST', { staffId });
  }

  async getHousekeepingSchedules(): Promise<ApiResponse> {
    return this.request('/housekeeping/schedules', 'GET');
  }

  async createHousekeepingSchedule(data: any): Promise<ApiResponse> {
    return this.request('/housekeeping/schedules', 'POST', data);
  }

  async getAvailableHousekeepingStaff(): Promise<ApiResponse> {
    return this.request('/housekeeping/staff', 'GET');
  }

  async getHousekeepingStats(): Promise<ApiResponse> {
    return this.request('/housekeeping/stats', 'GET');
  }

  // ============ MANAGER (APPROVALS + SHIFTS) ============
  async getPendingApprovals(): Promise<ApiResponse> {
    return this.request('/manager/approvals/pending', 'GET');
  }

  async getAllApprovals(): Promise<ApiResponse> {
    return this.request('/manager/approvals', 'GET');
  }

  async getApprovalStats(): Promise<ApiResponse> {
    return this.request('/manager/approvals/stats', 'GET');
  }

  async reviewApproval(id: string, decision: 'approved' | 'rejected', notes?: string): Promise<ApiResponse> {
    return this.request(`/manager/approvals/${id}/review`, 'PUT', { decision, notes });
  }

  async getShifts(): Promise<ApiResponse> {
    return this.request('/manager/shifts', 'GET');
  }

  async getTodaySchedule(): Promise<ApiResponse> {
    return this.request('/manager/shifts/today', 'GET');
  }

  async createShift(data: any): Promise<ApiResponse> {
    return this.request('/manager/shifts', 'POST', data);
  }

  async clockIn(shiftId: string): Promise<ApiResponse> {
    return this.request(`/manager/shifts/${shiftId}/clock-in`, 'POST');
  }

  async clockOut(shiftId: string): Promise<ApiResponse> {
    return this.request(`/manager/shifts/${shiftId}/clock-out`, 'POST');
  }

  // ============ CHANNELS ============
  async getChannelConnections(propertyId: string): Promise<ApiResponse> {
    return this.request(`/channels/properties/${propertyId}/connections`, 'GET');
  }

  async createChannelConnection(propertyId: string, data: any): Promise<ApiResponse> {
    return this.request(`/channels/properties/${propertyId}/connections`, 'POST', data);
  }

  async syncChannelAvailability(connectionId: string): Promise<ApiResponse> {
    return this.request(`/channels/connections/${connectionId}/sync/availability`, 'POST');
  }

  async syncChannelRates(connectionId: string): Promise<ApiResponse> {
    return this.request(`/channels/connections/${connectionId}/sync/rates`, 'POST');
  }

  async getChannelSyncLog(connectionId: string): Promise<ApiResponse> {
    return this.request(`/channels/connections/${connectionId}/sync-log`, 'GET');
  }

  // ============ CUSTOMIZATIONS ============
  async getCustomizationGroups(): Promise<ApiResponse> {
    return this.request('/customizations/groups', 'GET');
  }

  async createCustomizationGroup(data: any): Promise<ApiResponse> {
    return this.request('/customizations/groups', 'POST', data);
  }

  async createCustomizationOption(data: any): Promise<ApiResponse> {
    return this.request('/customizations/options', 'POST', data);
  }

  // ============ TERMINOLOGY ============
  async getTerminology(): Promise<ApiResponse> {
    return this.request('/terminology', 'GET', undefined, false);
  }

  async updateTerminology(data: any): Promise<ApiResponse> {
    return this.request('/terminology', 'POST', data);
  }

  // ============ KIOSK ============
  async getKioskDevices(): Promise<ApiResponse> {
    return this.request('/kiosk/devices', 'GET');
  }

  async getKioskSessions(): Promise<ApiResponse> {
    return this.request('/kiosk/sessions', 'GET');
  }
}
