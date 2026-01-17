/**
 * Dependency Injection Type Definitions
 * 
 * Central type definitions for all injectable services and repositories.
 * These interfaces define contracts that implementations must follow,
 * enabling easy substitution with test doubles.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Transporter } from 'nodemailer';

// ============================================
// DATABASE TYPES
// ============================================

export interface DatabaseClient {
  from(table: string): QueryBuilder;
  rpc(fn: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }>;
}

export interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  insert(data: Record<string, unknown> | Record<string, unknown>[]): QueryBuilder;
  update(data: Record<string, unknown>): QueryBuilder;
  delete(): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  neq(column: string, value: unknown): QueryBuilder;
  gt(column: string, value: unknown): QueryBuilder;
  gte(column: string, value: unknown): QueryBuilder;
  lt(column: string, value: unknown): QueryBuilder;
  lte(column: string, value: unknown): QueryBuilder;
  in(column: string, values: unknown[]): QueryBuilder;
  is(column: string, value: null | boolean): QueryBuilder;
  or(filters: string): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  single(): Promise<{ data: unknown; error: Error | null }>;
  maybeSingle(): Promise<{ data: unknown; error: Error | null }>;
  then<T>(resolve: (result: { data: T[]; error: Error | null }) => void): Promise<void>;
}

// ============================================
// REPOSITORY INTERFACES
// ============================================

export interface PoolSession {
  id: string;
  module_id?: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  price: number;
  adult_price?: number;
  child_price?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PoolTicket {
  id: string;
  ticket_number: string;
  session_id: string;
  date: string;
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  adults: number;
  children: number;
  infants: number;
  total_price: number;
  payment_method: string;
  payment_status: string;
  qr_code?: string;
  entry_time?: string;
  exit_time?: string;
  status: 'pending' | 'valid' | 'used' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface PoolRepository {
  getSessions(moduleId?: string): Promise<PoolSession[]>;
  getSessionById(id: string): Promise<PoolSession | null>;
  getAvailability(date: string, sessionId?: string, moduleId?: string): Promise<{ session: PoolSession; booked: number; available: number }[]>;
  createTicket(ticket: Omit<PoolTicket, 'id' | 'created_at' | 'updated_at'>): Promise<PoolTicket>;
  getTicketById(id: string): Promise<PoolTicket | null>;
  getTicketByNumber(ticketNumber: string): Promise<PoolTicket | null>;
  getTicketsByDate(date: string): Promise<PoolTicket[]>;
  getTicketsByUser(userId: string): Promise<PoolTicket[]>;
  updateTicket(id: string, data: Partial<PoolTicket>): Promise<PoolTicket>;
  createSession(session: Omit<PoolSession, 'id' | 'created_at' | 'updated_at'>): Promise<PoolSession>;
  updateSession(id: string, data: Partial<PoolSession>): Promise<PoolSession>;
  deleteSession(id: string): Promise<void>;
}

// ============================================
// AUTH REPOSITORY TYPES
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string;
  profile_image_url?: string;
  preferred_language: 'en' | 'ar' | 'fr';
  email_verified: boolean;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  id: string;
  user_id: string;
  token: string;
  refresh_token: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
  last_activity?: string;
  created_at: string;
}

export interface AuthRole {
  id: string;
  name: string;
  display_name: string;
}

export interface AuthUserRole {
  user_id: string;
  role_id: string;
  role?: AuthRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthRepository {
  // User operations
  getUserById(id: string): Promise<AuthUser | null>;
  getUserByEmail(email: string): Promise<AuthUser | null>;
  createUser(user: Omit<AuthUser, 'id' | 'created_at' | 'updated_at'>): Promise<AuthUser>;
  updateUser(id: string, data: Partial<AuthUser>): Promise<AuthUser>;
  
  // Role operations
  getRoleByName(name: string): Promise<AuthRole | null>;
  getUserRoles(userId: string): Promise<string[]>;
  assignRole(userId: string, roleId: string): Promise<void>;
  
  // Session operations
  createSession(session: Omit<AuthSession, 'id' | 'created_at'>): Promise<AuthSession>;
  getSessionByToken(token: string): Promise<AuthSession | null>;
  getSessionByRefreshToken(refreshToken: string): Promise<AuthSession | null>;
  updateSession(id: string, data: Partial<AuthSession>): Promise<AuthSession>;
  invalidateSession(token: string): Promise<void>;
  invalidateUserSessions(userId: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
}

// ============================================
// RESTAURANT REPOSITORY TYPES
// ============================================

export interface RestaurantOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  table_id?: string;
  module_id?: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery' | 'room_service';
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'delivered' | 'completed' | 'cancelled';
  subtotal: string;
  tax_amount: string;
  service_charge: string;
  delivery_fee: string;
  discount_amount: string;
  total_amount: string;
  special_instructions?: string;
  estimated_ready_time?: string;
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method?: 'cash' | 'card' | 'whish' | 'online' | 'room_charge';
  created_at: string;
  updated_at: string;
}

export interface RestaurantOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  special_instructions?: string;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  module_id?: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantMenuItem {
  id: string;
  module_id?: string;
  category_id?: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: string;
  discount_price?: string;
  image_url?: string;
  is_available: boolean;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_dairy_free: boolean;
  is_halal: boolean;
  is_spicy: boolean;
  allergens: string[];
  calories?: number;
  preparation_time_minutes?: number;
  display_order: number;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantTable {
  id: string;
  module_id?: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  created_at: string;
  updated_at: string;
}

export interface RestaurantRepository {
  // Order operations
  createOrder(order: Omit<RestaurantOrder, 'id' | 'created_at' | 'updated_at'>): Promise<RestaurantOrder>;
  getOrderById(id: string): Promise<RestaurantOrder | null>;
  getOrderByNumber(orderNumber: string): Promise<RestaurantOrder | null>;
  getOrders(filters: { status?: string; date?: string; moduleId?: string }): Promise<RestaurantOrder[]>;
  getLiveOrders(moduleId?: string): Promise<RestaurantOrder[]>;
  getOrdersByCustomer(customerId: string): Promise<RestaurantOrder[]>;
  updateOrder(id: string, data: Partial<RestaurantOrder>): Promise<RestaurantOrder>;
  
  // Order items operations
  createOrderItems(items: Omit<RestaurantOrderItem, 'id' | 'created_at'>[]): Promise<RestaurantOrderItem[]>;
  getOrderItems(orderId: string): Promise<RestaurantOrderItem[]>;
  
  // Menu item operations
  getMenuItemById(id: string): Promise<RestaurantMenuItem | null>;
  getMenuItemsByIds(ids: string[]): Promise<RestaurantMenuItem[]>;
  getMenuItems(filters?: { categoryId?: string; moduleId?: string; available?: boolean }): Promise<RestaurantMenuItem[]>;
  
  // Table operations
  getTableById(id: string): Promise<RestaurantTable | null>;
  getTables(moduleId?: string): Promise<RestaurantTable[]>;
  updateTable(id: string, data: Partial<RestaurantTable>): Promise<RestaurantTable>;
}

export interface MenuItemFilters {
  categoryId?: string;
  moduleId?: string;
  availableOnly?: boolean;
  featuredOnly?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  isHalal?: boolean;
  search?: string;
}

export interface MenuRepository {
  // Category operations
  getCategories(filters?: { moduleId?: string; activeOnly?: boolean }): Promise<MenuCategory[]>;
  getCategoryById(id: string): Promise<MenuCategory | null>;
  createCategory(category: Omit<MenuCategory, 'id' | 'created_at' | 'updated_at'>): Promise<MenuCategory>;
  updateCategory(id: string, data: Partial<MenuCategory>): Promise<MenuCategory>;
  deleteCategory(id: string): Promise<void>;
  
  // Menu item operations
  getMenuItems(filters?: MenuItemFilters): Promise<RestaurantMenuItem[]>;
  getMenuItemById(id: string): Promise<RestaurantMenuItem | null>;
  getMenuItemsByIds(ids: string[]): Promise<RestaurantMenuItem[]>;
  getFeaturedItems(moduleId?: string): Promise<RestaurantMenuItem[]>;
  createMenuItem(item: Omit<RestaurantMenuItem, 'id' | 'created_at' | 'updated_at'>): Promise<RestaurantMenuItem>;
  updateMenuItem(id: string, data: Partial<RestaurantMenuItem>): Promise<RestaurantMenuItem>;
  deleteMenuItem(id: string): Promise<void>;
  setItemAvailability(id: string, isAvailable: boolean): Promise<RestaurantMenuItem>;
}

// ============================================
// CHALET REPOSITORY TYPES
// ============================================

export interface Chalet {
  id: string;
  module_id?: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  capacity: number;
  bedroom_count: number;
  bathroom_count: number;
  amenities: string[];
  images: string[];
  base_price: string;
  weekend_price: string;
  size?: string;
  status?: 'available' | 'occupied' | 'maintenance';
  is_active: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ChaletBooking {
  id: string;
  booking_number: string;
  chalet_id: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  number_of_nights: number;
  base_amount: string;
  add_ons_amount: string;
  deposit_amount: string;
  total_amount: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  payment_status: 'pending' | 'deposit_paid' | 'paid' | 'refunded';
  payment_method?: 'cash' | 'card' | 'whish' | 'online';
  special_requests?: string;
  checked_in_at?: string;
  checked_in_by?: string;
  checked_out_at?: string;
  checked_out_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ChaletBookingAddOn {
  id: string;
  booking_id: string;
  add_on_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  created_at: string;
}

export interface ChaletAddOn {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  price: string;
  price_type: 'one_time' | 'per_night';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChaletPriceRule {
  id: string;
  chalet_id: string;
  name: string;
  start_date: string;
  end_date: string;
  price?: string;
  price_multiplier?: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChaletRepository {
  // Chalet operations
  getChalets(filters?: { moduleId?: string; activeOnly?: boolean }): Promise<Chalet[]>;
  getChaletById(id: string): Promise<Chalet | null>;
  createChalet(chalet: Omit<Chalet, 'id' | 'created_at' | 'updated_at'>): Promise<Chalet>;
  updateChalet(id: string, data: Partial<Chalet>): Promise<Chalet>;
  deleteChalet(id: string): Promise<void>;
  
  // Booking operations
  createBooking(booking: Omit<ChaletBooking, 'id' | 'created_at' | 'updated_at'>): Promise<ChaletBooking>;
  getBookingById(id: string): Promise<ChaletBooking | null>;
  getBookingByNumber(bookingNumber: string): Promise<ChaletBooking | null>;
  getBookings(filters: { chaletId?: string; status?: string; startDate?: string; endDate?: string }): Promise<ChaletBooking[]>;
  getBookingsByCustomer(customerId: string): Promise<ChaletBooking[]>;
  getBookingsForChalet(chaletId: string, startDate?: string, endDate?: string): Promise<ChaletBooking[]>;
  getTodayBookings(): Promise<{ checkIns: ChaletBooking[]; checkOuts: ChaletBooking[] }>;
  updateBooking(id: string, data: Partial<ChaletBooking>): Promise<ChaletBooking>;
  
  // Booking add-ons
  createBookingAddOns(addOns: Omit<ChaletBookingAddOn, 'id' | 'created_at'>[]): Promise<ChaletBookingAddOn[]>;
  getBookingAddOns(bookingId: string): Promise<ChaletBookingAddOn[]>;
  
  // Add-on operations
  getAddOns(activeOnly?: boolean): Promise<ChaletAddOn[]>;
  getAddOnById(id: string): Promise<ChaletAddOn | null>;
  getAddOnsByIds(ids: string[]): Promise<ChaletAddOn[]>;
  createAddOn(addOn: Omit<ChaletAddOn, 'id' | 'created_at' | 'updated_at'>): Promise<ChaletAddOn>;
  updateAddOn(id: string, data: Partial<ChaletAddOn>): Promise<ChaletAddOn>;
  deleteAddOn(id: string): Promise<void>;
  
  // Price rule operations
  getPriceRules(chaletId?: string): Promise<ChaletPriceRule[]>;
  createPriceRule(rule: Omit<ChaletPriceRule, 'id' | 'created_at' | 'updated_at'>): Promise<ChaletPriceRule>;
  updatePriceRule(id: string, data: Partial<ChaletPriceRule>): Promise<ChaletPriceRule>;
  deletePriceRule(id: string): Promise<void>;
  
  // Settings operations
  getChaletSettings(): Promise<{ deposit_percentage: number; check_in_time: string; check_out_time: string; deposit_type?: 'percentage' | 'fixed'; deposit_fixed?: number }>;
  updateChaletSettings(settings: Record<string, unknown>): Promise<void>;
}

// ============================================
// REVIEW REPOSITORY TYPES
// ============================================

export type ServiceType = 'general' | 'restaurant' | 'chalets' | 'pool' | 'snack_bar';

export interface Review {
  id: string;
  user_id: string;
  rating: number;
  text: string;
  service_type: ServiceType;
  is_approved: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ReviewWithUser extends Review {
  user?: {
    id?: string;
    full_name?: string;
    email?: string;
    profile_image_url?: string;
  };
}

export interface ReviewFilters {
  status?: 'pending' | 'approved' | 'all';
  serviceType?: ServiceType;
  userId?: string;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
}

export interface ReviewRepository {
  getApprovedReviews(serviceType?: ServiceType, limit?: number): Promise<ReviewWithUser[]>;
  getReviewStats(): Promise<ReviewStats>;
  getReviewById(id: string): Promise<Review | null>;
  getReviewByUserAndService(userId: string, serviceType: ServiceType): Promise<Review | null>;
  getAllReviews(filters?: ReviewFilters): Promise<ReviewWithUser[]>;
  createReview(review: Omit<Review, 'id' | 'created_at' | 'updated_at'>): Promise<Review>;
  updateReviewStatus(id: string, isApproved: boolean): Promise<Review>;
  deleteReview(id: string): Promise<void>;
}

// ============================================
// SNACK REPOSITORY TYPES
// ============================================

export type SnackCategory = 'sandwich' | 'drink' | 'snack' | 'ice_cream';

export interface SnackItem {
  id: string;
  module_id?: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  price: string;
  category: SnackCategory;
  image_url?: string;
  display_order: number;
  is_available: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export type SnackOrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface SnackOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  status: SnackOrderStatus;
  total_amount: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method?: string;
  estimated_ready_time?: string;
  completed_at?: string;
  deleted_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface SnackOrderItem {
  id: string;
  order_id: string;
  snack_item_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  notes?: string;
}

export interface SnackOrderWithItems extends SnackOrder {
  items?: Array<SnackOrderItem & { item?: SnackItem }>;
}

export interface SnackItemFilters {
  category?: SnackCategory;
  moduleId?: string;
  availableOnly?: boolean;
}

export interface SnackOrderFilters {
  status?: SnackOrderStatus | SnackOrderStatus[];
  customerId?: string;
  limit?: number;
}

export interface SnackRepository {
  // Item operations
  getItems(filters?: SnackItemFilters): Promise<SnackItem[]>;
  getItemById(id: string): Promise<SnackItem | null>;
  getItemsByIds(ids: string[]): Promise<SnackItem[]>;
  createItem(item: Omit<SnackItem, 'id' | 'created_at' | 'updated_at'>): Promise<SnackItem>;
  updateItem(id: string, data: Partial<SnackItem>): Promise<SnackItem>;
  deleteItem(id: string): Promise<void>;
  setItemAvailability(id: string, isAvailable: boolean): Promise<SnackItem>;
  
  // Order operations
  createOrder(order: Omit<SnackOrder, 'id' | 'created_at' | 'updated_at'>): Promise<SnackOrder>;
  createOrderItems(items: Omit<SnackOrderItem, 'id'>[]): Promise<SnackOrderItem[]>;
  getOrderById(id: string): Promise<SnackOrderWithItems | null>;
  getOrders(filters?: SnackOrderFilters): Promise<SnackOrderWithItems[]>;
  getOrdersByCustomer(customerId: string, limit?: number): Promise<SnackOrderWithItems[]>;
  getLiveOrders(): Promise<SnackOrderWithItems[]>;
  updateOrderStatus(id: string, status: SnackOrderStatus, additionalData?: Partial<SnackOrder>): Promise<SnackOrder>;
}

// ============================================
// SUPPORT MODULE TYPES
// ============================================

export type SupportInquiryStatus = 'new' | 'in_progress' | 'resolved' | 'closed';

export interface SupportInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: SupportInquiryStatus;
  assigned_to?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupportRepository {
  // Inquiry operations
  createInquiry(data: Omit<SupportInquiry, 'id' | 'created_at' | 'updated_at'>): Promise<SupportInquiry>;
  getInquiryById(id: string): Promise<SupportInquiry | null>;
  getInquiries(filters?: { status?: SupportInquiryStatus }): Promise<SupportInquiry[]>;
  updateInquiryStatus(id: string, status: SupportInquiryStatus): Promise<SupportInquiry>;
  
  // FAQ operations
  getPublishedFAQs(): Promise<FAQ[]>;
  getFAQById(id: string): Promise<FAQ | null>;
  createFAQ(data: Omit<FAQ, 'id' | 'created_at' | 'updated_at'>): Promise<FAQ>;
  updateFAQ(id: string, data: Partial<FAQ>): Promise<FAQ>;
  deleteFAQ(id: string): Promise<void>;
}

// ============================================
// USER MODULE TYPES
// ============================================

export type PreferredLanguage = 'en' | 'ar' | 'fr';

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  profile_image_url?: string | null;
  preferred_language: PreferredLanguage;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  last_login_at?: string | null;
}

export interface UserWithRoles extends User {
  roles: Role[];
}

export interface UserFilters {
  search?: string;
  isActive?: boolean;
  roleId?: string;
}

export interface UserRepository {
  getUserById(id: string): Promise<UserWithRoles | null>;
  getUserByEmail(email: string): Promise<UserWithRoles | null>;
  getUsers(filters?: UserFilters, pagination?: { page: number; limit: number }): Promise<{ users: UserWithRoles[]; total: number }>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserRoles(id: string, roleIds: string[]): Promise<Role[]>;
  getRoleById(id: string): Promise<Role | null>;
  getRolesByIds(ids: string[]): Promise<Role[]>;
  getUserRoles(userId: string): Promise<Role[]>;
}

// ============================================
// SETTINGS MODULE TYPES
// ============================================

export type SettingCategory = 'general' | 'appearance' | 'business' | 'notifications' | 'integrations';

export interface Setting {
  id: string;
  key: string;
  value: unknown;
  category: SettingCategory;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsMap {
  [key: string]: unknown;
}

export interface SettingsRepository {
  getAllSettings(): Promise<Setting[]>;
  getSettingsByCategory(category: SettingCategory): Promise<Setting[]>;
  getSettingByKey(key: string): Promise<Setting | null>;
  upsertSetting(data: { key: string; value: unknown; category?: SettingCategory; description?: string }): Promise<Setting>;
  deleteSetting(key: string): Promise<void>;
}

// ============================================
// AUDIT MODULE TYPES
// ============================================

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'login' 
  | 'logout' 
  | 'password_change' 
  | 'role_change'
  | 'status_change'
  | 'settings_update';

export type AuditResource = 
  | 'user' 
  | 'booking' 
  | 'order' 
  | 'chalet' 
  | 'menu_item' 
  | 'review' 
  | 'settings' 
  | 'pool_ticket'
  | 'snack_item'
  | 'support_inquiry';

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  resource: AuditResource;
  resource_id?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuditLogWithUser extends AuditLog {
  user?: {
    full_name: string;
    email: string;
  } | null;
}

export interface AuditFilters {
  userId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditRepository {
  createLog(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog>;
  getLogs(filters?: AuditFilters, pagination?: { limit: number; offset: number }): Promise<{ logs: AuditLogWithUser[]; total: number }>;
  getLogById(id: string): Promise<AuditLogWithUser | null>;
  getLogsByResource(resource: AuditResource, resourceId?: string): Promise<AuditLogWithUser[]>;
  deleteOldLogs(olderThanDays: number): Promise<number>;
}

// ============================================
// NOTIFICATION MODULE TYPES
// ============================================

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationTargetType = 'all' | 'admin' | 'staff' | 'user' | 'customer';
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationAction {
  label: string;
  url: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface Notification {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  target_type: NotificationTargetType;
  channel: NotificationChannel;
  priority?: NotificationPriority;
  is_read: boolean;
  read_at?: string | null;
  data?: Record<string, unknown> | null;
  actions?: NotificationAction[] | null;
  scheduled_for?: string | null;
  sent_at?: string | null;
  created_at: string;
  expires_at?: string | null;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: NotificationType;
  target_type: NotificationTargetType;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
  variables?: string[]; // Placeholders like {{name}}, {{order_id}}
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  target_type: NotificationTargetType;
  priority?: NotificationPriority;
  target_user_ids?: string[];
  actions?: NotificationAction[];
  scheduled_for?: string | null;
  sent_at?: string | null;
  delivery_count?: number;
  read_count?: number;
  created_by: string;
  created_at: string;
}

export interface NotificationFilters {
  userId?: string;
  type?: NotificationType;
  targetType?: NotificationTargetType;
  isRead?: boolean;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  scheduled?: boolean;
  sent?: boolean;
}

export interface NotificationRepository {
  create(data: Omit<Notification, 'id' | 'created_at'>): Promise<Notification>;
  getById(id: string): Promise<Notification | null>;
  getByUserId(userId: string, filters?: NotificationFilters): Promise<Notification[]>;
  getAll(filters?: NotificationFilters, pagination?: { limit: number; offset: number }): Promise<{ notifications: Notification[]; total: number }>;
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(userId: string): Promise<number>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  deleteMultiple(ids: string[]): Promise<number>;
  createBroadcast(data: Omit<BroadcastNotification, 'id' | 'created_at'>): Promise<BroadcastNotification>;
  getBroadcasts(targetType?: NotificationTargetType): Promise<BroadcastNotification[]>;
  getBroadcastById(id: string): Promise<BroadcastNotification | null>;
  updateBroadcast(id: string, data: Partial<BroadcastNotification>): Promise<BroadcastNotification>;
  getScheduledNotifications(): Promise<Notification[]>;
  getScheduledBroadcasts(): Promise<BroadcastNotification[]>;
  // Templates
  createTemplate(data: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationTemplate>;
  getTemplates(activeOnly?: boolean): Promise<NotificationTemplate[]>;
  getTemplateById(id: string): Promise<NotificationTemplate | null>;
  updateTemplate(id: string, data: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
  deleteTemplate(id: string): Promise<void>;
}

// ============================================
// SERVICE INTERFACES
// ============================================

export interface EmailService {
  sendEmail(options: EmailOptions): Promise<boolean>;
  sendTemplatedEmail(templateName: string, to: string, variables: Record<string, unknown>): Promise<boolean>;
  sendPoolTicketConfirmation(ticket: PoolTicket, session: PoolSession): Promise<boolean>;
  sendBookingConfirmation(booking: unknown): Promise<boolean>;
  sendOrderConfirmation(order: unknown): Promise<boolean>;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  encoding?: string;
  contentType?: string;
}

export interface QRCodeService {
  generate(data: string): Promise<string>;
  generateAsBuffer(data: string): Promise<Buffer>;
}

export interface LoggerService {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface ActivityLoggerService {
  log(action: string, details: Record<string, unknown>, userId?: string): Promise<void>;
}

export interface SocketEmitter {
  emitToUnit(unit: string, event: string, data: unknown): void;
  emitToRoom(room: string, event: string, data: unknown): void;
  emitToUser(userId: string, event: string, data: unknown): void;
}

// ============================================
// PAYMENT MODULE TYPES
// ============================================

export type PaymentMethod = 'card' | 'cash' | 'bank_transfer' | 'other';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type ReferenceType = 'order' | 'booking' | 'pool_ticket' | 'snack_order';

export interface Payment {
  id: string;
  reference_type: ReferenceType;
  reference_id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  notes?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PaymentFilters {
  referenceType?: ReferenceType;
  referenceId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  startDate?: string;
  endDate?: string;
}

export interface PaymentRepository {
  create(data: Omit<Payment, 'id' | 'created_at'>): Promise<Payment>;
  getById(id: string): Promise<Payment | null>;
  getByReferenceId(referenceType: ReferenceType, referenceId: string): Promise<Payment[]>;
  getAll(filters?: PaymentFilters, pagination?: { limit: number; offset: number }): Promise<{ payments: Payment[]; total: number }>;
  updateStatus(id: string, status: PaymentStatus, notes?: string): Promise<Payment>;
  getPaymentStats(startDate?: string, endDate?: string): Promise<{
    totalAmount: number;
    totalCount: number;
    byMethod: Record<PaymentMethod, number>;
    byStatus: Record<PaymentStatus, number>;
  }>;
}

// ============================================
// REPORTING MODULE TYPES
// ============================================

export type ReportPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type ReportType = 'revenue' | 'bookings' | 'orders' | 'users' | 'pool' | 'reviews';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ReportFilters {
  period?: ReportPeriod;
  dateRange?: DateRange;
  moduleId?: string;
  chaletId?: string;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalOrders: number;
  totalBookings: number;
  averageOrderValue: number;
  averageBookingValue: number;
  revenueByDay: Array<{ date: string; amount: number }>;
  revenueByModule: Record<string, number>;
}

export interface BookingSummary {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  occupancyRate: number;
  averageStayDuration: number;
  popularChalets: Array<{ chaletId: string; chaletName: string; bookingCount: number }>;
}

export interface OrderSummary {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  topItems: Array<{ itemId: string; itemName: string; quantity: number; revenue: number }>;
  ordersByStatus: Record<string, number>;
}

export interface UserSummary {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  usersByRole: Record<string, number>;
  userGrowthByDay: Array<{ date: string; count: number }>;
}

export interface ReportingRepository {
  getRevenueSummary(filters: ReportFilters): Promise<RevenueSummary>;
  getBookingSummary(filters: ReportFilters): Promise<BookingSummary>;
  getOrderSummary(filters: ReportFilters): Promise<OrderSummary>;
  getUserSummary(filters: ReportFilters): Promise<UserSummary>;
}

// ============================================
// INVENTORY MODULE TYPES
// ============================================

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'return' | 'waste';
export type InventoryCategory = 'food' | 'beverage' | 'supplies' | 'equipment' | 'other';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: InventoryCategory;
  unit: string;
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  costPerUnit: number;
  supplierId?: string | null;
  location?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: StockMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string | null;
  referenceId?: string | null;
  performedBy: string;
  createdAt: string;
}

export interface InventoryFilters {
  category?: InventoryCategory;
  lowStock?: boolean;
  isActive?: boolean;
  search?: string;
}

export interface InventoryRepository {
  create(data: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem>;
  getById(id: string): Promise<InventoryItem | null>;
  getBySku(sku: string): Promise<InventoryItem | null>;
  getAll(filters?: InventoryFilters): Promise<InventoryItem[]>;
  update(id: string, data: Partial<InventoryItem>): Promise<InventoryItem>;
  delete(id: string): Promise<void>;
  recordMovement(movement: Omit<StockMovement, 'id' | 'createdAt'>): Promise<StockMovement>;
  getMovements(itemId: string, limit?: number): Promise<StockMovement[]>;
  getLowStockItems(): Promise<InventoryItem[]>;
}

// ============================================
// COUPON/DISCOUNT TYPES
// ============================================

export type CouponType = 'percentage' | 'fixed_amount' | 'free_shipping';
export type CouponScope = 'order' | 'product' | 'category' | 'booking' | 'pool';
export type CouponStatus = 'active' | 'expired' | 'depleted' | 'disabled';

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: CouponType;
  value: number;
  scope: CouponScope;
  scopeIds: string[] | null; // For product/category specific coupons
  minOrderAmount: number | null;
  maxDiscountAmount: number | null; // Cap for percentage discounts
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CouponUsage {
  id: string;
  couponId: string;
  userId: string;
  orderId: string | null;
  bookingId: string | null;
  discountAmount: number;
  createdAt: string;
}

export interface CouponFilters {
  type?: CouponType;
  scope?: CouponScope;
  isActive?: boolean;
  search?: string;
  includeExpired?: boolean;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon: Coupon | null;
  errorCode?: string;
  errorMessage?: string;
  discountAmount?: number;
}

export interface CouponRepository {
  create(coupon: Omit<Coupon, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<Coupon>;
  update(id: string, data: Partial<Coupon>): Promise<Coupon | null>;
  delete(id: string): Promise<boolean>;
  getById(id: string): Promise<Coupon | null>;
  getByCode(code: string): Promise<Coupon | null>;
  list(filters?: CouponFilters): Promise<Coupon[]>;
  incrementUsage(id: string): Promise<void>;
  recordUsage(usage: Omit<CouponUsage, 'id' | 'createdAt'>): Promise<CouponUsage>;
  getUsageByUser(couponId: string, userId: string): Promise<CouponUsage[]>;
  getUsageCount(couponId: string): Promise<number>;
}

// ============================================
// LOYALTY / REWARDS TYPES
// ============================================

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'adjust' | 'bonus';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyAccount {
  id: string;
  userId: string;
  totalPoints: number;
  availablePoints: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierExpiresAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  type: LoyaltyTransactionType;
  points: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface LoyaltyTierConfig {
  tier: LoyaltyTier;
  minPoints: number;
  multiplier: number;
  benefits: string[];
}

export interface LoyaltyFilters {
  userId?: string;
  tier?: LoyaltyTier;
  minPoints?: number;
}

export interface LoyaltyRepository {
  createAccount(userId: string): Promise<LoyaltyAccount>;
  getAccountByUserId(userId: string): Promise<LoyaltyAccount | null>;
  getAccountById(id: string): Promise<LoyaltyAccount | null>;
  updateAccount(id: string, data: Partial<LoyaltyAccount>): Promise<LoyaltyAccount | null>;
  addTransaction(transaction: Omit<LoyaltyTransaction, 'id' | 'createdAt'>): Promise<LoyaltyTransaction>;
  getTransactions(accountId: string, limit?: number): Promise<LoyaltyTransaction[]>;
  getExpiringPoints(accountId: string, beforeDate: string): Promise<LoyaltyTransaction[]>;
  listAccounts(filters?: LoyaltyFilters): Promise<LoyaltyAccount[]>;
}

// ============================================
// WAITLIST / QUEUE TYPES
// ============================================

export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'cancelled' | 'no_show';
export type WaitlistPriority = 'normal' | 'vip' | 'reservation';

export interface WaitlistEntry {
  id: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  partySize: number;
  priority: WaitlistPriority;
  status: WaitlistStatus;
  estimatedWaitMinutes: number | null;
  notifiedAt: string | null;
  seatedAt: string | null;
  tableId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WaitlistFilters {
  status?: WaitlistStatus;
  priority?: WaitlistPriority;
  minPartySize?: number;
  maxPartySize?: number;
  fromDate?: string;
  toDate?: string;
}

export interface WaitlistStats {
  totalWaiting: number;
  averageWaitMinutes: number;
  seatedToday: number;
  noShowsToday: number;
  cancelledToday: number;
}

export interface WaitlistRepository {
  create(entry: Omit<WaitlistEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<WaitlistEntry>;
  update(id: string, data: Partial<WaitlistEntry>): Promise<WaitlistEntry | null>;
  delete(id: string): Promise<boolean>;
  getById(id: string): Promise<WaitlistEntry | null>;
  getByPhone(phone: string): Promise<WaitlistEntry[]>;
  list(filters?: WaitlistFilters): Promise<WaitlistEntry[]>;
  getPosition(id: string): Promise<number>;
  getWaitingCount(): Promise<number>;
  getNextInQueue(): Promise<WaitlistEntry | null>;
}

// ============================================
// SCHEDULING / SHIFT TYPES
// ============================================

export type ShiftStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type ShiftType = 'morning' | 'afternoon' | 'evening' | 'night' | 'split' | 'on_call';

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  shiftType: ShiftType;
  status: ShiftStatus;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  breakMinutes: number;
  department: string;
  position: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ShiftSwapRequest {
  id: string;
  requestingShiftId: string;
  targetShiftId: string;
  requestingStaffId: string;
  targetStaffId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ShiftFilters {
  staffId?: string;
  department?: string;
  shiftType?: ShiftType;
  status?: ShiftStatus;
  startDate?: string;
  endDate?: string;
}

export interface ShiftRepository {
  create(shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>): Promise<Shift>;
  update(id: string, data: Partial<Shift>): Promise<Shift | null>;
  delete(id: string): Promise<boolean>;
  getById(id: string): Promise<Shift | null>;
  getByStaffId(staffId: string, filters?: ShiftFilters): Promise<Shift[]>;
  list(filters?: ShiftFilters): Promise<Shift[]>;
  getConflicts(staffId: string, start: string, end: string, excludeId?: string): Promise<Shift[]>;
  createSwapRequest(request: Omit<ShiftSwapRequest, 'id' | 'createdAt'>): Promise<ShiftSwapRequest>;
  getSwapRequest(id: string): Promise<ShiftSwapRequest | null>;
  updateSwapRequest(id: string, data: Partial<ShiftSwapRequest>): Promise<ShiftSwapRequest | null>;
  getSwapRequests(staffId: string): Promise<ShiftSwapRequest[]>;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface AppConfig {
  env: string;
  port: number;
  apiUrl: string;
  frontendUrl: string;
  database: { url: string };
  supabase: { url: string; anonKey: string; serviceKey: string };
  jwt: { secret: string; refreshSecret: string; expiresIn: string; refreshExpiresIn: string };
  stripe: { secretKey: string; webhookSecret: string };
  email: { host: string; port: number; user: string; pass: string; from: string };
}

// ============================================
// CONTAINER INTERFACE
// ============================================

// ============================================
// TASK/WORK ORDER TYPES
// ============================================

export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'maintenance' | 'cleaning' | 'repair' | 'inspection' | 'delivery' | 'setup' | 'other';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string;
  createdByName: string;
  location: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  completedAt: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  assignedTo?: string;
  createdBy?: string;
  location?: string;
  dueBefore?: string;
  dueAfter?: string;
  tags?: string[];
}

export interface TaskRepository {
  create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
  update(id: string, data: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Task | null>;
  list(filters?: TaskFilters): Promise<Task[]>;
  getByAssignee(staffId: string): Promise<Task[]>;
  addComment(comment: Omit<TaskComment, 'id' | 'createdAt'>): Promise<TaskComment>;
  getComments(taskId: string): Promise<TaskComment[]>;
  getOverdue(): Promise<Task[]>;
}

// ============================================
// GUEST PROFILE TYPES
// ============================================

export type GuestStatus = 'active' | 'inactive' | 'vip' | 'banned';

export interface GuestPreferences {
  roomType?: string;
  bedType?: string;
  floor?: 'low' | 'mid' | 'high';
  smoking?: boolean;
  dietaryRestrictions?: string[];
  specialRequests?: string;
}

export interface GuestProfile {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  status: GuestStatus;
  preferences: GuestPreferences;
  notes: string | null;
  tags: string[];
  totalStays: number;
  totalSpent: number;
  lastVisit: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface GuestFilters {
  status?: GuestStatus;
  email?: string;
  phone?: string;
  tags?: string[];
  minStays?: number;
  minSpent?: number;
}

export interface GuestRepository {
  create(guest: Omit<GuestProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<GuestProfile>;
  update(id: string, data: Partial<GuestProfile>): Promise<GuestProfile>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<GuestProfile | null>;
  getByEmail(email: string): Promise<GuestProfile | null>;
  getByPhone(phone: string): Promise<GuestProfile | null>;
  getByUserId(userId: string): Promise<GuestProfile | null>;
  list(filters?: GuestFilters): Promise<GuestProfile[]>;
  search(query: string): Promise<GuestProfile[]>;
}

// ============================================
// RATE/PRICING TYPES
// ============================================

export type RateType = 'standard' | 'seasonal' | 'promotional' | 'event' | 'package';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Rate {
  id: string;
  name: string;
  description: string;
  rateType: RateType;
  basePrice: number;
  currency: string;
  applicableItemType: string;
  applicableItemId: string | null;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: DayOfWeek[];
  minStay: number;
  maxStay: number | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface RateModifier {
  id: string;
  rateId: string;
  name: string;
  modifierType: 'percentage' | 'fixed';
  value: number;
  condition: string | null;
  createdAt: string;
}

export interface RateFilters {
  rateType?: RateType;
  itemType?: string;
  itemId?: string;
  activeOnly?: boolean;
  dateRange?: { start: string; end: string };
}

export interface RateRepository {
  create(rate: Omit<Rate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rate>;
  update(id: string, data: Partial<Rate>): Promise<Rate>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Rate | null>;
  list(filters?: RateFilters): Promise<Rate[]>;
  getApplicableRates(itemType: string, itemId: string | null, date: string): Promise<Rate[]>;
  addModifier(modifier: Omit<RateModifier, 'id' | 'createdAt'>): Promise<RateModifier>;
  getModifiers(rateId: string): Promise<RateModifier[]>;
  deleteModifier(id: string): Promise<void>;
}

// ============================================
// EVENT/VENUE TYPES
// ============================================

export type EventStatus = 'draft' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type EventType = 'wedding' | 'conference' | 'party' | 'meeting' | 'gala' | 'concert' | 'other';
export type VenueStatus = 'available' | 'maintenance' | 'reserved' | 'closed';

export interface Venue {
  id: string;
  name: string;
  description: string;
  capacity: number;
  indoorCapacity: number;
  outdoorCapacity: number;
  amenities: string[];
  hourlyRate: number;
  dailyRate: number;
  currency: string;
  status: VenueStatus;
  images: string[];
  location: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  eventType: EventType;
  venueId: string;
  organizerId: string;
  startTime: string;
  endTime: string;
  expectedGuests: number;
  actualGuests: number | null;
  status: EventStatus;
  budget: number | null;
  actualCost: number | null;
  notes: string | null;
  requirements: string[];
  createdAt: string;
  updatedAt: string | null;
}

export interface EventFilters {
  venueId?: string;
  organizerId?: string;
  eventType?: EventType;
  status?: EventStatus;
  dateRange?: { start: string; end: string };
}

export interface VenueFilters {
  status?: VenueStatus;
  minCapacity?: number;
  maxCapacity?: number;
  amenities?: string[];
}

export interface EventRepository {
  createVenue(venue: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>): Promise<Venue>;
  updateVenue(id: string, data: Partial<Venue>): Promise<Venue>;
  deleteVenue(id: string): Promise<void>;
  getVenueById(id: string): Promise<Venue | null>;
  listVenues(filters?: VenueFilters): Promise<Venue[]>;
  
  createEvent(event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event>;
  updateEvent(id: string, data: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  getEventById(id: string): Promise<Event | null>;
  listEvents(filters?: EventFilters): Promise<Event[]>;
  getEventsByVenue(venueId: string, startDate: string, endDate: string): Promise<Event[]>;
}

// ============================================
// MAINTENANCE/WORK ORDER TYPES
// ============================================

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';
export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'pending_parts' | 'completed' | 'cancelled';
export type WorkOrderCategory = 'electrical' | 'plumbing' | 'hvac' | 'structural' | 'appliance' | 'general';

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  locationId: string;
  locationType: string;
  reportedBy: string;
  assignedTo: string | null;
  scheduledDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  laborCost: number | null;
  partsCost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WorkOrderPart {
  id: string;
  workOrderId: string;
  partName: string;
  partNumber: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  category?: WorkOrderCategory;
  assignedTo?: string;
  locationId?: string;
  dateRange?: { start: string; end: string };
}

export interface MaintenanceRepository {
  create(workOrder: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkOrder>;
  update(id: string, data: Partial<WorkOrder>): Promise<WorkOrder>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<WorkOrder | null>;
  list(filters?: WorkOrderFilters): Promise<WorkOrder[]>;
  getByLocation(locationId: string): Promise<WorkOrder[]>;
  getByAssignee(assignedTo: string): Promise<WorkOrder[]>;
  
  addPart(part: Omit<WorkOrderPart, 'id' | 'createdAt'>): Promise<WorkOrderPart>;
  getParts(workOrderId: string): Promise<WorkOrderPart[]>;
  deletePart(id: string): Promise<void>;
}

// ============================================
// HOUSEKEEPING TYPES
// ============================================

export type RoomStatus = 'clean' | 'dirty' | 'in_progress' | 'inspected' | 'out_of_order';
export type CleaningPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface RoomCleaningTask {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  assignedTo: string | null;
  status: RoomStatus;
  priority: CleaningPriority;
  checkoutDate: string | null;
  checkinDate: string | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  inspectedBy: string | null;
  inspectedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CleaningSupply {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  lastRestocked: string | null;
}

export interface HousekeepingFilters {
  status?: RoomStatus;
  priority?: CleaningPriority;
  floor?: number;
  assignedTo?: string;
  dateRange?: { start: string; end: string };
}

export interface HousekeepingRepository {
  createTask(task: Omit<RoomCleaningTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoomCleaningTask>;
  updateTask(id: string, data: Partial<RoomCleaningTask>): Promise<RoomCleaningTask>;
  deleteTask(id: string): Promise<void>;
  getTaskById(id: string): Promise<RoomCleaningTask | null>;
  getTaskByRoomId(roomId: string): Promise<RoomCleaningTask | null>;
  listTasks(filters?: HousekeepingFilters): Promise<RoomCleaningTask[]>;
  getTasksByAssignee(assigneeId: string): Promise<RoomCleaningTask[]>;
  getTasksByFloor(floor: number): Promise<RoomCleaningTask[]>;
  
  createSupply(supply: Omit<CleaningSupply, 'id'>): Promise<CleaningSupply>;
  updateSupply(id: string, data: Partial<CleaningSupply>): Promise<CleaningSupply>;
  deleteSupply(id: string): Promise<void>;
  getSupplyById(id: string): Promise<CleaningSupply | null>;
  listSupplies(): Promise<CleaningSupply[]>;
  getLowSupplies(): Promise<CleaningSupply[]>;
}

// ============================================
// CHANNEL/DISTRIBUTION TYPES
// ============================================

export type ChannelType = 'direct' | 'ota' | 'gds' | 'travel_agent' | 'corporate' | 'metasearch' | 'other';
export type ChannelStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type ChannelCommissionType = 'percentage' | 'fixed' | 'tiered';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  status: ChannelStatus;
  code: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  commissionType: ChannelCommissionType;
  commissionRate: number;
  contractStart: string | null;
  contractEnd: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export interface ChannelRate {
  id: string;
  channelId: string;
  roomTypeId: string;
  baseRate: number;
  markup: number;
  markupType: 'percentage' | 'fixed';
  minStay: number;
  maxStay: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  createdAt: string;
}

export interface ChannelReservation {
  id: string;
  channelId: string;
  channelBookingRef: string;
  internalBookingId: string | null;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  commissionAmount: number;
  status: 'pending' | 'confirmed' | 'modified' | 'cancelled';
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ChannelFilters {
  type?: ChannelType;
  status?: ChannelStatus;
  search?: string;
}

export interface ChannelRepository {
  create(channel: Omit<Channel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Channel>;
  update(id: string, data: Partial<Channel>): Promise<Channel>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Channel | null>;
  getByCode(code: string): Promise<Channel | null>;
  list(filters?: ChannelFilters): Promise<Channel[]>;
  
  createRate(rate: Omit<ChannelRate, 'id' | 'createdAt'>): Promise<ChannelRate>;
  updateRate(id: string, data: Partial<ChannelRate>): Promise<ChannelRate>;
  deleteRate(id: string): Promise<void>;
  getRateById(id: string): Promise<ChannelRate | null>;
  getRatesForChannel(channelId: string): Promise<ChannelRate[]>;
  
  createReservation(res: Omit<ChannelReservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChannelReservation>;
  updateReservation(id: string, data: Partial<ChannelReservation>): Promise<ChannelReservation>;
  getReservationById(id: string): Promise<ChannelReservation | null>;
  getReservationByRef(channelId: string, ref: string): Promise<ChannelReservation | null>;
  listReservations(channelId: string): Promise<ChannelReservation[]>;
}

// ============================================
// FEEDBACK/SURVEY TYPES
// ============================================

export type FeedbackType = 'general' | 'service' | 'food' | 'room' | 'facilities' | 'staff' | 'complaint';
export type FeedbackStatus = 'pending' | 'reviewed' | 'responded' | 'resolved' | 'archived';
export type SurveySentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export interface Feedback {
  id: string;
  guestId: string | null;
  guestName: string;
  guestEmail: string;
  type: FeedbackType;
  status: FeedbackStatus;
  subject: string;
  message: string;
  rating: number | null;
  sentiment: SurveySentiment | null;
  department: string | null;
  assignedTo: string | null;
  response: string | null;
  respondedAt: string | null;
  respondedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  question: string;
  type: 'rating' | 'text' | 'choice' | 'yesno';
  options: string[] | null;
  required: boolean;
  order: number;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  questionId: string;
  guestId: string | null;
  answer: string;
  ratingValue: number | null;
  submittedAt: string;
}

export interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  department?: string;
  assignedTo?: string;
  dateRange?: { start: string; end: string };
}

export interface FeedbackRepository {
  create(feedback: Omit<Feedback, 'id' | 'createdAt' | 'updatedAt'>): Promise<Feedback>;
  update(id: string, data: Partial<Feedback>): Promise<Feedback>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Feedback | null>;
  list(filters?: FeedbackFilters): Promise<Feedback[]>;
  getByGuest(guestId: string): Promise<Feedback[]>;
  
  createQuestion(q: Omit<SurveyQuestion, 'id'>): Promise<SurveyQuestion>;
  updateQuestion(id: string, data: Partial<SurveyQuestion>): Promise<SurveyQuestion>;
  deleteQuestion(id: string): Promise<void>;
  getQuestionById(id: string): Promise<SurveyQuestion | null>;
  getQuestionsForSurvey(surveyId: string): Promise<SurveyQuestion[]>;
  
  createResponse(r: Omit<SurveyResponse, 'id'>): Promise<SurveyResponse>;
  getResponsesForSurvey(surveyId: string): Promise<SurveyResponse[]>;
  getResponsesForGuest(guestId: string): Promise<SurveyResponse[]>;
}

// ============================================
// PACKAGE/PROMOTION TYPES
// ============================================

export type PackageType = 'room_only' | 'bed_and_breakfast' | 'half_board' | 'full_board' | 'all_inclusive' | 'spa' | 'romantic' | 'family' | 'adventure' | 'custom';
export type PackageStatus = 'draft' | 'active' | 'inactive' | 'expired' | 'sold_out';

export interface Package {
  id: string;
  name: string;
  code: string;
  type: PackageType;
  status: PackageStatus;
  description: string;
  shortDescription: string | null;
  includes: string[];
  basePrice: number;
  discountPercentage: number;
  finalPrice: number;
  minNights: number;
  maxNights: number;
  validFrom: string;
  validTo: string;
  maxRedemptions: number | null;
  currentRedemptions: number;
  roomTypeIds: string[];
  imageUrl: string | null;
  termsAndConditions: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PackageRedemption {
  id: string;
  packageId: string;
  bookingId: string;
  guestId: string;
  redeemedAt: string;
  totalAmount: number;
  discountAmount: number;
}

export interface PackageFilters {
  type?: PackageType;
  status?: PackageStatus;
  minPrice?: number;
  maxPrice?: number;
  validOn?: string;
}

export interface PackageRepository {
  create(pkg: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<Package>;
  update(id: string, data: Partial<Package>): Promise<Package>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Package | null>;
  getByCode(code: string): Promise<Package | null>;
  list(filters?: PackageFilters): Promise<Package[]>;
  
  createRedemption(r: Omit<PackageRedemption, 'id'>): Promise<PackageRedemption>;
  getRedemptionsForPackage(packageId: string): Promise<PackageRedemption[]>;
  getRedemptionsForGuest(guestId: string): Promise<PackageRedemption[]>;
}

// ============================================
// DOCUMENT TYPES
// ============================================
export type DocumentType = 
  | 'contract'
  | 'invoice'
  | 'receipt'
  | 'id_document'
  | 'reservation_confirmation'
  | 'report'
  | 'policy'
  | 'image'
  | 'other';

export type DocumentStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'archived';

export type DocumentVisibility = 
  | 'public'
  | 'private'
  | 'internal'
  | 'guest_only';

export interface Document {
  id: string;
  name: string;
  originalName: string;
  type: DocumentType;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  mimeType: string;
  size: number;
  path: string;
  url: string | null;
  description: string | null;
  tags: string[];
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  uploadedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  path: string;
  size: number;
  changes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface DocumentFilters {
  type?: DocumentType;
  status?: DocumentStatus;
  visibility?: DocumentVisibility;
  uploadedBy?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  tags?: string[];
  search?: string;
}

export interface DocumentRepository {
  create(doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document>;
  update(id: string, data: Partial<Document>): Promise<Document>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Document | null>;
  getByPath(path: string): Promise<Document | null>;
  list(filters?: DocumentFilters): Promise<Document[]>;
  getByRelatedEntity(entityType: string, entityId: string): Promise<Document[]>;
  
  createVersion(version: Omit<DocumentVersion, 'id'>): Promise<DocumentVersion>;
  getVersions(documentId: string): Promise<DocumentVersion[]>;
  getLatestVersion(documentId: string): Promise<DocumentVersion | null>;
}

// ============================================
// ANALYTICS TYPES
// ============================================
export type MetricType = 
  | 'revenue'
  | 'occupancy'
  | 'bookings'
  | 'guests'
  | 'ratings'
  | 'cancellations'
  | 'adr'
  | 'revpar'
  | 'custom';

export type MetricPeriod = 
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export type MetricAggregation = 
  | 'sum'
  | 'average'
  | 'count'
  | 'min'
  | 'max';

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  value: number;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  period: MetricPeriod;
  startDate: string;
  endDate: string;
  unit: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  widgets: DashboardWidget[];
  ownerId: string;
  isDefault: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  name: string;
  type: 'metric' | 'chart' | 'table' | 'gauge' | 'heatmap';
  metricType: MetricType | null;
  config: Record<string, unknown>;
  position: { x: number; y: number; width: number; height: number };
  createdAt: string;
}

export interface AnalyticsFilters {
  period?: MetricPeriod;
  startDate?: string;
  endDate?: string;
  metricTypes?: MetricType[];
}

export interface AnalyticsRepository {
  createMetric(metric: Omit<Metric, 'id' | 'createdAt'>): Promise<Metric>;
  getMetric(id: string): Promise<Metric | null>;
  getMetricsByType(type: MetricType, period: MetricPeriod): Promise<Metric[]>;
  getMetricsForPeriod(startDate: string, endDate: string): Promise<Metric[]>;
  getLatestMetrics(types: MetricType[]): Promise<Metric[]>;
  
  createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard>;
  updateDashboard(id: string, data: Partial<Dashboard>): Promise<Dashboard>;
  deleteDashboard(id: string): Promise<void>;
  getDashboard(id: string): Promise<Dashboard | null>;
  getDashboardsByOwner(ownerId: string): Promise<Dashboard[]>;
  getDefaultDashboard(): Promise<Dashboard | null>;
  
  createWidget(widget: Omit<DashboardWidget, 'id' | 'createdAt'>): Promise<DashboardWidget>;
  updateWidget(id: string, data: Partial<DashboardWidget>): Promise<DashboardWidget>;
  deleteWidget(id: string): Promise<void>;
  getWidget(id: string): Promise<DashboardWidget | null>;
  getWidgetsForDashboard(dashboardId: string): Promise<DashboardWidget[]>;
}

// ============================================
// WEATHER TYPES
// ============================================

export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy' | 'windy';

export interface WeatherData {
  id: string;
  location: string;
  date: string;
  condition: WeatherCondition;
  temperatureHigh: number;
  temperatureLow: number;
  temperatureCurrent: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  uvIndex: number;
  precipitation: number;
  visibility: number;
  sunrise: string;
  sunset: string;
  forecast?: WeatherForecast[];
  createdAt: string;
  updatedAt: string | null;
}

export interface WeatherForecast {
  date: string;
  condition: WeatherCondition;
  temperatureHigh: number;
  temperatureLow: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
}

export interface WeatherAlert {
  id: string;
  type: 'warning' | 'watch' | 'advisory';
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
}

export interface ActivityRecommendation {
  id: string;
  name: string;
  description: string;
  category: 'outdoor' | 'indoor' | 'water' | 'sports' | 'relaxation' | 'dining';
  suitableConditions: WeatherCondition[];
  minTemperature: number;
  maxTemperature: number;
  maxWindSpeed: number;
  maxPrecipitation: number;
  duration: number;
  difficulty: 'easy' | 'moderate' | 'challenging';
  isActive: boolean;
  createdAt: string;
}

export interface WeatherFilters {
  location?: string;
  startDate?: string;
  endDate?: string;
  condition?: WeatherCondition;
}

export interface WeatherRepository {
  getCurrentWeather(location: string): Promise<WeatherData | null>;
  saveWeather(data: Omit<WeatherData, 'id' | 'createdAt' | 'updatedAt'>): Promise<WeatherData>;
  updateWeather(id: string, data: Partial<WeatherData>): Promise<WeatherData>;
  getWeatherHistory(location: string, startDate: string, endDate: string): Promise<WeatherData[]>;
  
  getAlerts(location: string): Promise<WeatherAlert[]>;
  createAlert(data: Omit<WeatherAlert, 'id' | 'createdAt'>): Promise<WeatherAlert>;
  updateAlert(id: string, data: Partial<WeatherAlert>): Promise<WeatherAlert>;
  deleteAlert(id: string): Promise<void>;
  
  getActivities(): Promise<ActivityRecommendation[]>;
  getActivityById(id: string): Promise<ActivityRecommendation | null>;
  createActivity(data: Omit<ActivityRecommendation, 'id' | 'createdAt'>): Promise<ActivityRecommendation>;
  updateActivity(id: string, data: Partial<ActivityRecommendation>): Promise<ActivityRecommendation>;
  deleteActivity(id: string): Promise<void>;
}

// ============================================
// CURRENCY TYPES
// ============================================

export interface Currency {
  code: string; // ISO 4217 code (e.g., USD, EUR, GBP)
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExchangeRate {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  source: string;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

export interface CurrencyConversion {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
  reference: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

export interface CurrencyRepository {
  getCurrencies(): Promise<Currency[]>;
  getCurrency(code: string): Promise<Currency | null>;
  createCurrency(data: Omit<Currency, 'createdAt' | 'updatedAt'>): Promise<Currency>;
  updateCurrency(code: string, data: Partial<Currency>): Promise<Currency>;
  deleteCurrency(code: string): Promise<void>;
  
  getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | null>;
  getExchangeRates(baseCurrency: string): Promise<ExchangeRate[]>;
  saveExchangeRate(data: Omit<ExchangeRate, 'id' | 'createdAt'>): Promise<ExchangeRate>;
  
  logConversion(data: Omit<CurrencyConversion, 'id' | 'createdAt'>): Promise<CurrencyConversion>;
  getConversions(filters: { fromDate?: string; toDate?: string; currency?: string }): Promise<CurrencyConversion[]>;
}

// ============================================
// GIFT CARD TYPES
// ============================================

export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'cancelled' | 'suspended';

export interface GiftCard {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: GiftCardStatus;
  purchasedBy: string;
  purchasedFor?: string;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  expiresAt: string;
  activatedAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  type: 'purchase' | 'redemption' | 'refund' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface GiftCardRepository {
  getById(id: string): Promise<GiftCard | null>;
  getByCode(code: string): Promise<GiftCard | null>;
  create(data: Omit<GiftCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<GiftCard>;
  update(id: string, data: Partial<GiftCard>): Promise<GiftCard>;
  delete(id: string): Promise<void>;
  getByPurchaser(purchaserId: string): Promise<GiftCard[]>;
  getByRecipient(recipientEmail: string): Promise<GiftCard[]>;
  getExpiring(beforeDate: string): Promise<GiftCard[]>;
  
  logTransaction(data: Omit<GiftCardTransaction, 'id' | 'createdAt'>): Promise<GiftCardTransaction>;
  getTransactions(giftCardId: string): Promise<GiftCardTransaction[]>;
}

// ============================================
// MEMBERSHIP TYPES
// ============================================

export type MembershipTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type MembershipStatus = 'active' | 'expired' | 'suspended' | 'cancelled' | 'pending';

export interface MembershipPlan {
  id: string;
  name: string;
  tier: MembershipTier;
  description: string;
  price: number;
  currency: string;
  durationMonths: number;
  benefits: string[];
  discountPercentage: number;
  guestPasses: number;
  maxFamilyMembers: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  tier: MembershipTier;
  status: MembershipStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  guestPassesRemaining: number;
  familyMembers: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface MembershipPayment {
  id: string;
  membershipId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  paidAt: string | null;
  createdAt: string;
}

export interface MembershipRepository {
  // Plans
  getPlan(id: string): Promise<MembershipPlan | null>;
  getPlans(): Promise<MembershipPlan[]>;
  getActivePlans(): Promise<MembershipPlan[]>;
  createPlan(data: Omit<MembershipPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<MembershipPlan>;
  updatePlan(id: string, data: Partial<MembershipPlan>): Promise<MembershipPlan>;
  deletePlan(id: string): Promise<void>;
  
  // Memberships
  getMembership(id: string): Promise<Membership | null>;
  getMembershipByMember(memberId: string): Promise<Membership | null>;
  createMembership(data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>): Promise<Membership>;
  updateMembership(id: string, data: Partial<Membership>): Promise<Membership>;
  getExpiring(beforeDate: string): Promise<Membership[]>;
  getByStatus(status: MembershipStatus): Promise<Membership[]>;
  
  // Payments
  logPayment(data: Omit<MembershipPayment, 'id' | 'createdAt'>): Promise<MembershipPayment>;
  getPayments(membershipId: string): Promise<MembershipPayment[]>;
}

// ============================================
// PROMOTION TYPES
// ============================================

export type PromotionType = 'percentage' | 'fixed' | 'bogo' | 'bundle' | 'flash_sale';
export type PromotionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'cancelled';

export interface Promotion {
  id: string;
  name: string;
  code: string;
  type: PromotionType;
  value: number;
  description: string;
  status: PromotionStatus;
  startDate: string;
  endDate: string;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  perUserLimit?: number;
  applicableTo: string[];
  excludedItems: string[];
  isStackable: boolean;
  priority: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface PromotionUsage {
  id: string;
  promotionId: string;
  userId: string;
  orderId?: string;
  discountAmount: number;
  usedAt: string;
}

export interface PromotionRepository {
  getById(id: string): Promise<Promotion | null>;
  getByCode(code: string): Promise<Promotion | null>;
  getAll(): Promise<Promotion[]>;
  getActive(): Promise<Promotion[]>;
  create(data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<Promotion>;
  update(id: string, data: Partial<Promotion>): Promise<Promotion>;
  delete(id: string): Promise<void>;
  getByStatus(status: PromotionStatus): Promise<Promotion[]>;
  
  logUsage(data: Omit<PromotionUsage, 'id' | 'usedAt'>): Promise<PromotionUsage>;
  getUsage(promotionId: string): Promise<PromotionUsage[]>;
  getUserUsage(promotionId: string, userId: string): Promise<PromotionUsage[]>;
}

// ==================== RESERVATION ====================

export type ReservationType = 'room' | 'restaurant' | 'spa' | 'activity' | 'event' | 'pool' | 'cabana';

export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  type: ReservationType;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  resourceId: string;
  resourceName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  status: ReservationStatus;
  specialRequests?: string;
  notes?: string;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  confirmationCode: string;
  bookedBy: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  checkedInAt?: string;
  checkedInBy?: string;
  checkedOutAt?: string;
  checkedOutBy?: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ReservationConflict {
  reservationId: string;
  resourceId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
}

export interface ReservationRepository {
  getById(id: string): Promise<Reservation | null>;
  getByConfirmationCode(code: string): Promise<Reservation | null>;
  getAll(): Promise<Reservation[]>;
  getByGuestId(guestId: string): Promise<Reservation[]>;
  getByResourceId(resourceId: string): Promise<Reservation[]>;
  getByStatus(status: ReservationStatus): Promise<Reservation[]>;
  getByType(type: ReservationType): Promise<Reservation[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Reservation[]>;
  create(data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reservation>;
  update(id: string, data: Partial<Reservation>): Promise<Reservation>;
  delete(id: string): Promise<void>;
  findConflicts(resourceId: string, checkIn: string, checkOut: string, excludeId?: string): Promise<Reservation[]>;
}

// ==================== INVOICE ====================

export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded';

export type InvoicePaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'room_charge' | 'gift_card' | 'other';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  reservationId?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
  dueDate: string;
  issueDate: string;
  paidDate?: string;
  notes?: string;
  currency: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: InvoicePaymentMethod;
  reference?: string;
  processedBy: string;
  processedAt: string;
}

export interface InvoiceRepository {
  getById(id: string): Promise<Invoice | null>;
  getByInvoiceNumber(number: string): Promise<Invoice | null>;
  getAll(): Promise<Invoice[]>;
  getByGuestId(guestId: string): Promise<Invoice[]>;
  getByStatus(status: InvoiceStatus): Promise<Invoice[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Invoice[]>;
  getOverdue(): Promise<Invoice[]>;
  create(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice>;
  update(id: string, data: Partial<Invoice>): Promise<Invoice>;
  delete(id: string): Promise<void>;
  
  addPayment(data: Omit<InvoicePayment, 'id' | 'processedAt'>): Promise<InvoicePayment>;
  getPayments(invoiceId: string): Promise<InvoicePayment[]>;
}

// ==================== BOOKING ====================

export type BookingSource = 'direct' | 'website' | 'phone' | 'email' | 'agent' | 'ota' | 'walk_in';

export type BookingStatus = 'inquiry' | 'quote_sent' | 'pending_payment' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface BookingItem {
  id: string;
  type: string;
  resourceId: string;
  resourceName: string;
  startDate: string;
  endDate: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  source: BookingSource;
  status: BookingStatus;
  items: BookingItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  depositRequired: number;
  depositPaid: number;
  balanceDue: number;
  specialRequests?: string;
  internalNotes?: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  promoCode?: string;
  agentId?: string;
  createdBy: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface BookingRepository {
  getById(id: string): Promise<Booking | null>;
  getByBookingNumber(number: string): Promise<Booking | null>;
  getAll(): Promise<Booking[]>;
  getByGuestId(guestId: string): Promise<Booking[]>;
  getByStatus(status: BookingStatus): Promise<Booking[]>;
  getBySource(source: BookingSource): Promise<Booking[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Booking[]>;
  create(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<Booking>;
  update(id: string, data: Partial<Booking>): Promise<Booking>;
  delete(id: string): Promise<void>;
}

// ==================== AMENITY ====================

export type AmenityCategory = 'pool' | 'spa' | 'fitness' | 'dining' | 'entertainment' | 'sports' | 'recreation' | 'business' | 'kids' | 'other';

export type AmenityStatus = 'available' | 'maintenance' | 'closed' | 'reserved';

export interface Amenity {
  id: string;
  name: string;
  description: string;
  category: AmenityCategory;
  status: AmenityStatus;
  location: string;
  capacity?: number;
  openingTime: string;
  closingTime: string;
  requiresReservation: boolean;
  pricePerHour?: number;
  isComplimentary: boolean;
  images: string[];
  rules: string[];
  ageRestriction?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface AmenitySchedule {
  id: string;
  amenityId: string;
  dayOfWeek: number;
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
}

export interface AmenityReservation {
  id: string;
  amenityId: string;
  guestId: string;
  guestName: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes?: string;
  createdAt: string;
}

export interface AmenityRepository {
  getById(id: string): Promise<Amenity | null>;
  getAll(): Promise<Amenity[]>;
  getByCategory(category: AmenityCategory): Promise<Amenity[]>;
  getByStatus(status: AmenityStatus): Promise<Amenity[]>;
  getActive(): Promise<Amenity[]>;
  create(data: Omit<Amenity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Amenity>;
  update(id: string, data: Partial<Amenity>): Promise<Amenity>;
  delete(id: string): Promise<void>;
  
  getSchedule(amenityId: string): Promise<AmenitySchedule[]>;
  setSchedule(amenityId: string, schedule: Omit<AmenitySchedule, 'id'>[]): Promise<AmenitySchedule[]>;
  
  createReservation(data: Omit<AmenityReservation, 'id' | 'createdAt'>): Promise<AmenityReservation>;
  getReservation(id: string): Promise<AmenityReservation | null>;
  getReservationsByAmenity(amenityId: string, date: string): Promise<AmenityReservation[]>;
  getReservationsByGuest(guestId: string): Promise<AmenityReservation[]>;
  updateReservation(id: string, data: Partial<AmenityReservation>): Promise<AmenityReservation>;
  cancelReservation(id: string): Promise<void>;
}

export interface Container {
  // Database
  database: DatabaseClient;
  
  // Repositories
  poolRepository: PoolRepository;
  authRepository: AuthRepository;
  restaurantRepository: RestaurantRepository;
  menuRepository: MenuRepository;
  chaletRepository: ChaletRepository;
  reviewRepository: ReviewRepository;
  snackRepository: SnackRepository;
  supportRepository: SupportRepository;
  userRepository: UserRepository;
  settingsRepository: SettingsRepository;
  auditRepository: AuditRepository;
  notificationRepository: NotificationRepository;
  paymentRepository: PaymentRepository;
  reportingRepository: ReportingRepository;
  inventoryRepository: InventoryRepository;
  couponRepository: CouponRepository;
  loyaltyRepository: LoyaltyRepository;
  waitlistRepository: WaitlistRepository;
  shiftRepository: ShiftRepository;
  taskRepository: TaskRepository;
  guestRepository: GuestRepository;
  rateRepository: RateRepository;
  eventRepository: EventRepository;
  maintenanceRepository: MaintenanceRepository;
  housekeepingRepository: HousekeepingRepository;
  channelRepository: ChannelRepository;
  feedbackRepository: FeedbackRepository;
  packageRepository: PackageRepository;
  documentRepository: DocumentRepository;
  analyticsRepository: AnalyticsRepository;
  weatherRepository: WeatherRepository;
  currencyRepository: CurrencyRepository;
  giftCardRepository: GiftCardRepository;
  membershipRepository: MembershipRepository;
  promotionRepository: PromotionRepository;
  reservationRepository: ReservationRepository;
  invoiceRepository: InvoiceRepository;
  bookingRepository: BookingRepository;
  amenityRepository: AmenityRepository;
  
  // Services
  emailService: EmailService;
  qrCodeService: QRCodeService;
  notificationService: () => ReturnType<typeof import('../services/notification.service').createNotificationService>;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
  
  // Config
  config: AppConfig;
}

// Factory function type for creating containers
export type ContainerFactory = (overrides?: Partial<Container>) => Container;
