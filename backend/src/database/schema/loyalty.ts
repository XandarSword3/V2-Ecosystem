import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Loyalty Tiers
// ============================================
export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  minPoints: integer('min_points').default(0).notNull(),
  pointsMultiplier: decimal('points_multiplier', { precision: 3, scale: 2 }).default('1.00'),
  benefits: jsonb('benefits').default('[]'),
  color: varchar('color', { length: 7 }).default('#6B7280'),
  icon: varchar('icon', { length: 50 }),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Loyalty Members (Accounts)
// ============================================
export const loyaltyMembers = pgTable('loyalty_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  tierId: uuid('tier_id').references(() => loyaltyTiers.id),
  totalPoints: integer('total_points').default(0),
  availablePoints: integer('available_points').default(0),
  lifetimePoints: integer('lifetime_points').default(0),
  memberSince: timestamp('member_since').defaultNow(),
  lastActivity: timestamp('last_activity').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Loyalty Transactions
// ============================================
export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').references(() => loyaltyMembers.id).notNull(),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(),
  points: integer('points').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  description: text('description'),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Loyalty Rewards
// ============================================
export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  pointsRequired: integer('points_required').notNull(),
  rewardType: varchar('reward_type', { length: 50 }).notNull(),
  rewardValue: jsonb('reward_value').notNull(),
  imageUrl: text('image_url'),
  stock: integer('stock'),
  minTierId: uuid('min_tier_id').references(() => loyaltyTiers.id),
  validFrom: timestamp('valid_from').defaultNow(),
  validUntil: timestamp('valid_until'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Loyalty Redemptions
// ============================================
export const loyaltyRedemptions = pgTable('loyalty_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').references(() => loyaltyMembers.id).notNull(),
  rewardId: uuid('reward_id').references(() => loyaltyRewards.id).notNull(),
  pointsSpent: integer('points_spent').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  redeemedAt: timestamp('redeemed_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
});

// ============================================
// Loyalty Profiles (alternate/simplified)
// ============================================
export const loyaltyProfiles = pgTable('loyalty_profiles', {
  userId: uuid('user_id').references(() => users.id).primaryKey(),
  pointsBalance: integer('points_balance').default(0),
  tier: varchar('tier', { length: 50 }).default('bronze'),
  lifetimePoints: integer('lifetime_points').default(0),
  lastActivityAt: timestamp('last_activity_at'),
  pointsExpiringSoon: integer('points_expiring_soon').default(0),
  nextExpiryDate: timestamp('next_expiry_date'),
  tierProgressPoints: integer('tier_progress_points').default(0),
  tierQualifyingSpend: decimal('tier_qualifying_spend', { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Loyalty Point Batches (Expiry Tracking)
// ============================================
export const loyaltyPointBatches = pgTable('loyalty_point_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  points: integer('points').notNull(),
  remainingPoints: integer('remaining_points').notNull(),
  earnedAt: timestamp('earned_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  source: varchar('source', { length: 50 }).notNull(),
  sourceId: uuid('source_id'),
  isExpired: boolean('is_expired').default(false),
  expiredAt: timestamp('expired_at'),
});

// ============================================
// Loyalty Fraud Flags
// ============================================
export const loyaltyFraudFlags = pgTable('loyalty_fraud_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  flagType: varchar('flag_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).default('warning'),
  details: jsonb('details'),
  resolved: boolean('resolved').default(false),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Loyalty Settings (alias for reference)
// ============================================
export const loyaltySettings = loyaltyTiers;
