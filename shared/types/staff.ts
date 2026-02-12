// ============================================
// Staff Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled';
export type SwapRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'approved';

export interface StaffShift extends BaseEntity {
  staffId: UUID;
  shiftDate: string; // ISO date YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  breakMinutes: number;
  actualStart?: Date;
  actualEnd?: Date;
  actualBreakMinutes: number;
  status: ShiftStatus;
  department?: string;
  notes?: string;
  lateReason?: string;
  earlyLeaveReason?: string;
  overtimeApproved: boolean;
  createdBy?: UUID;
}

export interface ShiftSwapRequest extends BaseEntity {
  originalShiftId: UUID;
  requestingStaffId: UUID;
  targetStaffId?: UUID;
  status: SwapRequestStatus;
  reason?: string;
  acceptedBy?: UUID;
  approvedBy?: UUID;
}

export interface ClockRecord {
  id: UUID;
  shiftId: UUID;
  adjustmentType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'manual';
  originalTime?: Date;
  adjustedTime: Date;
  reason: string;
  adjustedBy: UUID;
  createdAt: Date;
}

export interface StaffSchedule {
  staffId: UUID;
  staffName: string;
  department: string;
  shifts: StaffShift[];
  totalHours: number;
  overtimeHours: number;
}
