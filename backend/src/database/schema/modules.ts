import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// ============================================
// Enums
// ============================================
export const templateTypeEnum = pgEnum('template_type', [
  'email', 'sms', 'push', 'in_app',
]);

// ============================================
// Modules
// ============================================
export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  templateType: varchar('template_type', { length: 50 }),
  icon: varchar('icon', { length: 50 }),
  version: varchar('version', { length: 20 }),
  settings: jsonb('settings').default('{}'),
  taxCategory: varchar('tax_category', { length: 50 }).default('all'), // Default tax category for items in this module
  isEnabled: boolean('is_enabled').default(true),
  isCore: boolean('is_core').default(false),
  sortOrder: varchar('sort_order', { length: 10 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Email Templates
// ============================================
export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').references(() => modules.id),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  subject: text('subject').notNull(),
  subjectTranslations: jsonb('subject_translations').default('{}'),
  body: text('body').notNull(),
  bodyTranslations: jsonb('body_translations').default('{}'),
  variables: jsonb('variables').default('[]'),
  channel: varchar('channel', { length: 20 }).default('email'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
