import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']);
export const priceTypeEnum = pgEnum('price_type', ['per_night', 'one_time']);

// ============================================
// Chalets
// ============================================
export const chalets = pgTable('chalets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  nameAr: varchar('name_ar', { length: 100 }),
  nameFr: varchar('name_fr', { length: 100 }),
  description: text('description'),
  descriptionAr: text('description_ar'),
  descriptionFr: text('description_fr'),
  capacity: integer('capacity').notNull(),
  bedroomCount: integer('bedroom_count').notNull(),
  bathroomCount: integer('bathroom_count').notNull(),
  amenities: text('amenities').array(),
  images: text('images').array(),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  weekendPrice: decimal('weekend_price', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true),
  cleanState: varchar('clean_state', { length: 30 }).default('clean'),
  cleaningStatus: varchar('cleaning_status', { length: 30 }).default('clean'),
  isBlocked: boolean('is_blocked').default(false),
  blockReason: text('block_reason'),
  blockedUntil: timestamp('blocked_until'),
  lastCleanedAt: timestamp('last_cleaned_at'),
  lastInspectedAt: timestamp('last_inspected_at'),
  maintenanceNotes: text('maintenance_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================
// Chalet Add-Ons
// ============================================
export const chaletAddOns = pgTable('chalet_add_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  nameAr: varchar('name_ar', { length: 100 }),
  nameFr: varchar('name_fr', { length: 100 }),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  priceType: priceTypeEnum('price_type').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// Chalet Price Rules
// ============================================
export const chaletPriceRules = pgTable('chalet_price_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  chaletId: uuid('chalet_id').references(() => chalets.id),
  name: varchar('name', { length: 100 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  priceMultiplier: decimal('price_multiplier', { precision: 5, scale: 2 }).notNull(),
  priority: integer('priority').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// Chalet Bookings
// ============================================
export const chaletBookings = pgTable('chalet_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingNumber: varchar('booking_number', { length: 20 }).notNull().unique(),
  chaletId: uuid('chalet_id').references(() => chalets.id).notNull(),
  customerId: uuid('customer_id').references(() => users.id),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 20 }).notNull(),
  checkInDate: timestamp('check_in_date').notNull(),
  checkOutDate: timestamp('check_out_date').notNull(),
  numberOfGuests: integer('number_of_guests').notNull(),
  numberOfNights: integer('number_of_nights').notNull(),
  baseAmount: decimal('base_amount', { precision: 10, scale: 2 }).notNull(),
  addOnsAmount: decimal('add_ons_amount', { precision: 10, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: bookingStatusEnum('status').default('pending').notNull(),
  paymentStatus: varchar('payment_status', { length: 20 }).default('pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }),
  specialRequests: text('special_requests'),
  housekeepingStatus: varchar('housekeeping_status', { length: 30 }).default('pending'),
  checkedInAt: timestamp('checked_in_at'),
  checkedOutAt: timestamp('checked_out_at'),
  checkedInBy: uuid('checked_in_by').references(() => users.id),
  checkedOutBy: uuid('checked_out_by').references(() => users.id),
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================
// Chalet Booking Add-Ons
// ============================================
export const chaletBookingAddOns = pgTable('chalet_booking_add_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').references(() => chaletBookings.id).notNull(),
  addOnId: uuid('add_on_id').references(() => chaletAddOns.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
