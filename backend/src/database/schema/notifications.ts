import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const notificationTypeEnum = pgEnum('notification_type', [
  'info', 'warning', 'error', 'success', 'alert', 'promotion',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app', 'push', 'email', 'sms',
]);

export const notificationPriorityEnum = pgEnum('notification_priority', [
  'low', 'normal', 'high', 'critical',
]);

// ============================================
// Notifications
// ============================================
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).default('info'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  channel: varchar('channel', { length: 20 }).default('in_app'),
  priority: varchar('priority', { length: 20 }).default('normal'),
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  actions: jsonb('actions').default('[]'),
  read: boolean('read').default(false),
  readAt: timestamp('read_at'),
  scheduledFor: timestamp('scheduled_for'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Notification Broadcasts
// ============================================
export const notificationBroadcasts = pgTable('notification_broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  targetRoles: text('target_roles').array(),
  targetDepartments: text('target_departments').array(),
  channel: varchar('channel', { length: 20 }).default('in_app'),
  priority: varchar('priority', { length: 20 }).default('normal'),
  scheduledFor: timestamp('scheduled_for'),
  sentAt: timestamp('sent_at'),
  sentCount: text('sent_count').default('0'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Notification Templates
// ============================================
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  type: varchar('type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 20 }).default('in_app'),
  titleTemplate: text('title_template').notNull(),
  bodyTemplate: text('body_template').notNull(),
  variables: jsonb('variables').default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Device Tokens (Push Notifications)
// ============================================
export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: text('token').notNull(),
  platform: varchar('platform', { length: 20 }).notNull(),
  deviceId: varchar('device_id', { length: 255 }),
  appVersion: varchar('app_version', { length: 50 }),
  osVersion: varchar('os_version', { length: 50 }),
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Notification Logs (Push Delivery Tracking)
// ============================================
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  notificationId: uuid('notification_id').references(() => notifications.id),
  deviceTokenId: uuid('device_token_id').references(() => deviceTokens.id),
  channel: varchar('channel', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  providerResponse: jsonb('provider_response'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  openedAt: timestamp('opened_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
