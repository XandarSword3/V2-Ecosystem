import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// ============================================
// Enums
// ============================================
export const kioskStatusEnum = pgEnum('kiosk_status', [
  'online', 'offline', 'maintenance', 'error',
]);

export const kioskSessionStatusEnum = pgEnum('kiosk_session_status', [
  'active', 'completed', 'abandoned', 'error',
]);

// ============================================
// Kiosk Devices
// ============================================
export const kioskDevices = pgTable('kiosk_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  location: varchar('location', { length: 255 }),
  kioskType: varchar('kiosk_type', { length: 50 }).default('check_in'),
  status: varchar('status', { length: 20 }).default('offline'),
  hardwareId: varchar('hardware_id', { length: 255 }).unique(),
  ipAddress: varchar('ip_address', { length: 45 }),
  softwareVersion: varchar('software_version', { length: 50 }),
  capabilities: jsonb('capabilities').default('{}'),
  config: jsonb('config').default('{}'),
  hasCardReader: boolean('has_card_reader').default(false),
  hasPrinter: boolean('has_printer').default(false),
  hasScanner: boolean('has_scanner').default(false),
  hasKeyDispenser: boolean('has_key_dispenser').default(false),
  lastHeartbeat: timestamp('last_heartbeat'),
  lastMaintenanceAt: timestamp('last_maintenance_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Kiosk Sessions
// ============================================
export const kioskSessions = pgTable('kiosk_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  kioskId: uuid('kiosk_id').references(() => kioskDevices.id).notNull(),
  sessionToken: varchar('session_token', { length: 255 }),
  guestId: uuid('guest_id'),
  flowType: varchar('flow_type', { length: 50 }),
  currentStep: varchar('current_step', { length: 100 }),
  flowData: jsonb('flow_data').default('{}'),
  status: varchar('status', { length: 20 }).default('active'),
  language: varchar('language', { length: 10 }).default('en'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  abandonedAt: timestamp('abandoned_at'),
  durationSeconds: integer('duration_seconds'),
});

// ============================================
// Kiosk Transactions
// ============================================
export const kioskTransactions = pgTable('kiosk_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => kioskSessions.id).notNull(),
  kioskId: uuid('kiosk_id').references(() => kioskDevices.id).notNull(),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  amount: integer('amount'),
  currency: varchar('currency', { length: 3 }).default('EUR'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  paymentReference: varchar('payment_reference', { length: 255 }),
  status: varchar('status', { length: 20 }).default('pending'),
  relatedId: uuid('related_id'),
  relatedType: varchar('related_type', { length: 50 }),
  receiptPrinted: boolean('receipt_printed').default(false),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Kiosk Hardware Events
// ============================================
export const kioskHardwareEvents = pgTable('kiosk_hardware_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  kioskId: uuid('kiosk_id').references(() => kioskDevices.id).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  component: varchar('component', { length: 50 }),
  severity: varchar('severity', { length: 20 }).default('info'),
  message: text('message'),
  details: jsonb('details').default('{}'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Kiosk Key Stock
// ============================================
export const kioskKeyStock = pgTable('kiosk_key_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  kioskId: uuid('kiosk_id').references(() => kioskDevices.id).notNull(),
  keyType: varchar('key_type', { length: 50 }).default('rfid'),
  totalCapacity: integer('total_capacity').default(0),
  currentStock: integer('current_stock').default(0),
  lowStockThreshold: integer('low_stock_threshold').default(10),
  lastRefillAt: timestamp('last_refill_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Kiosk Screen Flows
// ============================================
export const kioskScreenFlows = pgTable('kiosk_screen_flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  flowType: varchar('flow_type', { length: 50 }).notNull(),
  steps: jsonb('steps').default('[]'),
  config: jsonb('config').default('{}'),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Kiosk Screen Content
// ============================================
export const kioskScreenContent = pgTable('kiosk_screen_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id').references(() => kioskScreenFlows.id),
  screenKey: varchar('screen_key', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }),
  body: text('body'),
  mediaUrl: text('media_url'),
  translations: jsonb('translations').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Kiosk Analytics
// ============================================
export const kioskAnalytics = pgTable('kiosk_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  kioskId: uuid('kiosk_id').references(() => kioskDevices.id).notNull(),
  date: timestamp('date').notNull(),
  totalSessions: integer('total_sessions').default(0),
  completedSessions: integer('completed_sessions').default(0),
  abandonedSessions: integer('abandoned_sessions').default(0),
  averageDuration: integer('average_duration').default(0),
  checkIns: integer('check_ins').default(0),
  checkOuts: integer('check_outs').default(0),
  keyDispensed: integer('key_dispensed').default(0),
  paymentsProcessed: integer('payments_processed').default(0),
  errors: integer('errors').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
