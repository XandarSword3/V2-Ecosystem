/**
 * Frontend Type Definitions
 * 
 * Common types used across the frontend for type safety
 */

// Re-export shared types
export * from './module-builder';

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
// User & Auth Types
// ============================================

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  profileImageUrl?: string;
  preferredLanguage: 'en' | 'ar' | 'fr';
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================
// Order Types
// ============================================

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'whish' | 'online';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'room_service';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  order_number?: string;
  customerName: string;
  customer_name?: string;
  customerPhone?: string;
  customer_phone?: string;
  orderType: OrderType;
  order_type?: string;
  status: OrderStatus;
  tableNumber?: string;
  table_number?: string;
  totalAmount: number;
  total_amount?: string;
  createdAt: string;
  created_at?: string;
  estimatedReadyTime?: string;
  estimated_ready_time?: string;
  items: OrderItem[];
}

export interface SocketOrderUpdate {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
}

export interface SocketNewOrder {
  orderId: string;
  orderNumber: string;
}

// ============================================
// Menu Types
// ============================================

export interface MenuCategory {
  id: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  displayOrder: number;
  display_order?: number;
  isActive: boolean;
  is_active?: boolean;
  imageUrl?: string;
  image_url?: string;
  moduleId?: string;
  module_id?: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  category_id?: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  description_ar?: string;
  description_fr?: string;
  price: number;
  isAvailable: boolean;
  is_available?: boolean;
  isFeatured?: boolean;
  is_featured?: boolean;
  imageUrl?: string;
  image_url?: string;
  displayOrder: number;
  display_order?: number;
  preparationTimeMinutes?: number;
  preparation_time_minutes?: number;
  moduleId?: string;
  module_id?: string;
  isSpicy?: boolean;
  spicyLevel?: number;
  discount?: number;
}

// ============================================
// Pool Types
// ============================================

export type TicketStatus = 'pending' | 'valid' | 'used' | 'expired' | 'cancelled';

export interface PoolSession {
  id: string;
  name: string;
  startTime: string;
  start_time?: string;
  endTime: string;
  end_time?: string;
  maxCapacity: number;
  max_capacity?: number;
  price: number;
  adultPrice?: number;
  adult_price?: number;
  childPrice?: number;
  child_price?: number;
  isActive: boolean;
  is_active?: boolean;
}

export interface PoolTicket {
  id: string;
  ticketNumber: string;
  ticket_number?: string;
  sessionId: string;
  session_id?: string;
  customerId?: string;
  customer_id?: string;
  customerName: string;
  customer_name?: string;
  customerPhone?: string;
  customer_phone?: string;
  ticketDate: string;
  ticket_date?: string;
  numberOfGuests: number;
  number_of_guests?: number;
  totalAmount: number;
  total_amount?: string;
  status: TicketStatus;
  paymentStatus: PaymentStatus;
  payment_status?: string;
  qrCode: string;
  qr_code?: string;
}

// ============================================
// Chalet Types
// ============================================

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface Chalet {
  id: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  capacity: number;
  bedroomCount: number;
  bedroom_count?: number;
  bathroomCount: number;
  bathroom_count?: number;
  basePrice: number;
  base_price?: string;
  weekendPrice?: number;
  weekend_price?: string;
  isActive: boolean;
  is_active?: boolean;
  images?: string[];
  amenities?: string[];
}

export interface ChaletBooking {
  id: string;
  bookingNumber: string;
  booking_number?: string;
  chaletId: string;
  chalet_id?: string;
  customerName: string;
  customer_name?: string;
  customerEmail: string;
  customer_email?: string;
  customerPhone: string;
  customer_phone?: string;
  checkInDate: string;
  check_in_date?: string;
  checkOutDate: string;
  check_out_date?: string;
  numberOfGuests: number;
  number_of_guests?: number;
  numberOfNights: number;
  number_of_nights?: number;
  totalAmount: number;
  total_amount?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  payment_status?: string;
}

// ============================================
// Module Types
// ============================================

export type ModuleTemplateType = 
  | 'menu_service' 
  | 'multi_day_booking' 
  | 'session_access'
  | 'appointment_booking'
  | 'membership_access'
  | 'class_scheduling';

export interface Module {
  id: string;
  templateType: ModuleTemplateType;
  template_type?: ModuleTemplateType;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  is_active?: boolean;
  showInMain?: boolean;
  show_in_main?: boolean;
  settings?: Record<string, unknown>;
  sortOrder: number;
  sort_order?: number;
}

// ============================================
// Navigation Types
// ============================================

export interface NavLink {
  label: string;
  href: string;
  icon?: string;
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export interface SocialLink {
  platform: string;
  url: string;
  icon?: string;
}

export interface FooterConfig {
  socials: SocialLink[];
  columns: FooterColumn[];
  copyright?: string;
}

// ============================================
// Review Types
// ============================================

export interface Review {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  customer_name?: string;
  createdAt: string;
  created_at?: string;
  isApproved: boolean;
  is_approved?: boolean;
  adminResponse?: string;
  admin_response?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  image: string;
}

// ============================================
// Cart Types
// ============================================

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string;
}

// ============================================
// Error Types
// ============================================

/** API Error type for Axios errors with response data */
export interface ApiError {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
    status?: number;
  };
  message?: string;
}

/** Type guard for API error with response */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  );
}

/** Extract API error message from error object */
export function getApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (isApiError(error)) {
    return error.response?.data?.error || error.response?.data?.message || error.message || fallback;
  }
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return fallback;
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

/** Extract error message from unknown error */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

// Icon component type for Lucide icons
export type IconComponent = React.ComponentType<{ className?: string; size?: number }>;

// Status configuration type
export interface StatusConfig {
  color: string;
  icon: IconComponent;
  label?: string;
}
