import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const ticketStatusEnum = pgEnum('ticket_status', ['valid', 'used', 'expired', 'cancelled']);
export const poolGenderRestrictionEnum = pgEnum('pool_gender_restriction', ['mixed', 'male', 'female']);

// ============================================
// Pool Sessions
// ============================================
export const poolSessions = pgTable('pool_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  maxCapacity: integer('max_capacity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  genderRestriction: poolGenderRestrictionEnum('gender_restriction').default('mixed'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// Pool Tickets
// ============================================
export const poolTickets = pgTable('pool_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNumber: varchar('ticket_number', { length: 20 }).notNull().unique(),
  sessionId: uuid('session_id').references(() => poolSessions.id).notNull(),
  customerId: uuid('customer_id').references(() => users.id),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 20 }),
  ticketDate: timestamp('ticket_date').notNull(),
  numberOfGuests: integer('number_of_guests').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: ticketStatusEnum('status').default('valid').notNull(),
  paymentStatus: varchar('payment_status', { length: 20 }).default('pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }),
  qrCode: text('qr_code').notNull(),
  validatedAt: timestamp('validated_at'),
  validatedBy: uuid('validated_by').references(() => users.id),
  braceletNumber: varchar('bracelet_number', { length: 50 }),
  braceletColor: varchar('bracelet_color', { length: 30 }),
  braceletAssignedAt: timestamp('bracelet_assigned_at'),
  braceletAssignedBy: uuid('bracelet_assigned_by').references(() => users.id),
  braceletReturnedAt: timestamp('bracelet_returned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================
// Pool Memberships
// ============================================
export const poolMemberships = pgTable('pool_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(),
  status: varchar('status', { length: 50 }).default('PENDING_PAYMENT').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  corporateName: varchar('corporate_name', { length: 255 }),
  maxMembers: integer('max_members').default(1).notNull(),
  remainingGuestPasses: integer('remaining_guest_passes').default(0).notNull(),
  discountPercentage: integer('discount_percentage').default(0).notNull(),
  autoRenew: boolean('auto_renew').default(true),
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  renewedAt: timestamp('renewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Membership Members
// ============================================
export const membershipMembers = pgTable('membership_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  membershipId: uuid('membership_id').references(() => poolMemberships.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('PENDING_INVITATION').notNull(),
  invitedAt: timestamp('invited_at').defaultNow(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Guest Pass Usage
// ============================================
export const guestPassUsage = pgTable('guest_pass_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  membershipId: uuid('membership_id').references(() => poolMemberships.id).notNull(),
  guestName: varchar('guest_name', { length: 255 }).notNull(),
  guestEmail: varchar('guest_email', { length: 255 }),
  usedAt: timestamp('used_at').defaultNow(),
  poolTicketId: uuid('pool_ticket_id').references(() => poolTickets.id),
});

// ============================================
// Pool Daily Capacity
// ============================================
export const poolDailyCapacity = pgTable('pool_daily_capacity', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: timestamp('date').notNull().unique(),
  maxCapacity: integer('max_capacity').default(100).notNull(),
  currentCount: integer('current_count').default(0).notNull(),
  reservedMemberSlots: integer('reserved_member_slots').default(20).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
