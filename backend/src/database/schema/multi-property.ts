import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const propertyTypeEnum = pgEnum('property_type', [
  'resort', 'hotel', 'boutique', 'apartment', 'villa', 'hostel',
]);

// ============================================
// Property Groups
// ============================================
export const propertyGroups = pgTable('property_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  logo: text('logo'),
  settings: jsonb('settings').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Properties
// ============================================
export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => propertyGroups.id),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  type: varchar('type', { length: 50 }).default('resort'),
  starRating: integer('star_rating'),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  website: text('website'),
  timezone: varchar('timezone', { length: 50 }).default('Europe/Rome'),
  currency: varchar('currency', { length: 3 }).default('EUR'),
  gdsCode: varchar('gds_code', { length: 20 }),
  iataCode: varchar('iata_code', { length: 10 }),
  settings: jsonb('settings').default('{}'),
  features: jsonb('features').default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// User Property Access
// ============================================
export const userPropertyAccess = pgTable('user_property_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  propertyId: uuid('property_id').references(() => properties.id).notNull(),
  accessLevel: varchar('access_level', { length: 50 }).default('staff'),
  departments: text('departments').array(),
  grantedBy: uuid('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// User Group Access
// ============================================
export const userGroupAccess = pgTable('user_group_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  groupId: uuid('group_id').references(() => propertyGroups.id).notNull(),
  accessLevel: varchar('access_level', { length: 50 }).default('viewer'),
  grantedBy: uuid('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Shared Inventory Pools
// ============================================
export const sharedInventoryPools = pgTable('shared_inventory_pools', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => propertyGroups.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  itemType: varchar('item_type', { length: 50 }).notNull(),
  totalQuantity: integer('total_quantity').default(0),
  availableQuantity: integer('available_quantity').default(0),
  participatingProperties: jsonb('participating_properties').default('[]'),
  allocationRules: jsonb('allocation_rules').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Group Rate Templates
// ============================================
export const groupRateTemplates = pgTable('group_rate_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => propertyGroups.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  rateType: varchar('rate_type', { length: 50 }).notNull(),
  baseRules: jsonb('base_rules').default('{}'),
  seasonalAdjustments: jsonb('seasonal_adjustments').default('[]'),
  approvedBy: uuid('approved_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Group Report Schedules
// ============================================
export const groupReportSchedules = pgTable('group_report_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => propertyGroups.id).notNull(),
  reportType: varchar('report_type', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  frequency: varchar('frequency', { length: 20 }).default('daily'),
  recipients: text('recipients').array(),
  config: jsonb('config').default('{}'),
  lastExecutedAt: timestamp('last_executed_at'),
  nextExecuteAt: timestamp('next_execute_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Property Benchmarks
// ============================================
export const propertyBenchmarks = pgTable('property_benchmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').references(() => properties.id).notNull(),
  groupId: uuid('group_id').references(() => propertyGroups.id),
  metricType: varchar('metric_type', { length: 100 }).notNull(),
  period: varchar('period', { length: 20 }).notNull(),
  periodDate: timestamp('period_date').notNull(),
  value: decimal('value', { precision: 15, scale: 4 }),
  groupAverage: decimal('group_average', { precision: 15, scale: 4 }),
  groupRank: integer('group_rank'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});
