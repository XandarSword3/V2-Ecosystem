// ============================================
// Housekeeping Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type HousekeepingTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type HousekeepingTaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
export type HousekeepingLocationType = 'unit' | 'common_area' | 'other';
export type HousekeepingFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'on_checkout' | 'on_checkin';

export interface HousekeepingTaskType extends BaseEntity {
  name: string;
  description?: string;
  estimatedMinutes: number;
  checklist: string[];
  priority: HousekeepingTaskPriority;
  appliesTo: HousekeepingLocationType;
  isActive: boolean;
}

export interface HousekeepingTask extends BaseEntity {
  taskTypeId?: UUID;
  title: string;
  description?: string;
  locationType: HousekeepingLocationType;
  locationId?: UUID;
  locationName?: string;
  priority: HousekeepingTaskPriority;
  status: HousekeepingTaskStatus;
  assignedTo?: UUID;
  assignedBy?: UUID;
  scheduledDate?: string; // ISO date
  scheduledTime?: string; // HH:mm
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  verifiedBy?: UUID;
  verifiedAt?: Date;
  checklistCompleted: Record<string, boolean>[];
  notes?: string;
  photos: string[];
  bookingId?: UUID;
}

export interface HousekeepingSchedule extends BaseEntity {
  taskTypeId?: UUID;
  locationType: HousekeepingLocationType;
  locationId?: UUID;
  locationName?: string;
  frequency: HousekeepingFrequency;
  dayOfWeek?: number[];
  timeOfDay: string; // HH:mm
  assignedTo?: UUID;
  isActive: boolean;
  lastGenerated?: Date;
}

export interface HousekeepingLog {
  id: UUID;
  taskId: UUID;
  action: string;
  oldStatus?: HousekeepingTaskStatus;
  newStatus?: HousekeepingTaskStatus;
  notes?: string;
  performedBy?: UUID;
  createdAt: Date;
}
