/**
 * Admin Module Type Definitions
 * 
 * Provides proper type definitions to replace 'any' types throughout
 * the admin controllers and services.
 */

// ============================================
// User Types
// ============================================

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  profile_image_url?: string | null;
  preferred_language?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  last_login_at?: string | null;
  deleted_at?: string | null;
}

export interface RoleRow {
  id: string;
  name: string;
  slug?: string;
  display_name?: string;
  description?: string | null;
}

export interface PermissionRow {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  resource?: string;
  action?: string;
  module_slug?: string | null;
}

export interface UserRoleJoin {
  role_id?: string;
  user_id?: string;
  roles?: RoleRow | { name?: string; id?: string } | null;
}

export interface RolePermissionJoin {
  role_id?: string;
  permission_id?: string;
  permissions?: PermissionRow | { id?: string; slug?: string; name?: string; resource?: string; action?: string } | null;
}

export interface UserPermissionJoin {
  permission_id?: string;
  is_granted?: boolean;
  permissions?: PermissionRow | { id?: string; slug?: string; name?: string; resource?: string; action?: string } | null;
}

export interface UserRoleWithPermissions {
  role_id: string;
  roles?: RoleRow & {
    role_permissions?: RolePermissionJoin[];
  } | null;
}

export interface UserWithRolesAndPermissions extends UserRow {
  user_roles?: UserRoleWithPermissions[];
  user_permissions?: UserPermissionJoin[];
}

export interface EnhancedUser extends UserRow {
  roles: string[];
  is_online: boolean;
  user_type: 'admin' | 'staff' | 'customer';
}

// ============================================
// Order Types
// ============================================

export interface OrderItemRow {
  id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  notes?: string | null;
  menu_items?: {
    id: string;
    name: string;
    image_url?: string | null;
  } | null;
}

export interface RestaurantOrderRow {
  id: string;
  order_number: string;
  status: string;
  order_type?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount: string;
  payment_status?: string;
  created_at: string;
  updated_at?: string | null;
  items?: OrderItemRow[];
  restaurant_order_items?: { id: string }[];
}

export interface SnackOrderRow {
  id: string;
  order_number: string;
  status: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount: string;
  payment_status: string;
  created_at: string;
  updated_at?: string | null;
}

// ============================================
// Booking Types
// ============================================

export interface ChaletBookingRow {
  id: string;
  confirmation_number: string;
  chalet_id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  total_amount: string;
  payment_status: string;
  user_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PoolTicketRow {
  id: string;
  ticket_number: string;
  status: string;
  ticket_date: string;
  number_of_guests: number;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  total_amount: string;
  payment_status: string;
  user_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

// ============================================
// Menu Types
// ============================================

export interface MenuCategoryRow {
  id: string;
  name: string;
  name_ar?: string | null;
  slug?: string;
  display_order: number;
  is_active: boolean;
  module_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface MenuItemRow {
  id: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  price: string;
  category_id: string;
  is_available: boolean;
  is_featured: boolean;
  image_url?: string | null;
  preparation_time?: number | null;
  calories?: number | null;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  spiciness_level?: number;
  created_at: string;
  updated_at?: string | null;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardStats {
  restaurant: {
    ordersToday: number;
    revenueToday: number;
    ordersTrend: number;
    revenueTrend: number;
  };
  snack: {
    ordersToday: number;
    revenueToday: number;
    ordersTrend: number;
    revenueTrend: number;
  };
  chalets: {
    bookingsToday: number;
    revenueToday: number;
    bookingsTrend: number;
    revenueTrend: number;
  };
  pool: {
    ticketsToday: number;
    revenueToday: number;
    ticketsTrend: number;
    revenueTrend: number;
  };
  users: {
    total: number;
    onlineNow: number;
  };
  recentOrders: RecentOrderSummary[];
}

export interface RecentOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  totalAmount: string;
  itemCount: number;
  createdAt: string;
}

// ============================================
// Settings Types
// ============================================

export interface ModuleSettingsRow {
  id: string;
  module_id?: string | null;
  setting_key: string;
  setting_value: unknown;
  description?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface AppearanceSettingsRow {
  id: string;
  module_id?: string | null;
  theme?: string;
  primary_color?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  custom_css?: string | null;
  created_at: string;
  updated_at?: string | null;
}

// ============================================
// Backup Types
// ============================================

export interface BackupData {
  metadata: {
    version: string;
    createdAt: string;
    createdBy: string;
    tables: string[];
  };
  data: Record<string, unknown[]>;
}

export interface RestoreOptions {
  skipUsers?: boolean;
  skipRoles?: boolean;
  skipPayments?: boolean;
  mergeData?: boolean;
}

// ============================================
// API Response Types
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// Helper Functions for Type Safety
// ============================================

/**
 * Safely derive a canonical slug from a permission object
 */
export function deriveSlugFromPermission(perm: PermissionRow | null | undefined): string | null {
  if (!perm) return null;
  if (perm.slug) return perm.slug;
  if (perm.name && perm.name.includes('.')) return perm.name;
  if (perm.resource && perm.action) return `${perm.resource}.${perm.action}`;
  if (perm.name) return perm.name.toLowerCase().replace(/\s+/g, '.');
  return null;
}

/**
 * Type guard to check if a value is a valid user row
 */
export function isUserRow(value: unknown): value is UserRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as UserRow).id === 'string' &&
    typeof (value as UserRow).email === 'string'
  );
}

/**
 * Calculate sum of amounts from an array of records
 */
export function sumAmounts(records: Array<{ total_amount?: string | null }>): number {
  return records.reduce((sum, record) => {
    const amount = parseFloat(record.total_amount || '0');
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
}

/**
 * Calculate percentage change between two values
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
