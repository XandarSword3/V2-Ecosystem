import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled',
]);

export const journeyStatusEnum = pgEnum('journey_status', [
  'draft', 'active', 'paused', 'completed', 'archived',
]);

// ============================================
// Guests
// ============================================
export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  dateOfBirth: timestamp('date_of_birth'),
  nationality: varchar('nationality', { length: 100 }),
  language: varchar('language', { length: 10 }).default('en'),
  preferences: jsonb('preferences').default('{}'),
  tags: text('tags').array(),
  totalSpend: integer('total_spend').default(0),
  visitCount: integer('visit_count').default(0),
  lastVisitAt: timestamp('last_visit_at'),
  source: varchar('source', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Guest Segments
// ============================================
export const guestSegments = pgTable('guest_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).default('dynamic'),
  rules: jsonb('rules').default('[]'),
  memberCount: integer('member_count').default(0),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Segment Members
// ============================================
export const segmentMembers = pgTable('segment_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  segmentId: uuid('segment_id').references(() => guestSegments.id).notNull(),
  guestId: uuid('guest_id').references(() => guests.id).notNull(),
  addedAt: timestamp('added_at').defaultNow(),
  addedBy: varchar('added_by', { length: 50 }).default('system'),
});

// ============================================
// Marketing Email Templates
// ============================================
export const marketingEmailTemplates = pgTable('marketing_email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text'),
  variables: jsonb('variables').default('[]'),
  category: varchar('category', { length: 50 }),
  thumbnail: text('thumbnail'),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Marketing Campaigns
// ============================================
export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).default('email'),
  status: varchar('status', { length: 20 }).default('draft'),
  templateId: uuid('template_id').references(() => marketingEmailTemplates.id),
  segmentId: uuid('segment_id').references(() => guestSegments.id),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  totalRecipients: integer('total_recipients').default(0),
  sentCount: integer('sent_count').default(0),
  openCount: integer('open_count').default(0),
  clickCount: integer('click_count').default(0),
  bounceCount: integer('bounce_count').default(0),
  unsubscribeCount: integer('unsubscribe_count').default(0),
  settings: jsonb('settings').default('{}'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Email Journeys (Drip Campaigns)
// ============================================
export const emailJourneys = pgTable('email_journeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerConfig: jsonb('trigger_config').default('{}'),
  status: varchar('status', { length: 20 }).default('draft'),
  segmentId: uuid('segment_id').references(() => guestSegments.id),
  settings: jsonb('settings').default('{}'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Journey Steps
// ============================================
export const journeySteps = pgTable('journey_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id').references(() => emailJourneys.id).notNull(),
  stepOrder: integer('step_order').notNull(),
  stepType: varchar('step_type', { length: 50 }).notNull(),
  templateId: uuid('template_id').references(() => marketingEmailTemplates.id),
  delayMinutes: integer('delay_minutes').default(0),
  conditions: jsonb('conditions').default('{}'),
  actionConfig: jsonb('action_config').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Journey Enrollments
// ============================================
export const journeyEnrollments = pgTable('journey_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id').references(() => emailJourneys.id).notNull(),
  guestId: uuid('guest_id').references(() => guests.id).notNull(),
  currentStepId: uuid('current_step_id').references(() => journeySteps.id),
  status: varchar('status', { length: 20 }).default('active'),
  enrolledAt: timestamp('enrolled_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  exitedAt: timestamp('exited_at'),
  exitReason: varchar('exit_reason', { length: 100 }),
});

// ============================================
// Campaign Sends
// ============================================
export const campaignSends = pgTable('campaign_sends', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => marketingCampaigns.id).notNull(),
  guestId: uuid('guest_id').references(() => guests.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  sentAt: timestamp('sent_at'),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  bouncedAt: timestamp('bounced_at'),
  unsubscribedAt: timestamp('unsubscribed_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});
