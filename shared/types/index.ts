// ============================================
// V2 Ecosystem - Shared TypeScript Types
// ============================================

// ----- Base Types -----
export type UUID = string;

export interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// ----- Users & Auth -----
export interface User extends BaseEntity {
  email: string;
  phone?: string;
  fullName: string;
  profileImageUrl?: string;
  preferredLanguage: 'en' | 'ar' | 'fr';
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  oauthProvider?: 'google' | 'apple';
  oauthProviderId?: string;
}

export interface Role extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  businessUnit?: string;
}

export interface Permission {
  id: UUID;
  name: string;
  description?: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

export interface Session extends BaseEntity {
  userId: UUID;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  lastActivity: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  preferredLanguage?: 'en' | 'ar' | 'fr';
}

// ----- Orders & Payments -----
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'whish' | 'online';

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

// ----- Payments -----
export interface Payment extends BaseEntity {
  referenceType: string;
  referenceId: UUID;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  receiptUrl?: string;
  processedBy?: UUID;
  processedAt?: Date;
  notes?: string;
}

// ----- Notifications -----
export type NotificationType = 'order_status' | 'booking_confirmation' | 'payment_received' | 'reminder' | 'promo';

export interface Notification extends BaseEntity {
  userId: UUID;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  sentVia: ('push' | 'email' | 'sms')[];
}

// ----- API Response Types -----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ----- Domain Module Re-exports -----
export * from './giftcards';
export * from './coupons';
export * from './housekeeping';
export * from './loyalty';
export * from './inventory';
export * from './staff';
export * from './channels';
export * from './reviews';
export * from './gdpr';
export * from './marketing';
export * from './messaging';
export * from './modules';
export * from './property';
export * from './finance';
export * from './engines';
