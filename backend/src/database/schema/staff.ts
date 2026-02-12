import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Enums
// ============================================
export const shiftStatusEnum = pgEnum('shift_status', [
  'scheduled', 'clocked_in', 'on_break', 'clocked_out', 'absent', 'cancelled',
]);

export const swapStatusEnum = pgEnum('swap_status', [
  'pending', 'approved', 'rejected', 'cancelled',
]);

// ============================================
// Staff Shifts
// ============================================
export const staffShifts = pgTable('staff_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  department: varchar('department', { length: 100 }),
  role: varchar('role', { length: 100 }),
  scheduledStart: timestamp('scheduled_start').notNull(),
  scheduledEnd: timestamp('scheduled_end').notNull(),
  actualStart: timestamp('actual_start'),
  actualEnd: timestamp('actual_end'),
  breakMinutes: integer('break_minutes').default(0),
  actualBreakMinutes: integer('actual_break_minutes'),
  status: varchar('status', { length: 20 }).default('scheduled'),
  overtimeMinutes: integer('overtime_minutes').default(0),
  overtimeApproved: boolean('overtime_approved').default(false),
  overtimeApprovedBy: uuid('overtime_approved_by').references(() => users.id),
  notes: text('notes'),
  location: varchar('location', { length: 255 }),
  isHoliday: boolean('is_holiday').default(false),
  payRate: decimal('pay_rate', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Shift Swap Requests
// ============================================
export const shiftSwapRequests = pgTable('shift_swap_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id').references(() => users.id).notNull(),
  requesterShiftId: uuid('requester_shift_id').references(() => staffShifts.id).notNull(),
  targetUserId: uuid('target_user_id').references(() => users.id),
  targetShiftId: uuid('target_shift_id').references(() => staffShifts.id),
  status: varchar('status', { length: 20 }).default('pending'),
  reason: text('reason'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Time Clock Adjustments
// ============================================
export const timeClockAdjustments = pgTable('time_clock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').references(() => staffShifts.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  adjustmentType: varchar('adjustment_type', { length: 50 }).notNull(),
  originalValue: timestamp('original_value'),
  newValue: timestamp('new_value'),
  reason: text('reason').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});
