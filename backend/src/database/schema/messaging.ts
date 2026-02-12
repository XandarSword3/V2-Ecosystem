import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const conversationStatusEnum = pgEnum('conversation_status', [
  'open', 'waiting', 'resolved', 'closed',
]);

export const messageSenderTypeEnum = pgEnum('message_sender_type', [
  'guest', 'staff', 'bot', 'system',
]);

// ============================================
// Messaging Channels
// ============================================
export const messagingChannels = pgTable('messaging_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 50 }),
  config: jsonb('config').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Guest Messaging Preferences
// ============================================
export const guestMessagingPreferences = pgTable('guest_messaging_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  channelId: uuid('channel_id').references(() => messagingChannels.id),
  preferredChannel: varchar('preferred_channel', { length: 50 }).default('in_app'),
  optedIn: boolean('opted_in').default(true),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }),
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),
  language: varchar('language', { length: 10 }).default('en'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Conversations
// ============================================
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  guestId: uuid('guest_id').references(() => users.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  channelId: uuid('channel_id').references(() => messagingChannels.id),
  subject: varchar('subject', { length: 255 }),
  status: varchar('status', { length: 20 }).default('open'),
  priority: varchar('priority', { length: 20 }).default('normal'),
  department: varchar('department', { length: 100 }),
  tags: text('tags').array(),
  metadata: jsonb('metadata').default('{}'),
  lastMessageAt: timestamp('last_message_at'),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Messages
// ============================================
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  senderId: uuid('sender_id').references(() => users.id),
  senderType: varchar('sender_type', { length: 20 }).default('guest'),
  content: text('content').notNull(),
  contentType: varchar('content_type', { length: 20 }).default('text'),
  attachments: jsonb('attachments').default('[]'),
  metadata: jsonb('metadata').default('{}'),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Message Templates
// ============================================
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }),
  content: text('content').notNull(),
  variables: jsonb('variables').default('[]'),
  translations: jsonb('translations').default('{}'),
  usageCount: integer('usage_count').default(0),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Chatbot Intents
// ============================================
export const chatbotIntents = pgTable('chatbot_intents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  trainingPhrases: jsonb('training_phrases').default('[]'),
  responses: jsonb('responses').default('[]'),
  actions: jsonb('actions').default('[]'),
  contextRequired: text('context_required').array(),
  contextSet: text('context_set').array(),
  priority: integer('priority').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
