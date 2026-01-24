/**
 * Backend Type Definitions
 * 
 * Common types used across the backend for type safety
 */

// ============================================
// Error Types
// ============================================

export interface ValidationError {
  path: string[];
  message: string;
  code?: string;
}

export interface ZodValidationError {
  path: (string | number)[];
  message: string;
  code: string;
}

// ============================================
// Database Row Types (Supabase responses)
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
  updated_at: string;
  last_login_at?: string | null;
}

export interface RoleRow {
  id: string;
  name: string;
  display_name?: string;
  description?: string | null;
}

export interface PermissionRow {
  id: string;
  name: string;
  description?: string | null;
  resource?: string;
  action?: string;
  module_slug?: string | null;
}

export interface UserRoleRow {
  user_id: string;
  role_id: string;
  roles?: RoleRow | null;
}

export interface RolePermissionRow {
  role_id: string;
  permission_id: string;
  permissions?: PermissionRow | null;
}

export interface UserPermissionRow {
  user_id: string;
  permission_id: string;
  permissions?: PermissionRow | null;
}

export interface UserWithRolesRow extends UserRow {
  user_roles?: UserRoleRow[];
  user_permissions?: UserPermissionRow[];
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
  order_type: string;
  total_amount: string;
  subtotal?: string;
  tax_amount?: string;
  discount_amount?: string;
  payment_status: string;
  payment_method?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  table_number?: string | null;
  chalet_number?: string | null;
  special_instructions?: string | null;
  estimated_ready_time?: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow[];
}

// ============================================
// Settings Types
// ============================================

export interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  description?: string | null;
  category?: string;
  updated_at: string;
}

export interface SettingUpdate {
  key: string;
  value: unknown;
}

// ============================================
// Activity Log Types
// ============================================

export interface ActivityLogRow {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  users?: UserRow | null;
}

// ============================================
// Pool Types
// ============================================

export interface PoolSessionRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Chalet Types
// ============================================

export interface ChaletRow {
  id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  capacity: number;
  bedroom_count: number;
  bathroom_count: number;
  base_price: string;
  weekend_price?: string | null;
  is_active: boolean;
  images?: string[];
  amenities?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Menu Types
// ============================================

export interface MenuCategoryRow {
  id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  display_order: number;
  is_active: boolean;
  image_url?: string | null;
  module_id?: string | null;
}

export interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  price: string;
  is_available: boolean;
  is_featured?: boolean;
  image_url?: string | null;
  display_order: number;
  preparation_time_minutes?: number | null;
  module_id?: string | null;
}

// ============================================
// Module Types
// ============================================

export interface ModuleRow {
  id: string;
  template_type: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  show_in_main?: boolean;
  settings?: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Backup Types
// ============================================

export interface BackupData {
  version: string;
  timestamp: string;
  tables: Record<string, unknown[]>;
}

export interface BackupRestoreOptions {
  skipExisting?: boolean;
  onConflict?: 'skip' | 'replace' | 'error';
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  errors?: ValidationError[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Request Types
// ============================================

export interface AuthenticatedUser {
  userId: string;
  id: string; // Alias for userId
  email: string;
  roles: string[];
  permissions?: string[];
}

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId: string;
    }
  }
}

// ============================================
// Utility Types
// ============================================

/** Type guard for checking if error has message property */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/** Type guard for checking if error has statusCode property */
export function isErrorWithStatusCode(error: unknown): error is { statusCode: number; message: string } {
  return (
    isErrorWithMessage(error) &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  );
}

/** Extract error message from unknown error */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
