/**
 * Common Validation Schemas
 * 
 * Provides reusable Zod schemas for input validation across the application.
 * These schemas protect against:
 * - SQL injection (via type validation)
 * - XSS attacks (via sanitization transforms)
 * - Type coercion errors
 * - Invalid data formats
 */

import { z } from 'zod';

// ============ COMMON PATTERNS ============

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Phone number validation (international format)
 */
export const phoneSchema = z.string()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number format')
  .optional()
  .nullable();

/**
 * Sanitized string that strips HTML tags to prevent XSS
 */
export function sanitizedString(maxLength: number = 255) {
  return z.string()
    .max(maxLength, `Text must be ${maxLength} characters or less`)
    .transform(s => s.replace(/<[^>]*>/g, '').trim());
}

/**
 * Safe name field (letters, spaces, hyphens, apostrophes only)
 */
export const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be 100 characters or less')
  .regex(/^[\p{L}\s'-]+$/u, 'Name contains invalid characters')
  .transform(s => s.replace(/<[^>]*>/g, '').trim());

/**
 * Email validation
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must be 255 characters or less')
  .toLowerCase()
  .trim();

/**
 * Date string validation (ISO format)
 */
export const dateSchema = z.string()
  .refine((d) => !isNaN(Date.parse(d)), 'Invalid date format');

/**
 * Positive number validation
 */
export const positiveNumberSchema = z.number()
  .positive('Value must be positive')
  .finite('Value must be a valid number');

/**
 * Positive integer validation
 */
export const positiveIntSchema = z.number()
  .int('Value must be a whole number')
  .positive('Value must be positive');

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============ CHALET BOOKING SCHEMAS ============

export const createChaletBookingSchema = z.object({
  chaletId: uuidSchema,
  customerName: nameSchema,
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  checkInDate: dateSchema,
  checkOutDate: dateSchema,
  numberOfGuests: z.number().int().min(1).max(20, 'Maximum 20 guests allowed'),
  addOns: z.array(z.object({
    addOnId: uuidSchema,
    quantity: z.number().int().min(1).max(10),
  })).optional(),
  specialRequests: sanitizedString(1000).optional(),
  paymentMethod: z.enum(['cash', 'card', 'online']),
}).refine((data) => {
  const checkIn = new Date(data.checkInDate);
  const checkOut = new Date(data.checkOutDate);
  return checkOut > checkIn;
}, { message: 'Check-out date must be after check-in date' });

export const updateChaletBookingSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']).optional(),
  numberOfGuests: z.number().int().min(1).max(20).optional(),
  specialRequests: sanitizedString(1000).optional(),
  checkInDate: dateSchema.optional(),
  checkOutDate: dateSchema.optional(),
});

// ============ POOL TICKET SCHEMAS ============

export const purchasePoolTicketSchema = z.object({
  sessionId: uuidSchema,
  ticketDate: dateSchema,
  customerName: nameSchema,
  customerEmail: emailSchema.optional(),
  customerPhone: phoneSchema,
  numberOfGuests: z.number().int().min(1).max(20, 'Maximum 20 guests per ticket'),
  paymentMethod: z.enum(['cash', 'card', 'online']),
});

export const updatePoolTicketSchema = z.object({
  status: z.enum(['pending', 'valid', 'active', 'used', 'expired', 'cancelled']).optional(),
  numberOfGuests: z.number().int().min(1).max(20).optional(),
});

// ============ RESTAURANT ORDER SCHEMAS ============

export const orderItemSchema = z.object({
  menuItemId: uuidSchema,
  quantity: z.number().int().min(1).max(50, 'Maximum 50 of each item'),
  notes: sanitizedString(500).optional(),
  customizations: z.array(z.string().max(100)).optional(),
});

export const createRestaurantOrderSchema = z.object({
  orderType: z.enum(['dine_in', 'takeaway', 'delivery', 'room_service']),
  tableNumber: z.string().max(20).optional(),
  chaletNumber: z.string().max(50).optional(),
  customerName: nameSchema.optional(),
  customerPhone: phoneSchema,
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  specialInstructions: sanitizedString(500).optional(),
  paymentMethod: z.enum(['cash', 'card', 'online', 'room_charge']).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']),
  notes: sanitizedString(500).optional(),
});

// ============ SNACK ORDER SCHEMAS ============

export const snackOrderItemSchema = z.object({
  itemId: uuidSchema,
  quantity: z.number().int().min(1).max(50),
  notes: sanitizedString(200).optional(),
});

export const createSnackOrderSchema = z.object({
  customerName: nameSchema.optional(),
  customerPhone: phoneSchema,
  items: z.array(snackOrderItemSchema).min(1, 'Order must have at least one item'),
  paymentMethod: z.enum(['cash', 'card']),
  notes: sanitizedString(500).optional(),
});

// ============ PAYMENT SCHEMAS ============

export const createPaymentIntentSchema = z.object({
  amount: z.number().positive().max(100000, 'Amount exceeds maximum allowed'),
  currency: z.enum(['usd', 'lbp', 'eur']).default('usd'),
  referenceType: z.enum(['restaurant_order', 'snack_order', 'chalet_booking', 'pool_ticket']),
  referenceId: uuidSchema,
});

export const recordCashPaymentSchema = z.object({
  referenceType: z.enum(['restaurant_order', 'snack_order', 'chalet_booking', 'pool_ticket']),
  referenceId: uuidSchema,
  amount: z.number().positive().max(100000),
  notes: sanitizedString(500).optional(),
});

// ============ ADMIN SCHEMAS ============

export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  full_name: nameSchema,
  phone: phoneSchema,
  roles: z.array(z.enum([
    'customer', 'admin', 'super_admin',
    'restaurant_staff', 'restaurant_admin',
    'chalet_staff', 'chalet_admin',
    'pool_staff', 'pool_admin',
    'snack_bar_staff', 'snack_bar_admin'
  ])).min(1, 'At least one role is required').default(['customer']),
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  full_name: nameSchema.optional(),
  phone: phoneSchema,
  roles: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

// ============ REVIEW SCHEMAS ============

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: sanitizedString(2000),
  reviewType: z.enum(['restaurant', 'pool', 'chalet', 'general']).optional(),
  referenceId: uuidSchema.optional(),
});

export const updateReviewStatusSchema = z.object({
  is_approved: z.boolean(),
  admin_response: sanitizedString(1000).optional(),
});

// ============ MODULE SCHEMAS ============

export const createModuleSchema = z.object({
  template_type: z.enum(['menu_service', 'multi_day_booking', 'session_access', 'appointment_booking', 'membership_access', 'class_scheduling']),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only').optional(),
  description: sanitizedString(500).optional(),
  settings: z.record(z.any()).optional(),
});

export const updateModuleSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: sanitizedString(500).optional(),
  is_active: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ============ UTILITY FUNCTIONS ============

/**
 * Validate request body against a schema
 * Returns validated data or throws formatted error
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    const error = new Error(`Validation failed: ${errors.join(', ')}`);
    (error as any).statusCode = 400;
    (error as any).errors = result.error.errors;
    throw error;
  }
  return result.data;
}

/**
 * Validate query parameters against pagination schema
 */
export function validatePagination(query: unknown) {
  return paginationSchema.parse(query);
}
