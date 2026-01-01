// ============================================
// V2 Resort - Shared TypeScript Types
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
  businessUnit?: BusinessUnit;
}

export type BusinessUnit = 'restaurant' | 'snack_bar' | 'chalets' | 'pool' | 'admin';

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

// ----- Restaurant -----
export interface MenuCategory extends BaseEntity {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  imageUrl?: string;
}

export interface MenuItem extends BaseEntity {
  categoryId: UUID;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  price: number;
  preparationTimeMinutes?: number;
  calories?: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  allergens: string[];
  imageUrl?: string;
  isAvailable: boolean;
  isFeatured: boolean;
  displayOrder: number;
}

export interface RestaurantTable extends BaseEntity {
  tableNumber: string;
  capacity: number;
  location: string;
  qrCode?: string;
  isActive: boolean;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'whish' | 'online';

export interface RestaurantOrder extends BaseEntity {
  orderNumber: string;
  customerId?: UUID;
  customerName: string;
  customerPhone?: string;
  tableId?: UUID;
  orderType: OrderType;
  status: OrderStatus;
  subtotal: number;
  taxAmount: number;
  serviceCharge?: number;
  deliveryFee?: number;
  discountAmount: number;
  totalAmount: number;
  specialInstructions?: string;
  estimatedReadyTime?: Date;
  actualReadyTime?: Date;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  assignedToStaff?: UUID;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface RestaurantOrderItem extends BaseEntity {
  orderId: UUID;
  menuItemId: UUID;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  specialInstructions?: string;
  status?: OrderStatus;
}

// ----- Snack Bar -----
export interface SnackItem extends BaseEntity {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  price: number;
  category: 'sandwich' | 'drink' | 'snack' | 'ice_cream';
  imageUrl?: string;
  isAvailable: boolean;
  displayOrder: number;
}

export type SnackOrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface SnackOrder extends BaseEntity {
  orderNumber: string;
  customerId?: UUID;
  customerName?: string;
  customerPhone?: string;
  status: SnackOrderStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  specialInstructions?: string;
  estimatedReadyTime?: Date;
  completedAt?: Date;
}

export interface SnackOrderItem extends BaseEntity {
  orderId: UUID;
  snackItemId: UUID;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// ----- Chalets -----
export interface Chalet extends BaseEntity {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  capacity: number;
  bedroomCount: number;
  bathroomCount: number;
  amenities: string[];
  images: string[];
  basePrice: number;
  weekendPrice: number;
  isActive: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface ChaletBooking extends BaseEntity {
  bookingNumber: string;
  chaletId: UUID;
  customerId?: UUID;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  checkInDate: Date;
  checkOutDate: Date;
  numberOfGuests: number;
  numberOfNights: number;
  baseAmount: number;
  addOnsAmount: number;
  discountAmount: number;
  depositAmount: number;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  specialRequests?: string;
  checkedInAt?: Date;
  checkedOutAt?: Date;
  checkedInBy?: UUID;
  checkedOutBy?: UUID;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface ChaletAddOn extends BaseEntity {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  price: number;
  priceType: 'per_night' | 'one_time';
  isActive: boolean;
}

export interface ChaletBookingAddOn {
  bookingId: UUID;
  addOnId: UUID;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ChaletPriceRule extends BaseEntity {
  chaletId?: UUID; // null = applies to all
  name: string;
  startDate: Date;
  endDate: Date;
  priceMultiplier: number;
  priority: number;
  isActive: boolean;
}

// ----- Pool -----
export interface PoolSession extends BaseEntity {
  name: string;
  startTime: string; // HH:mm format
  endTime: string;
  maxCapacity: number;
  price: number;
  isActive: boolean;
}

export type PoolTicketStatus = 'valid' | 'used' | 'expired' | 'cancelled';

export interface PoolTicket extends BaseEntity {
  ticketNumber: string;
  sessionId: UUID;
  customerId?: UUID;
  customerName: string;
  customerPhone?: string;
  ticketDate: Date;
  numberOfGuests: number;
  totalAmount: number;
  status: PoolTicketStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  qrCode: string;
  validatedAt?: Date;
  validatedBy?: UUID;
}

// ----- Payments -----
export interface Payment extends BaseEntity {
  referenceType: 'restaurant_order' | 'snack_order' | 'chalet_booking' | 'pool_ticket';
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
