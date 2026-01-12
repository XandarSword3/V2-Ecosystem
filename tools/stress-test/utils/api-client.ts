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
  public userId: string | null = null;
  public userRoles: string[] = [];

  constructor(baseUrl = CONFIG.API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  private async request<T>(
    endpoint: string,
    method: string,
    body?: any,
    requiresAuth = true
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

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
    const result = await this.request<AuthResponse>('/auth/register', 'POST', {
      email,
      password,
      full_name: fullName,
      phone,
    }, false);
    
    if (result.success && result.data) {
      this.accessToken = result.data.accessToken || result.data.tokens?.accessToken || null;
      this.refreshToken = result.data.refreshToken || result.data.tokens?.refreshToken || null;
      this.userId = result.data.user?.id || null;
      this.userRoles = result.data.user?.roles || [];
    }
    return result.success;
  }

  async login(email: string, password: string): Promise<boolean> {
    const result = await this.request<AuthResponse>('/auth/login', 'POST', { email, password }, false);
    
    if (result.success && result.data) {
      this.accessToken = result.data.accessToken || result.data.tokens?.accessToken || null;
      this.refreshToken = result.data.refreshToken || result.data.tokens?.refreshToken || null;
      this.userId = result.data.user?.id || null;
      this.userRoles = result.data.user?.roles || [];
    }
    return result.success;
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
    return this.request('/chalets/addons', 'GET', null, false);
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
    return this.request('/chalets/bookings/my', 'GET');
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
    return this.request('/admin/reviews', 'GET');
  }

  async approveReview(id: string): Promise<ApiResponse> {
    return this.request(`/admin/reviews/${id}/approve`, 'PUT');
  }

  async rejectReview(id: string): Promise<ApiResponse> {
    return this.request(`/admin/reviews/${id}/reject`, 'PUT');
  }

  async getAuditLogs(): Promise<ApiResponse> {
    return this.request('/admin/audit', 'GET');
  }

  async createBackup(): Promise<ApiResponse> {
    return this.request('/admin/backups', 'POST');
  }

  async getReports(type: string): Promise<ApiResponse> {
    return this.request(`/admin/reports/${type}`, 'GET');
  }

  // Menu Management
  async createMenuCategory(module: 'restaurant' | 'snack', data: any): Promise<ApiResponse> {
    return this.request(`/admin/${module}/categories`, 'POST', data);
  }

  async updateMenuCategory(module: 'restaurant' | 'snack', id: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/${module}/categories/${id}`, 'PUT', data);
  }

  async createMenuItem(module: 'restaurant' | 'snack', data: any): Promise<ApiResponse> {
    return this.request(`/admin/${module}/items`, 'POST', data);
  }

  async updateMenuItem(module: 'restaurant' | 'snack', id: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/${module}/items/${id}`, 'PUT', data);
  }

  async toggleItemAvailability(module: 'restaurant' | 'snack', id: string): Promise<ApiResponse> {
    return this.request(`/admin/${module}/items/${id}/availability`, 'PATCH');
  }

  // Chalet Management
  async createChalet(data: any): Promise<ApiResponse> {
    return this.request('/admin/chalets', 'POST', data);
  }

  async updateChalet(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/chalets/${id}`, 'PUT', data);
  }

  // Pool Management
  async createPoolSession(data: any): Promise<ApiResponse> {
    return this.request('/admin/pool/sessions', 'POST', data);
  }

  async updatePoolSession(id: string, data: any): Promise<ApiResponse> {
    return this.request(`/admin/pool/sessions/${id}`, 'PUT', data);
  }

  async updatePoolSettings(data: any): Promise<ApiResponse> {
    return this.request('/admin/pool/settings', 'PUT', data);
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
}
