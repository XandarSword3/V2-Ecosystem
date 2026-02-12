import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const reviewStatusEnum = pgEnum('review_status', [
  'pending', 'approved', 'rejected', 'flagged',
]);

// ============================================
// Reviews (generic / multi-module)
// ============================================
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  moduleId: varchar('module_id', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: uuid('target_id').notNull(),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 255 }),
  comment: text('comment'),
  status: varchar('status', { length: 20 }).default('pending'),
  isFeatured: boolean('is_featured').default(false),
  isVerifiedPurchase: boolean('is_verified_purchase').default(false),
  adminResponse: text('admin_response'),
  adminRespondedAt: timestamp('admin_responded_at'),
  adminRespondedBy: uuid('admin_responded_by').references(() => users.id),
  helpfulCount: integer('helpful_count').default(0),
  reportCount: integer('report_count').default(0),
  photos: jsonb('photos').default('[]'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Product Reviews (restaurant / snack menu items)
// ============================================
export const productReviews = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  productId: uuid('product_id').notNull(),
  productType: varchar('product_type', { length: 50 }).default('menu_item'),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 255 }),
  comment: text('comment'),
  tasteRating: integer('taste_rating'),
  presentationRating: integer('presentation_rating'),
  valueRating: integer('value_rating'),
  photos: jsonb('photos').default('[]'),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Booking Reviews (chalets / rooms)
// ============================================
export const bookingReviews = pgTable('booking_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  bookingId: uuid('booking_id').notNull(),
  bookingType: varchar('booking_type', { length: 50 }).default('chalet'),
  overallRating: integer('overall_rating').notNull(),
  cleanlinessRating: integer('cleanliness_rating'),
  comfortRating: integer('comfort_rating'),
  locationRating: integer('location_rating'),
  serviceRating: integer('service_rating'),
  valueRating: integer('value_rating'),
  title: varchar('title', { length: 255 }),
  comment: text('comment'),
  photos: jsonb('photos').default('[]'),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Session Reviews (pool / spa / activities)
// ============================================
export const sessionReviews = pgTable('session_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionId: uuid('session_id').notNull(),
  sessionType: varchar('session_type', { length: 50 }).default('pool'),
  rating: integer('rating').notNull(),
  facilityRating: integer('facility_rating'),
  staffRating: integer('staff_rating'),
  cleanlinessRating: integer('cleanliness_rating'),
  comment: text('comment'),
  photos: jsonb('photos').default('[]'),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
