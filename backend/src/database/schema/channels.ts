import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// ============================================
// Enums
// ============================================
export const channelTypeEnum = pgEnum('channel_type', [
  'ota', 'gds', 'metasearch', 'direct', 'wholesale',
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'pending', 'synced', 'failed', 'partial',
]);

// ============================================
// Channel Connections
// ============================================
export const channelConnections = pgTable('channel_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelName: varchar('channel_name', { length: 100 }).notNull(),
  channelType: varchar('channel_type', { length: 50 }).notNull(),
  apiUrl: text('api_url'),
  apiKey: text('api_key'),
  apiSecret: text('api_secret'),
  hotelCode: varchar('hotel_code', { length: 100 }),
  settings: jsonb('settings').default('{}'),
  isActive: boolean('is_active').default(true),
  lastSyncAt: timestamp('last_sync_at'),
  syncFrequency: integer('sync_frequency').default(15),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Channel Room Mappings
// ============================================
export const channelRoomMappings = pgTable('channel_room_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channelConnections.id).notNull(),
  localRoomTypeId: uuid('local_room_type_id').notNull(),
  channelRoomCode: varchar('channel_room_code', { length: 100 }).notNull(),
  channelRoomName: varchar('channel_room_name', { length: 255 }),
  mappingConfig: jsonb('mapping_config').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Channel Rate Mappings
// ============================================
export const channelRateMappings = pgTable('channel_rate_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channelConnections.id).notNull(),
  localRatePlanId: uuid('local_rate_plan_id').notNull(),
  channelRateCode: varchar('channel_rate_code', { length: 100 }).notNull(),
  channelRateName: varchar('channel_rate_name', { length: 255 }),
  adjustmentType: varchar('adjustment_type', { length: 20 }).default('none'),
  adjustmentValue: decimal('adjustment_value', { precision: 10, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Channel Availability Updates
// ============================================
export const channelAvailabilityUpdates = pgTable('channel_availability_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channelConnections.id).notNull(),
  roomMappingId: uuid('room_mapping_id').references(() => channelRoomMappings.id),
  date: timestamp('date').notNull(),
  availableRooms: integer('available_rooms').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  sentAt: timestamp('sent_at'),
  acknowledgedAt: timestamp('acknowledged_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Channel Rate Updates
// ============================================
export const channelRateUpdates = pgTable('channel_rate_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channelConnections.id).notNull(),
  rateMappingId: uuid('rate_mapping_id').references(() => channelRateMappings.id),
  date: timestamp('date').notNull(),
  rate: decimal('rate', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('EUR'),
  restrictions: jsonb('restrictions').default('{}'),
  status: varchar('status', { length: 20 }).default('pending'),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Channel Reservations
// ============================================
export const channelReservations = pgTable('channel_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channelConnections.id).notNull(),
  channelReservationId: varchar('channel_reservation_id', { length: 100 }).notNull(),
  localReservationId: uuid('local_reservation_id'),
  guestName: varchar('guest_name', { length: 255 }).notNull(),
  guestEmail: varchar('guest_email', { length: 255 }),
  guestPhone: varchar('guest_phone', { length: 50 }),
  roomTypeCode: varchar('room_type_code', { length: 100 }),
  ratePlanCode: varchar('rate_plan_code', { length: 100 }),
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  adults: integer('adults').default(1),
  children: integer('children').default(0),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('EUR'),
  status: varchar('status', { length: 20 }).default('confirmed'),
  rawPayload: jsonb('raw_payload'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Channel Sync Log
// ============================================
export const channelSyncLog = pgTable('channel_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channelConnections.id).notNull(),
  syncType: varchar('sync_type', { length: 50 }).notNull(),
  direction: varchar('direction', { length: 10 }).default('outbound'),
  status: varchar('status', { length: 20 }).notNull(),
  recordsProcessed: integer('records_processed').default(0),
  errorCount: integer('error_count').default(0),
  errors: jsonb('errors').default('[]'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
});
