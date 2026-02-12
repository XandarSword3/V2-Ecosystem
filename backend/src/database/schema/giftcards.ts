import { pgTable, uuid, varchar, text, boolean, timestamp, decimal, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Gift Card Templates
// ============================================
export const giftCardTemplates = pgTable('gift_card_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  backgroundColor: varchar('background_color', { length: 7 }).default('#4F46E5'),
  textColor: varchar('text_color', { length: 7 }).default('#FFFFFF'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Gift Cards
// ============================================
export const giftCards = pgTable('gift_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  templateId: uuid('template_id').references(() => giftCardTemplates.id),
  initialValue: decimal('initial_value', { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal('current_balance', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD'),
  status: varchar('status', { length: 20 }).default('active'),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  recipientName: varchar('recipient_name', { length: 255 }),
  senderName: varchar('sender_name', { length: 255 }),
  personalMessage: text('personal_message'),
  purchasedBy: uuid('purchased_by').references(() => users.id),
  liabilityRecorded: boolean('liability_recorded').default(false),
  revenueRecognized: decimal('revenue_recognized', { precision: 10, scale: 2 }).default('0'),
  breakageRecorded: decimal('breakage_recorded', { precision: 10, scale: 2 }).default('0'),
  isPhysical: boolean('is_physical').default(false),
  activatedAt: timestamp('activated_at'),
  expiresAt: timestamp('expires_at'),
  redeemedAt: timestamp('redeemed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Gift Card Transactions
// ============================================
export const giftCardTransactions = pgTable('gift_card_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  giftCardId: uuid('gift_card_id').references(() => giftCards.id).notNull(),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  orderId: uuid('order_id'),
  notes: text('notes'),
  performedBy: uuid('performed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Gift Card Ledger (Liability Accounting)
// ============================================
export const giftCardLedger = pgTable('gift_card_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  giftCardId: uuid('gift_card_id').references(() => giftCards.id).notNull(),
  entryType: varchar('entry_type', { length: 30 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  liabilityChange: decimal('liability_change', { precision: 10, scale: 2 }).notNull(),
  revenueChange: decimal('revenue_change', { precision: 10, scale: 2 }).default('0'),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  referenceId: uuid('reference_id'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
