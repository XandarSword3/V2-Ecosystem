import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const gdprRequestStatusEnum = pgEnum('gdpr_request_status', [
  'pending', 'processing', 'completed', 'failed', 'cancelled',
]);

export const consentStatusEnum = pgEnum('consent_status', [
  'granted', 'withdrawn', 'pending',
]);

// ============================================
// GDPR Export Requests (Data Exports)
// ============================================
export const gdprExportRequests = pgTable('gdpr_export_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  requestedAt: timestamp('requested_at').defaultNow(),
  processedAt: timestamp('processed_at'),
  downloadUrl: text('download_url'),
  expiresAt: timestamp('expires_at'),
  format: varchar('format', { length: 20 }).default('json'),
  dataSections: text('data_sections').array(),
  processedBy: uuid('processed_by').references(() => users.id),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// GDPR Deletion Requests
// ============================================
export const gdprDeletionRequests = pgTable('gdpr_deletion_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  reason: text('reason'),
  requestedAt: timestamp('requested_at').defaultNow(),
  scheduledDeletionAt: timestamp('scheduled_deletion_at'),
  processedAt: timestamp('processed_at'),
  processedBy: uuid('processed_by').references(() => users.id),
  retainedData: jsonb('retained_data').default('{}'),
  deletionLog: jsonb('deletion_log').default('[]'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// GDPR Consents
// ============================================
export const gdprConsents = pgTable('gdpr_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  consentType: varchar('consent_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).default('granted'),
  version: varchar('version', { length: 20 }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  grantedAt: timestamp('granted_at').defaultNow(),
  withdrawnAt: timestamp('withdrawn_at'),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// GDPR Retention Policies
// ============================================
export const gdprRetentionPolicies = pgTable('gdpr_retention_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  dataCategory: varchar('data_category', { length: 100 }).notNull(),
  tableName: varchar('table_name', { length: 100 }),
  retentionDays: text('retention_days').notNull(),
  legalBasis: varchar('legal_basis', { length: 100 }),
  description: text('description'),
  autoDelete: boolean('auto_delete').default(false),
  anonymizeInstead: boolean('anonymize_instead').default(true),
  isActive: boolean('is_active').default(true),
  lastExecutedAt: timestamp('last_executed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// GDPR Processing Activities
// ============================================
export const gdprProcessingActivities = pgTable('gdpr_processing_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  purpose: text('purpose').notNull(),
  legalBasis: varchar('legal_basis', { length: 100 }).notNull(),
  dataCategories: text('data_categories').array(),
  dataSubjects: text('data_subjects').array(),
  recipients: text('recipients').array(),
  thirdCountryTransfers: boolean('third_country_transfers').default(false),
  safeguards: text('safeguards'),
  retentionPeriod: varchar('retention_period', { length: 100 }),
  technicalMeasures: text('technical_measures'),
  organizationalMeasures: text('organizational_measures'),
  dpiaConducted: boolean('dpia_conducted').default(false),
  dpiaReference: varchar('dpia_reference', { length: 255 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
