import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const orderTypeEnum = pgEnum('order_type', ['dine_in', 'takeaway', 'delivery']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'preparing', 'ready', 'served', 'delivered', 'completed', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'partial', 'paid', 'refunded']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'whish', 'online']);

// ============================================
// Menu Categories
// ============================================
export const menuCategories = pgTable('menu_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  nameAr: varchar('name_ar', { length: 100 }),
  nameFr: varchar('name_fr', { length: 100 }),
  description: text('description'),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================
// Menu Items
// ============================================
export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => menuCategories.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  nameAr: varchar('name_ar', { length: 255 }),
  nameFr: varchar('name_fr', { length: 255 }),
  description: text('description'),
  descriptionAr: text('description_ar'),
  descriptionFr: text('description_fr'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  preparationTimeMinutes: integer('preparation_time_minutes'),
  calories: integer('calories'),
  isVegetarian: boolean('is_vegetarian').default(false),
  isVegan: boolean('is_vegan').default(false),
  isGlutenFree: boolean('is_gluten_free').default(false),
  allergens: text('allergens').array(),
  imageUrl: text('image_url'),
  isAvailable: boolean('is_available').default(true),
  isFeatured: boolean('is_featured').default(false),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================
// Restaurant Tables
// ============================================
export const restaurantTables = pgTable('restaurant_tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableNumber: varchar('table_number', { length: 20 }).notNull().unique(),
  capacity: integer('capacity').notNull(),
  location: varchar('location', { length: 100 }),
  qrCode: text('qr_code'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// Modifier Groups & Options
// ============================================
export const menuModifierGroups = pgTable('menu_modifier_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id'),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  nameFr: text('name_fr'),
  description: text('description'),
  minSelections: integer('min_selections').default(0),
  maxSelections: integer('max_selections').default(1),
  isRequired: boolean('is_required').default(false),
  allowMultipleSame: boolean('allow_multiple_same').default(false),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const menuModifierOptions = pgTable('menu_modifier_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  modifierGroupId: uuid('modifier_group_id').references(() => menuModifierGroups.id),
  name: text('name').notNull(),
  description: text('description'),
  descriptionAr: text('description_ar'),
  modifierType: text('modifier_type').default('add'),
  priceAdjustment: decimal('price_adjustment', { precision: 10, scale: 2 }).default('0'),
  inventoryItemId: uuid('inventory_item_id'),
  quantityRequired: decimal('quantity_required', { precision: 10, scale: 3 }).default('1'),
  unit: text('unit').default('pcs'),
  maxQuantity: integer('max_quantity').default(1),
  isDefault: boolean('is_default').default(false),
  isAvailable: boolean('is_available').default(true),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const menuItemModifiers = pgTable('menu_item_modifiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  menuItemId: uuid('menu_item_id').references(() => menuItems.id),
  modifierGroupId: uuid('modifier_group_id').references(() => menuModifierGroups.id),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Restaurant Orders
// ============================================
export const restaurantOrders = pgTable('restaurant_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: varchar('order_number', { length: 20 }).notNull().unique(),
  customerId: uuid('customer_id').references(() => users.id),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 20 }),
  tableId: uuid('table_id').references(() => restaurantTables.id),
  tabId: uuid('tab_id'),
  waiterId: uuid('waiter_id').references(() => users.id),
  servedBy: uuid('served_by').references(() => users.id),
  splitFromOrderId: uuid('split_from_order_id'),
  orderType: orderTypeEnum('order_type').notNull(),
  status: orderStatusEnum('status').default('pending').notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull(),
  serviceCharge: decimal('service_charge', { precision: 10, scale: 2 }),
  deliveryFee: decimal('delivery_fee', { precision: 10, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  modifiersTotal: decimal('modifiers_total', { precision: 10, scale: 2 }).default('0'),
  couponId: uuid('coupon_id'),
  couponCode: varchar('coupon_code', { length: 50 }),
  couponDiscount: decimal('coupon_discount', { precision: 10, scale: 2 }).default('0'),
  giftCardAmount: decimal('gift_card_amount', { precision: 10, scale: 2 }).default('0'),
  loyaltyPointsUsed: integer('loyalty_points_used').default(0),
  loyaltyDiscount: decimal('loyalty_discount', { precision: 10, scale: 2 }).default('0'),
  specialInstructions: text('special_instructions'),
  estimatedReadyTime: timestamp('estimated_ready_time'),
  actualReadyTime: timestamp('actual_ready_time'),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
  paymentMethod: paymentMethodEnum('payment_method'),
  assignedToStaff: uuid('assigned_to_staff').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  deletedAt: timestamp('deleted_at'),
});

export const restaurantOrderItems = pgTable('restaurant_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => restaurantOrders.id).notNull(),
  menuItemId: uuid('menu_item_id').references(() => menuItems.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  selectedModifiers: jsonb('selected_modifiers').default('[]'),
  modifierTotal: decimal('modifier_total', { precision: 10, scale: 2 }).default('0'),
  specialInstructions: text('special_instructions'),
  status: orderStatusEnum('status'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const restaurantOrderStatusHistory = pgTable('restaurant_order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => restaurantOrders.id).notNull(),
  fromStatus: orderStatusEnum('from_status'),
  toStatus: orderStatusEnum('to_status').notNull(),
  changedBy: uuid('changed_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// Tabs
// ============================================
export const restaurantTabs = pgTable('restaurant_tabs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').references(() => restaurantTables.id),
  customerId: uuid('customer_id').references(() => users.id),
  waiterId: uuid('waiter_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('open'),
  name: varchar('name', { length: 100 }),
  guestCount: integer('guest_count').default(1),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
  autoCloseAt: timestamp('auto_close_at'),
  creditLimit: decimal('credit_limit', { precision: 10, scale: 2 }).default('500.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Table Reservations (Waitlist)
// ============================================
export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id'),
  customerName: text('customer_name').notNull(),
  partySize: integer('party_size').notNull(),
  phoneNumber: text('phone_number'),
  notes: text('notes'),
  status: text('status').default('waiting'),
  estimatedWaitMinutes: integer('estimated_wait_minutes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  seatedAt: timestamp('seated_at'),
});

// ============================================
// Order Payment Splits
// ============================================
export const orderPaymentSplits = pgTable('order_payment_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => restaurantOrders.id).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  giftCardId: uuid('gift_card_id'),
  loyaltyPointsUsed: integer('loyalty_points_used').default(0),
  payerName: varchar('payer_name', { length: 100 }),
  payerSeat: integer('payer_seat'),
  processedAt: timestamp('processed_at'),
  processedBy: uuid('processed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Order Gift Card Usage
// ============================================
export const orderGiftCardUsage = pgTable('order_gift_card_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => restaurantOrders.id).notNull(),
  giftCardId: uuid('gift_card_id').notNull(),
  amountUsed: decimal('amount_used', { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal('balance_before', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
