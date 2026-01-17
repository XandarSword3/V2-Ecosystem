/**
 * Shift Service with Dependency Injection
 *
 * This service handles all scheduling/shift operations including:
 * - Shift creation and management
 * - Clock in/out tracking
 * - Shift swaps
 * - Scheduling conflicts
 *
 * All dependencies are injected via the container for testability.
 */

import type {
  Container,
  Shift,
  ShiftStatus,
  ShiftType,
  ShiftFilters,
  ShiftSwapRequest,
} from '../container/types';

// Custom error class
export class ShiftServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ShiftServiceError';
  }
}

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid types and statuses
const VALID_SHIFT_TYPES: ShiftType[] = ['morning', 'afternoon', 'evening', 'night', 'split', 'on_call'];
const VALID_STATUSES: ShiftStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
const VALID_DEPARTMENTS = ['kitchen', 'front_desk', 'housekeeping', 'pool', 'restaurant', 'maintenance', 'security', 'management'];

// Configuration
const MAX_SHIFT_HOURS = 12;
const MIN_SHIFT_HOURS = 1;
const MAX_BREAK_MINUTES = 120;

export interface CreateShiftInput {
  staffId: string;
  staffName: string;
  shiftType: ShiftType;
  scheduledStart: string;
  scheduledEnd: string;
  breakMinutes?: number;
  department: string;
  position: string;
  notes?: string;
}

export interface UpdateShiftInput {
  shiftType?: ShiftType;
  scheduledStart?: string;
  scheduledEnd?: string;
  breakMinutes?: number;
  department?: string;
  position?: string;
  notes?: string;
}

export interface SwapRequestInput {
  requestingShiftId: string;
  targetShiftId: string;
  reason: string;
}

export interface ShiftStats {
  totalShifts: number;
  scheduledShifts: number;
  completedShifts: number;
  cancelledShifts: number;
  noShowShifts: number;
  totalHoursScheduled: number;
  averageShiftHours: number;
}

export interface StaffSchedule {
  staffId: string;
  staffName: string;
  shifts: Shift[];
  totalHours: number;
  totalShifts: number;
}

export interface ShiftService {
  createShift(input: CreateShiftInput): Promise<Shift>;
  getShift(id: string): Promise<Shift | null>;
  updateShift(id: string, input: UpdateShiftInput): Promise<Shift>;
  cancelShift(id: string, reason?: string): Promise<Shift>;
  deleteShift(id: string): Promise<void>;
  clockIn(id: string): Promise<Shift>;
  clockOut(id: string): Promise<Shift>;
  markNoShow(id: string): Promise<Shift>;
  listShifts(filters?: ShiftFilters): Promise<Shift[]>;
  getStaffSchedule(staffId: string, startDate: string, endDate: string): Promise<StaffSchedule>;
  checkConflicts(staffId: string, start: string, end: string, excludeId?: string): Promise<Shift[]>;
  requestSwap(input: SwapRequestInput): Promise<ShiftSwapRequest>;
  approveSwap(requestId: string, approverId: string): Promise<ShiftSwapRequest>;
  rejectSwap(requestId: string, approverId: string): Promise<ShiftSwapRequest>;
  cancelSwapRequest(requestId: string): Promise<ShiftSwapRequest>;
  getSwapRequests(staffId: string): Promise<ShiftSwapRequest[]>;
  getStats(filters?: ShiftFilters): Promise<ShiftStats>;
  getShiftTypes(): ShiftType[];
  getStatuses(): ShiftStatus[];
  getDepartments(): string[];
  calculateShiftHours(start: string, end: string, breakMinutes: number): number;
}

/**
 * Creates a ShiftService instance with injected dependencies.
 */
export function createShiftService(container: Container): ShiftService {
  const { shiftRepository, logger } = container;

  // ----------------------------------------
  // VALIDATION HELPERS
  // ----------------------------------------

  function isValidUuid(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  function validateStaffName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ShiftServiceError('Staff name is required', 'INVALID_STAFF_NAME');
    }
    if (trimmed.length < 2) {
      throw new ShiftServiceError('Staff name must be at least 2 characters', 'INVALID_STAFF_NAME');
    }
    if (trimmed.length > 100) {
      throw new ShiftServiceError('Staff name must be at most 100 characters', 'INVALID_STAFF_NAME');
    }
  }

  function validateShiftTimes(start: string, end: string): void {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime())) {
      throw new ShiftServiceError('Invalid start time format', 'INVALID_START_TIME');
    }
    if (isNaN(endDate.getTime())) {
      throw new ShiftServiceError('Invalid end time format', 'INVALID_END_TIME');
    }

    if (endDate <= startDate) {
      throw new ShiftServiceError('End time must be after start time', 'INVALID_TIME_RANGE');
    }

    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (hours < MIN_SHIFT_HOURS) {
      throw new ShiftServiceError(`Shift must be at least ${MIN_SHIFT_HOURS} hour(s)`, 'SHIFT_TOO_SHORT');
    }
    if (hours > MAX_SHIFT_HOURS) {
      throw new ShiftServiceError(`Shift cannot exceed ${MAX_SHIFT_HOURS} hours`, 'SHIFT_TOO_LONG');
    }
  }

  function validateBreakMinutes(minutes: number): void {
    if (!Number.isInteger(minutes)) {
      throw new ShiftServiceError('Break minutes must be a whole number', 'INVALID_BREAK');
    }
    if (minutes < 0) {
      throw new ShiftServiceError('Break minutes cannot be negative', 'INVALID_BREAK');
    }
    if (minutes > MAX_BREAK_MINUTES) {
      throw new ShiftServiceError(`Break cannot exceed ${MAX_BREAK_MINUTES} minutes`, 'INVALID_BREAK');
    }
  }

  function validateDepartment(department: string): void {
    if (!VALID_DEPARTMENTS.includes(department)) {
      throw new ShiftServiceError(`Invalid department: ${department}`, 'INVALID_DEPARTMENT');
    }
  }

  function validatePosition(position: string): void {
    const trimmed = position.trim();
    if (!trimmed) {
      throw new ShiftServiceError('Position is required', 'INVALID_POSITION');
    }
    if (trimmed.length > 100) {
      throw new ShiftServiceError('Position must be at most 100 characters', 'INVALID_POSITION');
    }
  }

  // ----------------------------------------
  // SERVICE METHODS
  // ----------------------------------------

  async function createShift(input: CreateShiftInput): Promise<Shift> {
    if (!isValidUuid(input.staffId)) {
      throw new ShiftServiceError('Invalid staff ID format', 'INVALID_STAFF_ID');
    }

    validateStaffName(input.staffName);

    if (!VALID_SHIFT_TYPES.includes(input.shiftType)) {
      throw new ShiftServiceError('Invalid shift type', 'INVALID_SHIFT_TYPE');
    }

    validateShiftTimes(input.scheduledStart, input.scheduledEnd);
    validateDepartment(input.department);
    validatePosition(input.position);

    const breakMinutes = input.breakMinutes ?? 0;
    validateBreakMinutes(breakMinutes);

    // Check for conflicts
    const conflicts = await shiftRepository.getConflicts(
      input.staffId,
      input.scheduledStart,
      input.scheduledEnd
    );

    if (conflicts.length > 0) {
      throw new ShiftServiceError(
        `Shift conflicts with ${conflicts.length} existing shift(s)`,
        'SHIFT_CONFLICT'
      );
    }

    const shift = await shiftRepository.create({
      staffId: input.staffId,
      staffName: input.staffName.trim(),
      shiftType: input.shiftType,
      status: 'scheduled',
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      actualStart: null,
      actualEnd: null,
      breakMinutes,
      department: input.department,
      position: input.position.trim(),
      notes: input.notes?.trim() || null,
    });

    logger.info(`Shift created for ${input.staffName} (${input.department})`);
    return shift;
  }

  async function getShift(id: string): Promise<Shift | null> {
    if (!isValidUuid(id)) {
      throw new ShiftServiceError('Invalid shift ID format', 'INVALID_SHIFT_ID');
    }
    return shiftRepository.getById(id);
  }

  async function updateShift(id: string, input: UpdateShiftInput): Promise<Shift> {
    if (!isValidUuid(id)) {
      throw new ShiftServiceError('Invalid shift ID format', 'INVALID_SHIFT_ID');
    }

    const shift = await shiftRepository.getById(id);
    if (!shift) {
      throw new ShiftServiceError('Shift not found', 'SHIFT_NOT_FOUND');
    }

    if (shift.status !== 'scheduled') {
      throw new ShiftServiceError(
        `Cannot update shift with status: ${shift.status}`,
        'INVALID_STATUS'
      );
    }

    const updates: Partial<Shift> = {};

    if (input.shiftType !== undefined) {
      if (!VALID_SHIFT_TYPES.includes(input.shiftType)) {
        throw new ShiftServiceError('Invalid shift type', 'INVALID_SHIFT_TYPE');
      }
      updates.shiftType = input.shiftType;
    }

    const newStart = input.scheduledStart ?? shift.scheduledStart;
    const newEnd = input.scheduledEnd ?? shift.scheduledEnd;

    if (input.scheduledStart !== undefined || input.scheduledEnd !== undefined) {
      validateShiftTimes(newStart, newEnd);

      // Check conflicts with new times
      const conflicts = await shiftRepository.getConflicts(shift.staffId, newStart, newEnd, id);
      if (conflicts.length > 0) {
        throw new ShiftServiceError(
          `Updated shift conflicts with ${conflicts.length} existing shift(s)`,
          'SHIFT_CONFLICT'
        );
      }

      updates.scheduledStart = newStart;
      updates.scheduledEnd = newEnd;
    }

    if (input.breakMinutes !== undefined) {
      validateBreakMinutes(input.breakMinutes);
      updates.breakMinutes = input.breakMinutes;
    }

    if (input.department !== undefined) {
      validateDepartment(input.department);
      updates.department = input.department;
    }

    if (input.position !== undefined) {
      validatePosition(input.position);
      updates.position = input.position.trim();
    }

    if (input.notes !== undefined) {
      updates.notes = input.notes?.trim() || null;
    }

    const updated = await shiftRepository.update(id, updates);
    if (!updated) {
      throw new ShiftServiceError('Failed to update shift', 'UPDATE_FAILED');
    }

    logger.info(`Shift ${id} updated`);
    return updated;
  }

  async function cancelShift(id: string, reason?: string): Promise<Shift> {
    if (!isValidUuid(id)) {
      throw new ShiftServiceError('Invalid shift ID format', 'INVALID_SHIFT_ID');
    }

    const shift = await shiftRepository.getById(id);
    if (!shift) {
      throw new ShiftServiceError('Shift not found', 'SHIFT_NOT_FOUND');
    }

    if (shift.status === 'completed' || shift.status === 'cancelled') {
      throw new ShiftServiceError(
        `Cannot cancel shift with status: ${shift.status}`,
        'INVALID_STATUS'
      );
    }

    const notes = reason ? `Cancelled: ${reason.trim()}` : 'Cancelled';

    const updated = await shiftRepository.update(id, {
      status: 'cancelled',
      notes: shift.notes ? `${shift.notes}\n${notes}` : notes,
    });

    if (!updated) {
      throw new ShiftServiceError('Failed to cancel shift', 'UPDATE_FAILED');
    }

    logger.info(`Shift ${id} cancelled`);
    return updated;
  }

  async function deleteShift(id: string): Promise<void> {
    if (!isValidUuid(id)) {
      throw new ShiftServiceError('Invalid shift ID format', 'INVALID_SHIFT_ID');
    }

    const shift = await shiftRepository.getById(id);
    if (!shift) {
      throw new ShiftServiceError('Shift not found', 'SHIFT_NOT_FOUND');
    }

    if (shift.status === 'in_progress') {
      throw new ShiftServiceError('Cannot delete shift in progress', 'INVALID_STATUS');
    }

    const deleted = await shiftRepository.delete(id);
    if (!deleted) {
      throw new ShiftServiceError('Failed to delete shift', 'DELETE_FAILED');
    }

    logger.info(`Shift ${id} deleted`);
  }

  async function clockIn(id: string): Promise<Shift> {
    if (!isValidUuid(id)) {
      throw new ShiftServiceError('Invalid shift ID format', 'INVALID_SHIFT_ID');
    }

    const shift = await shiftRepository.getById(id);
    if (!shift) {
      throw new ShiftServiceError('Shift not found', 'SHIFT_NOT_FOUND');
    }

    if (shift.status !== 'scheduled') {
      throw new ShiftServiceError(
        `Cannot clock in for shift with status: ${shift.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await shiftRepository.update(id, {
      status: 'in_progress',
      actualStart: new Date().toISOString(),
    });

    if (!updated) {
      throw new ShiftServiceError('Failed to clock in', 'UPDATE_FAILED');
    }

    logger.info(`Staff ${shift.staffName} clocked in for shift ${id}`);
    return updated;
  }

  async function clockOut(id: string): Promise<Shift> {
    if (!isValidUuid(id)) {
      throw new ShiftServiceError('Invalid shift ID format', 'INVALID_SHIFT_ID');
    }

    const shift = await shiftRepository.getById(id);
    if (!shift) {
      throw new ShiftServiceError('Shift not found', 'SHIFT_NOT_FOUND');
    }

    if (shift.status !== 'in_progress') {
      throw new ShiftServiceError(
        `Cannot clock out for shift with status: ${shift.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await shiftRepository.update(id, {
      status: 'completed',
      actualEnd: new Date().toISOString(),
    });

    if (!updated) {
      throw new ShiftServiceError('Failed to clock out', 'UPDATE_FAILED');
    }

    logger.info(`Staff ${shift.staffName} clocked out for shift ${id}`);
    return updated;
  }

  async function markNoShow(id: string): Promise<Shift> {
    if (!isValidUuid(id)) {
      throw new ShiftServiceError('Invalid shift ID format', 'INVALID_SHIFT_ID');
    }

    const shift = await shiftRepository.getById(id);
    if (!shift) {
      throw new ShiftServiceError('Shift not found', 'SHIFT_NOT_FOUND');
    }

    if (shift.status !== 'scheduled') {
      throw new ShiftServiceError(
        `Cannot mark as no-show for shift with status: ${shift.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await shiftRepository.update(id, {
      status: 'no_show',
    });

    if (!updated) {
      throw new ShiftServiceError('Failed to mark as no-show', 'UPDATE_FAILED');
    }

    logger.info(`Staff ${shift.staffName} marked as no-show for shift ${id}`);
    return updated;
  }

  async function listShifts(filters?: ShiftFilters): Promise<Shift[]> {
    return shiftRepository.list(filters);
  }

  async function getStaffSchedule(
    staffId: string,
    startDate: string,
    endDate: string
  ): Promise<StaffSchedule> {
    if (!isValidUuid(staffId)) {
      throw new ShiftServiceError('Invalid staff ID format', 'INVALID_STAFF_ID');
    }

    const shifts = await shiftRepository.getByStaffId(staffId, {
      startDate,
      endDate,
    });

    // Get staff name from first shift or use placeholder
    const staffName = shifts.length > 0 ? shifts[0].staffName : 'Unknown';

    let totalHours = 0;
    for (const shift of shifts) {
      if (shift.status !== 'cancelled') {
        totalHours += calculateShiftHours(
          shift.scheduledStart,
          shift.scheduledEnd,
          shift.breakMinutes
        );
      }
    }

    return {
      staffId,
      staffName,
      shifts,
      totalHours,
      totalShifts: shifts.filter((s) => s.status !== 'cancelled').length,
    };
  }

  async function checkConflicts(
    staffId: string,
    start: string,
    end: string,
    excludeId?: string
  ): Promise<Shift[]> {
    if (!isValidUuid(staffId)) {
      throw new ShiftServiceError('Invalid staff ID format', 'INVALID_STAFF_ID');
    }
    return shiftRepository.getConflicts(staffId, start, end, excludeId);
  }

  async function requestSwap(input: SwapRequestInput): Promise<ShiftSwapRequest> {
    if (!isValidUuid(input.requestingShiftId)) {
      throw new ShiftServiceError('Invalid requesting shift ID format', 'INVALID_SHIFT_ID');
    }
    if (!isValidUuid(input.targetShiftId)) {
      throw new ShiftServiceError('Invalid target shift ID format', 'INVALID_SHIFT_ID');
    }

    if (!input.reason.trim()) {
      throw new ShiftServiceError('Reason is required for swap request', 'MISSING_REASON');
    }

    const requestingShift = await shiftRepository.getById(input.requestingShiftId);
    if (!requestingShift) {
      throw new ShiftServiceError('Requesting shift not found', 'SHIFT_NOT_FOUND');
    }

    const targetShift = await shiftRepository.getById(input.targetShiftId);
    if (!targetShift) {
      throw new ShiftServiceError('Target shift not found', 'SHIFT_NOT_FOUND');
    }

    if (requestingShift.staffId === targetShift.staffId) {
      throw new ShiftServiceError('Cannot swap shifts with yourself', 'INVALID_SWAP');
    }

    if (requestingShift.status !== 'scheduled') {
      throw new ShiftServiceError(
        `Requesting shift has invalid status: ${requestingShift.status}`,
        'INVALID_STATUS'
      );
    }

    if (targetShift.status !== 'scheduled') {
      throw new ShiftServiceError(
        `Target shift has invalid status: ${targetShift.status}`,
        'INVALID_STATUS'
      );
    }

    const request = await shiftRepository.createSwapRequest({
      requestingShiftId: input.requestingShiftId,
      targetShiftId: input.targetShiftId,
      requestingStaffId: requestingShift.staffId,
      targetStaffId: targetShift.staffId,
      reason: input.reason.trim(),
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
    });

    logger.info(`Swap request created: ${request.id}`);
    return request;
  }

  async function approveSwap(requestId: string, approverId: string): Promise<ShiftSwapRequest> {
    if (!isValidUuid(requestId)) {
      throw new ShiftServiceError('Invalid request ID format', 'INVALID_REQUEST_ID');
    }
    if (!isValidUuid(approverId)) {
      throw new ShiftServiceError('Invalid approver ID format', 'INVALID_APPROVER_ID');
    }

    const request = await shiftRepository.getSwapRequest(requestId);
    if (!request) {
      throw new ShiftServiceError('Swap request not found', 'REQUEST_NOT_FOUND');
    }

    if (request.status !== 'pending') {
      throw new ShiftServiceError(
        `Cannot approve request with status: ${request.status}`,
        'INVALID_STATUS'
      );
    }

    // Swap the staff assignments
    const requestingShift = await shiftRepository.getById(request.requestingShiftId);
    const targetShift = await shiftRepository.getById(request.targetShiftId);

    if (!requestingShift || !targetShift) {
      throw new ShiftServiceError('One or more shifts no longer exist', 'SHIFT_NOT_FOUND');
    }

    // Update shifts with swapped staff
    await shiftRepository.update(request.requestingShiftId, {
      staffId: targetShift.staffId,
      staffName: targetShift.staffName,
    });

    await shiftRepository.update(request.targetShiftId, {
      staffId: requestingShift.staffId,
      staffName: requestingShift.staffName,
    });

    const updated = await shiftRepository.updateSwapRequest(requestId, {
      status: 'approved',
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new ShiftServiceError('Failed to approve swap', 'UPDATE_FAILED');
    }

    logger.info(`Swap request ${requestId} approved by ${approverId}`);
    return updated;
  }

  async function rejectSwap(requestId: string, approverId: string): Promise<ShiftSwapRequest> {
    if (!isValidUuid(requestId)) {
      throw new ShiftServiceError('Invalid request ID format', 'INVALID_REQUEST_ID');
    }
    if (!isValidUuid(approverId)) {
      throw new ShiftServiceError('Invalid approver ID format', 'INVALID_APPROVER_ID');
    }

    const request = await shiftRepository.getSwapRequest(requestId);
    if (!request) {
      throw new ShiftServiceError('Swap request not found', 'REQUEST_NOT_FOUND');
    }

    if (request.status !== 'pending') {
      throw new ShiftServiceError(
        `Cannot reject request with status: ${request.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await shiftRepository.updateSwapRequest(requestId, {
      status: 'rejected',
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new ShiftServiceError('Failed to reject swap', 'UPDATE_FAILED');
    }

    logger.info(`Swap request ${requestId} rejected by ${approverId}`);
    return updated;
  }

  async function cancelSwapRequest(requestId: string): Promise<ShiftSwapRequest> {
    if (!isValidUuid(requestId)) {
      throw new ShiftServiceError('Invalid request ID format', 'INVALID_REQUEST_ID');
    }

    const request = await shiftRepository.getSwapRequest(requestId);
    if (!request) {
      throw new ShiftServiceError('Swap request not found', 'REQUEST_NOT_FOUND');
    }

    if (request.status !== 'pending') {
      throw new ShiftServiceError(
        `Cannot cancel request with status: ${request.status}`,
        'INVALID_STATUS'
      );
    }

    const updated = await shiftRepository.updateSwapRequest(requestId, {
      status: 'cancelled',
    });

    if (!updated) {
      throw new ShiftServiceError('Failed to cancel swap request', 'UPDATE_FAILED');
    }

    logger.info(`Swap request ${requestId} cancelled`);
    return updated;
  }

  async function getSwapRequests(staffId: string): Promise<ShiftSwapRequest[]> {
    if (!isValidUuid(staffId)) {
      throw new ShiftServiceError('Invalid staff ID format', 'INVALID_STAFF_ID');
    }
    return shiftRepository.getSwapRequests(staffId);
  }

  async function getStats(filters?: ShiftFilters): Promise<ShiftStats> {
    const shifts = await shiftRepository.list(filters);

    const stats: ShiftStats = {
      totalShifts: shifts.length,
      scheduledShifts: 0,
      completedShifts: 0,
      cancelledShifts: 0,
      noShowShifts: 0,
      totalHoursScheduled: 0,
      averageShiftHours: 0,
    };

    for (const shift of shifts) {
      switch (shift.status) {
        case 'scheduled':
        case 'in_progress':
          stats.scheduledShifts++;
          break;
        case 'completed':
          stats.completedShifts++;
          break;
        case 'cancelled':
          stats.cancelledShifts++;
          break;
        case 'no_show':
          stats.noShowShifts++;
          break;
      }

      if (shift.status !== 'cancelled') {
        stats.totalHoursScheduled += calculateShiftHours(
          shift.scheduledStart,
          shift.scheduledEnd,
          shift.breakMinutes
        );
      }
    }

    const activeShifts = shifts.filter((s) => s.status !== 'cancelled').length;
    stats.averageShiftHours = activeShifts > 0 ? stats.totalHoursScheduled / activeShifts : 0;

    return stats;
  }

  function getShiftTypes(): ShiftType[] {
    return [...VALID_SHIFT_TYPES];
  }

  function getStatuses(): ShiftStatus[] {
    return [...VALID_STATUSES];
  }

  function getDepartments(): string[] {
    return [...VALID_DEPARTMENTS];
  }

  function calculateShiftHours(start: string, end: string, breakMinutes: number): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const totalMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    return Math.max(0, (totalMinutes - breakMinutes) / 60);
  }

  return {
    createShift,
    getShift,
    updateShift,
    cancelShift,
    deleteShift,
    clockIn,
    clockOut,
    markNoShow,
    listShifts,
    getStaffSchedule,
    checkConflicts,
    requestSwap,
    approveSwap,
    rejectSwap,
    cancelSwapRequest,
    getSwapRequests,
    getStats,
    getShiftTypes,
    getStatuses,
    getDepartments,
    calculateShiftHours,
  };
}
