import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Coupons
// ============================================
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  discountType: varchar('discount_type', { length: 20 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal('min_order_amount', { precision: 10, scale: 2 }).default('0'),
  maxDiscountAmount: decimal('max_discount_amount', { precision: 10, scale: 2 }),
  appliesTo: varchar('applies_to', { length: 50 }).default('all'),
  specificItems: jsonb('specific_items').default('[]'),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0),
  perUserLimit: integer('per_user_limit').default(1),
  stackable: boolean('stackable').default(false),
  stackPriority: integer('stack_priority').default(0),
  firstOrderOnly: boolean('first_order_only').default(false),
  minItems: integer('min_items').default(1),
  eligibleTiers: text('eligible_tiers').array(),
  categoryScope: text('category_scope'),
  serviceScope: text('service_scope').default('all'),
  isActive: boolean('is_active').default(true),
  validFrom: timestamp('valid_from').defaultNow(),
  validUntil: timestamp('valid_until'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Coupon Usage
// ============================================
export const couponUsage = pgTable('coupon_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').references(() => coupons.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  orderId: uuid('order_id'),
  discountApplied: decimal('discount_applied', { precision: 10, scale: 2 }).notNull(),
  ipAddress: text('ip_address'),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
  usedAt: timestamp('used_at').defaultNow(),
});
