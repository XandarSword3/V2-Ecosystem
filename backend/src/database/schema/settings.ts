import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const translationStatusEnum = pgEnum('translation_status', [
  'draft', 'review', 'approved', 'published',
]);

export const auditSeverityEnum = pgEnum('audit_severity', [
  'low', 'medium', 'high', 'critical',
]);

// ============================================
// System Settings (Key/Value)
// ============================================
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value'),
  valueType: varchar('value_type', { length: 20 }).default('string'),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  isPublic: boolean('is_public').default(false),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Security Audit Log
// ============================================
export const securityAuditLog = pgTable('security_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).default('INFO').notNull(),
  userId: uuid('user_id').references(() => users.id),
  targetUserId: uuid('target_user_id').references(() => users.id),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  success: boolean('success').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  tenantId: uuid('tenant_id'),
  propertyId: uuid('property_id'),
});

// ============================================
// Audit Logs (General)
// ============================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 255 }).notNull(),
  entity: varchar('entity', { length: 100 }),
  entityId: uuid('entity_id'),
  changes: jsonb('changes').default('{}'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Translations
// ============================================
export const translations = pgTable('translations', {
  id: uuid('id').primaryKey().defaultRandom(),
  namespace: varchar('namespace', { length: 100 }).notNull(),
  key: varchar('key', { length: 255 }).notNull(),
  locale: varchar('locale', { length: 10 }).notNull(),
  value: text('value').notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  isDefault: boolean('is_default').default(false),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
