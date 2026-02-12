import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const taskStatusEnum = pgEnum('housekeeping_task_status', [
  'pending', 'in_progress', 'completed', 'verified', 'failed', 'skipped',
]);

export const taskPriorityEnum = pgEnum('housekeeping_priority', [
  'low', 'normal', 'high', 'urgent',
]);

// ============================================
// Housekeeping Task Types
// ============================================
export const housekeepingTaskTypes = pgTable('housekeeping_task_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  defaultDuration: integer('default_duration'),
  requiresInspection: boolean('requires_inspection').default(false),
  checklist: jsonb('checklist').default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Housekeeping Tasks
// ============================================
export const housekeepingTasks = pgTable('housekeeping_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskTypeId: uuid('task_type_id').references(() => housekeepingTaskTypes.id),
  unitType: varchar('unit_type', { length: 50 }).notNull(),
  unitId: uuid('unit_id').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending'),
  priority: varchar('priority', { length: 20 }).default('normal'),
  scheduledDate: timestamp('scheduled_date'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  estimatedDuration: integer('estimated_duration'),
  actualDuration: integer('actual_duration'),
  slaDeadline: timestamp('sla_deadline'),
  slaMet: boolean('sla_met'),
  slaBreachedAt: timestamp('sla_breached_at'),
  notes: text('notes'),
  photos: jsonb('photos').default('[]'),
  checklistResults: jsonb('checklist_results').default('{}'),
  requiresInspection: boolean('requires_inspection').default(false),
  inspectedBy: uuid('inspected_by').references(() => users.id),
  inspectionResult: varchar('inspection_result', { length: 20 }),
  overrideBy: uuid('override_by').references(() => users.id),
  overrideReason: text('override_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Housekeeping Task Comments
// ============================================
export const housekeepingTaskComments = pgTable('housekeeping_task_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => housekeepingTasks.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  comment: text('comment').notNull(),
  photos: jsonb('photos').default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Housekeeping SLA
// ============================================
export const housekeepingSla = pgTable('housekeeping_sla', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskType: varchar('task_type', { length: 100 }).notNull(),
  unitType: varchar('unit_type', { length: 50 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull(),
  maxResponseMinutes: integer('max_response_minutes').notNull(),
  maxCompletionMinutes: integer('max_completion_minutes').notNull(),
  escalationAfterMinutes: integer('escalation_after_minutes'),
  escalateTo: uuid('escalate_to').references(() => users.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Housekeeping Inspections
// ============================================
export const housekeepingInspections = pgTable('housekeeping_inspections', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => housekeepingTasks.id).notNull(),
  inspectorId: uuid('inspector_id').references(() => users.id).notNull(),
  score: integer('score'),
  passed: boolean('passed').default(true),
  checklistResults: jsonb('checklist_results').default('{}'),
  photos: jsonb('photos').default('[]'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Housekeeping Supplies
// ============================================
export const housekeepingSupplies = pgTable('housekeeping_supplies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  unit: varchar('unit', { length: 50 }),
  currentStock: integer('current_stock').default(0),
  reorderLevel: integer('reorder_level').default(10),
  reorderQuantity: integer('reorder_quantity').default(50),
  costPerUnit: integer('cost_per_unit'),
  supplierId: uuid('supplier_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
