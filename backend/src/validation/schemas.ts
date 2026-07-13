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
  .max(20, 'Phone number must be 20 characters or less')
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

// ============ TRANSACTION SCHEMAS ============

// Schema for gift card redemption
export const giftCardRedemptionSchema = z.object({
  giftCardId: uuidSchema,
  amount: z.number().positive().max(100000, 'Amount exceeds maximum allowed'),
});

// Schema for transaction operations
const transactionItemSchema = z.object({
  referenceId: uuidSchema,
  quantity: z.number().int().min(1).max(50).optional(),
  notes: sanitizedString(500).optional(),
});

export const createTransactionSchema = z.object({
  engineType: z.enum(['instant_transaction', 'shared_capacity_access', 'time_exclusive_reservation', 'ongoing_entitlement']),
  customerName: nameSchema.optional(),
  customerPhone: phoneSchema.optional(),
  items: z.array(transactionItemSchema).min(1, 'Transaction must have at least one item'),
  specialInstructions: sanitizedString(500).optional(),
  paymentMethod: z.enum(['cash', 'card', 'online']).optional(),
  // Discount integration fields (validated, not raw)
  couponCode: z.string().max(50).optional(),
  giftCardRedemptions: z.array(giftCardRedemptionSchema).max(5).optional(),
  loyaltyPointsToRedeem: z.number().int().min(0).max(1000000).optional(),
  loyaltyPointsDollarValue: z.number().min(0).max(100000).optional(),
});

export const updateTransactionStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'delivered', 'completed', 'cancelled']),
  notes: sanitizedString(500).optional(),
});

// ============ PAYMENT SCHEMAS ============

export const createPaymentIntentSchema = z.object({
  amount: z.number().positive().max(100000, 'Amount exceeds maximum allowed'),
  currency: z.enum(['usd', 'lbp', 'eur']).default('usd'),
  referenceType: z.enum(['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement']),
  referenceId: uuidSchema,
});

export const recordCashPaymentSchema = z.object({
  referenceType: z.enum(['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement']),
  referenceId: uuidSchema,
  amount: z.number().positive().max(100000),
  notes: sanitizedString(500).optional(),
});

export const recordManualPaymentSchema = z.object({
  referenceType: z.enum(['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement']),
  referenceId: uuidSchema,
  amount: z.number().positive().max(100000),
  method: z.enum(['cash', 'whish', 'omt', 'other_transfer']),
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
    'staff', 'manager'
  ])).min(1, 'At least one role is required').default(['customer']),
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  full_name: nameSchema.optional(),
  phone: phoneSchema,
  roles: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export const adminUpdateUserSchema = z.object({
  fullName: nameSchema.optional(),
  phone: phoneSchema,
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  preferredLanguage: z.enum(['en', 'ar', 'fr']).optional(),
});

export const assignUserRolesSchema = z.object({
  roleIds: z.array(uuidSchema).optional(),
  roles: z.array(z.string()).optional(),
}).transform(data => {
  // Ensure at least one array exists and has values
  if ((!data.roleIds || data.roleIds.length === 0) && (!data.roles || data.roles.length === 0)) {
    // Allow empty roles to remove all roles from user
    return { roleIds: data.roleIds || [], roles: data.roles || [] };
  }
  return data;
});

// New scope-based assignment schema (replaces role-based assignment)
export const assignUserScopeSchema = z.object({
  scope: z.enum(['super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'property_manager', 'property_staff', 'customer']),
});

// Updated createUserSchema to accept scope instead of roles
export const createUserSchemaWithScope = z.object({
  email: emailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less'),
  fullName: nameSchema,
  phone: phoneSchema,
  scope: z.enum(['super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'property_manager', 'property_staff', 'customer']).optional(),
});

export const createRoleSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z_]+$/, 'Role name must be lowercase with underscores only'),
  displayName: z.string().min(2).max(100),
  description: sanitizedString(500).optional(),
  // Free-form string so roles can be associated with any dynamic module slug.
  // The legacy enum locked role creation to the original four module slugs,
  // blocking role creation for any module created after the legacy era.
  businessUnit: z.string().max(100).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z_]+$/, 'Role name must be lowercase with underscores only').optional(),
  displayName: z.string().min(2).max(100).optional(),
  description: sanitizedString(500).optional(),
});

export const createPermissionSchema = z.object({
  name: z.string().min(2).max(100),
  resource: z.string().min(2).max(50).optional(),
  action: z.enum(['create', 'read', 'update', 'delete', 'manage', 'view', 'export']).optional(),
  description: sanitizedString(500).optional(),
});

export const assignRolePermissionsSchema = z.object({
  permissionSlugs: z.array(z.string().min(1)),
});

// ============ REVIEW SCHEMAS ============

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: sanitizedString(2000),
  reviewType: z.enum(['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement', 'general']).optional(),
  referenceId: uuidSchema.optional(),
});

export const updateReviewStatusSchema = z.object({
  is_approved: z.boolean(),
  admin_response: sanitizedString(1000).optional(),
});

// ============ MODULE SCHEMAS ============

export const createModuleSchema = z.object({
  // engine_type must be a real engine type — no alias names.
  // platform_entitlement is excluded: it is SaaS billing between operators and
  // V2, not a module type that tenants can create.
  engine_type: z.enum(['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement']),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only').optional(),
  description: sanitizedString(500).optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

export const updateModuleSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: sanitizedString(500).optional(),
  is_active: z.boolean().optional(),
  show_in_main: z.boolean().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  sort_order: z.number().int().min(0).optional(),
  // For optimistic locking
  settings_version: z.number().int().positive().optional(), 
});

// ============ UTILITY FUNCTIONS ============

/**
 * Validate request body against a schema
 * Returns validated data or throws formatted error
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
    const error = new Error(`Validation failed: ${errors.join(', ')}`);
    (error as any).statusCode = 400;
    (error as any).errors = result.error.issues;
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
