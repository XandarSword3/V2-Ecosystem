import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const snackCategoryEnum = pgEnum('snack_category', [
  'drinks', 'snacks', 'ice_cream', 'sandwiches', 'other',
]);

// ============================================
// Snack Items
// ============================================
export const snackItems = pgTable('snack_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: snackCategoryEnum('category').default('other'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  image: text('image'),
  isAvailable: boolean('is_available').default(true),
  displayOrder: integer('display_order').default(0),
  allergens: text('allergens'),
  nutritionalInfo: text('nutritional_info'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Snack Orders
// ============================================
export const snackOrders = pgTable('snack_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  deliveryLocation: varchar('delivery_location', { length: 255 }),
  locationType: varchar('location_type', { length: 50 }),
  locationId: uuid('location_id'),
  notes: text('notes'),
  paidAt: timestamp('paid_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Snack Order Items
// ============================================
export const snackOrderItems = pgTable('snack_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => snackOrders.id).notNull(),
  itemId: uuid('item_id').references(() => snackItems.id).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
