import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Payments
// ============================================
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceType: varchar('reference_type', { length: 50 }).notNull(),
  referenceId: uuid('reference_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD'),
  method: varchar('method', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeChargeId: varchar('stripe_charge_id', { length: 255 }),
  receiptUrl: text('receipt_url'),
  processedBy: uuid('processed_by').references(() => users.id),
  processedAt: timestamp('processed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// Payment Ledger
// ============================================
export const paymentLedger = pgTable('payment_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceType: varchar('reference_type', { length: 50 }).notNull(),
  referenceId: uuid('reference_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  gatewayReferenceId: varchar('gateway_reference_id', { length: 100 }),
  webhookId: varchar('webhook_id', { length: 100 }).unique(),
  status: varchar('status', { length: 20 }).notNull(),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Cash Drawers
// ============================================
export const cashDrawers = pgTable('cash_drawers', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: text('device_id'),
  openedByUserId: uuid('opened_by_user_id').references(() => users.id),
  closedByUserId: uuid('closed_by_user_id').references(() => users.id),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
  startingBalance: decimal('starting_balance', { precision: 10, scale: 2 }).default('0'),
  currentBalance: decimal('current_balance', { precision: 10, scale: 2 }).default('0'),
  endingBalance: decimal('ending_balance', { precision: 10, scale: 2 }),
  discrepancy: decimal('discrepancy', { precision: 10, scale: 2 }),
  status: text('status').default('open'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Cash Transactions
// ============================================
export const cashTransactions = pgTable('cash_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  drawerId: uuid('drawer_id').references(() => cashDrawers.id),
  userId: uuid('user_id').references(() => users.id),
  orderId: uuid('order_id'),
  type: text('type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  reasonCode: text('reason_code'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Chargebacks
// ============================================
export const chargebacks = pgTable('chargebacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').references(() => paymentLedger.id).notNull(),
  stripeDisputeId: text('stripe_dispute_id').notNull().unique(),
  stripeChargeId: text('stripe_charge_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('EUR').notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 30 }).default('needs_response').notNull(),
  evidenceSubmitted: jsonb('evidence_submitted'),
  dueDate: timestamp('due_date').notNull(),
  outcome: varchar('outcome', { length: 20 }),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// User Credits
// ============================================
export const userCredits = pgTable('user_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  type: varchar('type', { length: 50 }),
  sourceBookingId: uuid('source_booking_id'),
  expiresAt: timestamp('expires_at'),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// POS Reconciliation
// ============================================
export const posReconciliation = pgTable('pos_reconciliation', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftDate: timestamp('shift_date').notNull(),
  shiftType: varchar('shift_type', { length: 20 }).default('full_day'),
  openedBy: uuid('opened_by').references(() => users.id),
  closedBy: uuid('closed_by').references(() => users.id),
  cashOpening: decimal('cash_opening', { precision: 10, scale: 2 }).default('0'),
  cashClosing: decimal('cash_closing', { precision: 10, scale: 2 }),
  cashExpected: decimal('cash_expected', { precision: 10, scale: 2 }),
  cashVariance: decimal('cash_variance', { precision: 10, scale: 2 }),
  totalSales: decimal('total_sales', { precision: 10, scale: 2 }).default('0'),
  totalCash: decimal('total_cash', { precision: 10, scale: 2 }).default('0'),
  totalCard: decimal('total_card', { precision: 10, scale: 2 }).default('0'),
  totalGiftCard: decimal('total_gift_card', { precision: 10, scale: 2 }).default('0'),
  totalLoyalty: decimal('total_loyalty', { precision: 10, scale: 2 }).default('0'),
  totalRefunds: decimal('total_refunds', { precision: 10, scale: 2 }).default('0'),
  totalDiscounts: decimal('total_discounts', { precision: 10, scale: 2 }).default('0'),
  totalTips: decimal('total_tips', { precision: 10, scale: 2 }).default('0'),
  ordersCount: integer('orders_count').default(0),
  voidCount: integer('void_count').default(0),
  refundCount: integer('refund_count').default(0),
  status: varchar('status', { length: 20 }).default('open'),
  notes: text('notes'),
  varianceExplanation: text('variance_explanation'),
  openedAtTime: timestamp('opened_at').defaultNow(),
  closedAtTime: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
