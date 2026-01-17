/**
 * Shift Service Tests
 *
 * Unit tests for the Shift Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createShiftService, ShiftServiceError } from '../../src/lib/services/shift.service';
import { InMemoryShiftRepository } from '../../src/lib/repositories/shift.repository.memory';
import type { Container, Shift } from '../../src/lib/container/types';

// Test UUIDs
const STAFF_1 = '11111111-1111-1111-1111-111111111111';
const STAFF_2 = '22222222-2222-2222-2222-222222222222';
const APPROVER = '33333333-3333-3333-3333-333333333333';
const INVALID_UUID = 'not-a-valid-uuid';

// Test dates (future dates)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const TOMORROW = tomorrow.toISOString().split('T')[0];

const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);
const NEXT_WEEK = nextWeek.toISOString().split('T')[0];

function createMockContainer(shiftRepository: InMemoryShiftRepository): Container {
  return {
    shiftRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

function createTestShift(overrides: Partial<Shift> = {}): Shift {
  const now = new Date().toISOString();
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);

  const end = new Date(start);
  end.setHours(17, 0, 0, 0);

  return {
    id: '99999999-9999-9999-9999-999999999999',
    staffId: STAFF_1,
    staffName: 'John Doe',
    shiftType: 'morning',
    status: 'scheduled',
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    actualStart: null,
    actualEnd: null,
    breakMinutes: 30,
    department: 'restaurant',
    position: 'Server',
    notes: null,
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

function getShiftTimes(hoursFromNow: number = 24, durationHours: number = 8) {
  const start = new Date();
  start.setHours(start.getHours() + hoursFromNow);
  const end = new Date(start);
  end.setHours(end.getHours() + durationHours);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

describe('ShiftService', () => {
  let repository: InMemoryShiftRepository;
  let container: Container;
  let service: ReturnType<typeof createShiftService>;

  beforeEach(() => {
    repository = new InMemoryShiftRepository();
    container = createMockContainer(repository);
    service = createShiftService(container);
  });

  // ============================================
  // CREATE SHIFT TESTS
  // ============================================
  describe('createShift', () => {
    it('should create a shift', async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });

      expect(shift).toBeDefined();
      expect(shift.staffName).toBe('John Doe');
      expect(shift.status).toBe('scheduled');
    });

    it('should set default break minutes to 0', async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });

      expect(shift.breakMinutes).toBe(0);
    });

    it('should accept custom break minutes', async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        breakMinutes: 60,
        department: 'restaurant',
        position: 'Server',
      });

      expect(shift.breakMinutes).toBe(60);
    });

    it('should store notes', async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
        notes: 'Training shift',
      });

      expect(shift.notes).toBe('Training shift');
    });

    it('should reject invalid staff ID', async () => {
      const times = getShiftTimes();

      await expect(
        service.createShift({
          staffId: INVALID_UUID,
          staffName: 'John Doe',
          shiftType: 'morning',
          scheduledStart: times.start,
          scheduledEnd: times.end,
          department: 'restaurant',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_STAFF_ID',
      });
    });

    it('should reject empty staff name', async () => {
      const times = getShiftTimes();

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: '',
          shiftType: 'morning',
          scheduledStart: times.start,
          scheduledEnd: times.end,
          department: 'restaurant',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_STAFF_NAME',
      });
    });

    it('should reject invalid shift type', async () => {
      const times = getShiftTimes();

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: 'John Doe',
          shiftType: 'invalid' as any,
          scheduledStart: times.start,
          scheduledEnd: times.end,
          department: 'restaurant',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_SHIFT_TYPE',
      });
    });

    it('should reject end time before start time', async () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setHours(end.getHours() - 2);

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: 'John Doe',
          shiftType: 'morning',
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          department: 'restaurant',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_TIME_RANGE',
      });
    });

    it('should reject shift too short', async () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: 'John Doe',
          shiftType: 'morning',
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          department: 'restaurant',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'SHIFT_TOO_SHORT',
      });
    });

    it('should reject shift too long', async () => {
      const times = getShiftTimes(24, 13); // 13 hours

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: 'John Doe',
          shiftType: 'morning',
          scheduledStart: times.start,
          scheduledEnd: times.end,
          department: 'restaurant',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'SHIFT_TOO_LONG',
      });
    });

    it('should reject invalid department', async () => {
      const times = getShiftTimes();

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: 'John Doe',
          shiftType: 'morning',
          scheduledStart: times.start,
          scheduledEnd: times.end,
          department: 'invalid_dept',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DEPARTMENT',
      });
    });

    it('should reject empty position', async () => {
      const times = getShiftTimes();

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: 'John Doe',
          shiftType: 'morning',
          scheduledStart: times.start,
          scheduledEnd: times.end,
          department: 'restaurant',
          position: '',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_POSITION',
      });
    });

    it('should reject conflicting shifts', async () => {
      const times = getShiftTimes();

      await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });

      await expect(
        service.createShift({
          staffId: STAFF_1,
          staffName: 'John Doe',
          shiftType: 'morning',
          scheduledStart: times.start,
          scheduledEnd: times.end,
          department: 'restaurant',
          position: 'Server',
        })
      ).rejects.toMatchObject({
        code: 'SHIFT_CONFLICT',
      });
    });

    it('should allow non-overlapping shifts', async () => {
      const times1 = getShiftTimes(24, 4);
      const times2 = getShiftTimes(30, 4);

      const shift1 = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times1.start,
        scheduledEnd: times1.end,
        department: 'restaurant',
        position: 'Server',
      });

      const shift2 = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'afternoon',
        scheduledStart: times2.start,
        scheduledEnd: times2.end,
        department: 'restaurant',
        position: 'Server',
      });

      expect(shift1.id).not.toBe(shift2.id);
    });
  });

  // ============================================
  // GET SHIFT TESTS
  // ============================================
  describe('getShift', () => {
    it('should retrieve shift by ID', async () => {
      const times = getShiftTimes();

      const created = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });

      const found = await service.getShift(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent shift', async () => {
      const found = await service.getShift(STAFF_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getShift(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  // ============================================
  // UPDATE SHIFT TESTS
  // ============================================
  describe('updateShift', () => {
    let shiftId: string;

    beforeEach(async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });
      shiftId = shift.id;
    });

    it('should update shift type', async () => {
      const updated = await service.updateShift(shiftId, {
        shiftType: 'afternoon',
      });

      expect(updated.shiftType).toBe('afternoon');
    });

    it('should update department', async () => {
      const updated = await service.updateShift(shiftId, {
        department: 'pool',
      });

      expect(updated.department).toBe('pool');
    });

    it('should update position', async () => {
      const updated = await service.updateShift(shiftId, {
        position: 'Manager',
      });

      expect(updated.position).toBe('Manager');
    });

    it('should update break minutes', async () => {
      const updated = await service.updateShift(shiftId, {
        breakMinutes: 45,
      });

      expect(updated.breakMinutes).toBe(45);
    });

    it('should reject update for non-existent shift', async () => {
      await expect(
        service.updateShift(STAFF_2, { shiftType: 'evening' })
      ).rejects.toMatchObject({
        code: 'SHIFT_NOT_FOUND',
      });
    });

    it('should reject update for in-progress shift', async () => {
      await service.clockIn(shiftId);

      await expect(
        service.updateShift(shiftId, { shiftType: 'evening' })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.updateShift(INVALID_UUID, { shiftType: 'evening' })
      ).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  // ============================================
  // CANCEL SHIFT TESTS
  // ============================================
  describe('cancelShift', () => {
    let shiftId: string;

    beforeEach(async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });
      shiftId = shift.id;
    });

    it('should cancel scheduled shift', async () => {
      const cancelled = await service.cancelShift(shiftId);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should add reason to notes', async () => {
      const cancelled = await service.cancelShift(shiftId, 'Staff called in sick');

      expect(cancelled.notes).toContain('Staff called in sick');
    });

    it('should reject cancelling completed shift', async () => {
      await service.clockIn(shiftId);
      await service.clockOut(shiftId);

      await expect(service.cancelShift(shiftId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent shift', async () => {
      await expect(service.cancelShift(STAFF_2)).rejects.toMatchObject({
        code: 'SHIFT_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.cancelShift(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  // ============================================
  // DELETE SHIFT TESTS
  // ============================================
  describe('deleteShift', () => {
    let shiftId: string;

    beforeEach(async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });
      shiftId = shift.id;
    });

    it('should delete scheduled shift', async () => {
      await service.deleteShift(shiftId);

      const found = await service.getShift(shiftId);
      expect(found).toBeNull();
    });

    it('should reject deleting in-progress shift', async () => {
      await service.clockIn(shiftId);

      await expect(service.deleteShift(shiftId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent shift', async () => {
      await expect(service.deleteShift(STAFF_2)).rejects.toMatchObject({
        code: 'SHIFT_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.deleteShift(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  // ============================================
  // CLOCK IN/OUT TESTS
  // ============================================
  describe('clockIn', () => {
    let shiftId: string;

    beforeEach(async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });
      shiftId = shift.id;
    });

    it('should clock in for scheduled shift', async () => {
      const updated = await service.clockIn(shiftId);

      expect(updated.status).toBe('in_progress');
      expect(updated.actualStart).toBeDefined();
    });

    it('should reject clocking in twice', async () => {
      await service.clockIn(shiftId);

      await expect(service.clockIn(shiftId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent shift', async () => {
      await expect(service.clockIn(STAFF_2)).rejects.toMatchObject({
        code: 'SHIFT_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.clockIn(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  describe('clockOut', () => {
    let shiftId: string;

    beforeEach(async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });
      shiftId = shift.id;
      await service.clockIn(shiftId);
    });

    it('should clock out for in-progress shift', async () => {
      const updated = await service.clockOut(shiftId);

      expect(updated.status).toBe('completed');
      expect(updated.actualEnd).toBeDefined();
    });

    it('should reject clocking out scheduled shift', async () => {
      const times = getShiftTimes(48);

      const newShift = await service.createShift({
        staffId: STAFF_2,
        staffName: 'Jane Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });

      await expect(service.clockOut(newShift.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent shift', async () => {
      await expect(service.clockOut(STAFF_2)).rejects.toMatchObject({
        code: 'SHIFT_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.clockOut(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  // ============================================
  // MARK NO SHOW TESTS
  // ============================================
  describe('markNoShow', () => {
    let shiftId: string;

    beforeEach(async () => {
      const times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });
      shiftId = shift.id;
    });

    it('should mark scheduled shift as no-show', async () => {
      const updated = await service.markNoShow(shiftId);

      expect(updated.status).toBe('no_show');
    });

    it('should reject marking in-progress shift as no-show', async () => {
      await service.clockIn(shiftId);

      await expect(service.markNoShow(shiftId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent shift', async () => {
      await expect(service.markNoShow(STAFF_2)).rejects.toMatchObject({
        code: 'SHIFT_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.markNoShow(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  // ============================================
  // LIST SHIFTS TESTS
  // ============================================
  describe('listShifts', () => {
    beforeEach(async () => {
      const times1 = getShiftTimes(24, 4);
      const times2 = getShiftTimes(48, 4);
      const times3 = getShiftTimes(72, 4);

      await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times1.start,
        scheduledEnd: times1.end,
        department: 'restaurant',
        position: 'Server',
      });

      await service.createShift({
        staffId: STAFF_2,
        staffName: 'Jane Doe',
        shiftType: 'evening',
        scheduledStart: times2.start,
        scheduledEnd: times2.end,
        department: 'pool',
        position: 'Lifeguard',
      });

      await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'night',
        scheduledStart: times3.start,
        scheduledEnd: times3.end,
        department: 'security',
        position: 'Guard',
      });
    });

    it('should return all shifts', async () => {
      const shifts = await service.listShifts();
      expect(shifts.length).toBe(3);
    });

    it('should filter by staff ID', async () => {
      const shifts = await service.listShifts({ staffId: STAFF_1 });
      expect(shifts.length).toBe(2);
    });

    it('should filter by department', async () => {
      const shifts = await service.listShifts({ department: 'pool' });
      expect(shifts.length).toBe(1);
    });

    it('should filter by shift type', async () => {
      const shifts = await service.listShifts({ shiftType: 'morning' });
      expect(shifts.length).toBe(1);
    });

    it('should filter by status', async () => {
      const shifts = await service.listShifts({ status: 'scheduled' });
      expect(shifts.length).toBe(3);
    });
  });

  // ============================================
  // STAFF SCHEDULE TESTS
  // ============================================
  describe('getStaffSchedule', () => {
    it('should return staff schedule with shifts', async () => {
      const times = getShiftTimes();

      await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });

      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const schedule = await service.getStaffSchedule(
        STAFF_1,
        now.toISOString(),
        nextMonth.toISOString()
      );

      expect(schedule.staffId).toBe(STAFF_1);
      expect(schedule.staffName).toBe('John Doe');
      expect(schedule.totalShifts).toBe(1);
      expect(schedule.totalHours).toBeGreaterThan(0);
    });

    it('should reject invalid staff ID', async () => {
      await expect(
        service.getStaffSchedule(INVALID_UUID, '2024-01-01', '2024-01-31')
      ).rejects.toMatchObject({
        code: 'INVALID_STAFF_ID',
      });
    });
  });

  // ============================================
  // CHECK CONFLICTS TESTS
  // ============================================
  describe('checkConflicts', () => {
    let shiftId: string;
    let times: { start: string; end: string };

    beforeEach(async () => {
      times = getShiftTimes();

      const shift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });
      shiftId = shift.id;
    });

    it('should find conflicts', async () => {
      const conflicts = await service.checkConflicts(STAFF_1, times.start, times.end);
      expect(conflicts.length).toBe(1);
    });

    it('should exclude specified shift', async () => {
      const conflicts = await service.checkConflicts(STAFF_1, times.start, times.end, shiftId);
      expect(conflicts.length).toBe(0);
    });

    it('should find no conflicts for different staff', async () => {
      const conflicts = await service.checkConflicts(STAFF_2, times.start, times.end);
      expect(conflicts.length).toBe(0);
    });

    it('should reject invalid staff ID', async () => {
      await expect(
        service.checkConflicts(INVALID_UUID, times.start, times.end)
      ).rejects.toMatchObject({
        code: 'INVALID_STAFF_ID',
      });
    });
  });

  // ============================================
  // SWAP REQUEST TESTS
  // ============================================
  describe('requestSwap', () => {
    let shift1Id: string;
    let shift2Id: string;

    beforeEach(async () => {
      const times1 = getShiftTimes(24, 4);
      const times2 = getShiftTimes(48, 4);

      const shift1 = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times1.start,
        scheduledEnd: times1.end,
        department: 'restaurant',
        position: 'Server',
      });
      shift1Id = shift1.id;

      const shift2 = await service.createShift({
        staffId: STAFF_2,
        staffName: 'Jane Doe',
        shiftType: 'evening',
        scheduledStart: times2.start,
        scheduledEnd: times2.end,
        department: 'restaurant',
        position: 'Server',
      });
      shift2Id = shift2.id;
    });

    it('should create swap request', async () => {
      const request = await service.requestSwap({
        requestingShiftId: shift1Id,
        targetShiftId: shift2Id,
        reason: 'Family event',
      });

      expect(request).toBeDefined();
      expect(request.status).toBe('pending');
    });

    it('should reject swap with self', async () => {
      const times = getShiftTimes(72, 4);

      const sameStaffShift = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'night',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        department: 'restaurant',
        position: 'Server',
      });

      await expect(
        service.requestSwap({
          requestingShiftId: shift1Id,
          targetShiftId: sameStaffShift.id,
          reason: 'Test',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_SWAP',
      });
    });

    it('should reject empty reason', async () => {
      await expect(
        service.requestSwap({
          requestingShiftId: shift1Id,
          targetShiftId: shift2Id,
          reason: '',
        })
      ).rejects.toMatchObject({
        code: 'MISSING_REASON',
      });
    });

    it('should reject invalid shift IDs', async () => {
      await expect(
        service.requestSwap({
          requestingShiftId: INVALID_UUID,
          targetShiftId: shift2Id,
          reason: 'Test',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_SHIFT_ID',
      });
    });
  });

  describe('approveSwap', () => {
    let requestId: string;

    beforeEach(async () => {
      const times1 = getShiftTimes(24, 4);
      const times2 = getShiftTimes(48, 4);

      const shift1 = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times1.start,
        scheduledEnd: times1.end,
        department: 'restaurant',
        position: 'Server',
      });

      const shift2 = await service.createShift({
        staffId: STAFF_2,
        staffName: 'Jane Doe',
        shiftType: 'evening',
        scheduledStart: times2.start,
        scheduledEnd: times2.end,
        department: 'restaurant',
        position: 'Server',
      });

      const request = await service.requestSwap({
        requestingShiftId: shift1.id,
        targetShiftId: shift2.id,
        reason: 'Family event',
      });
      requestId = request.id;
    });

    it('should approve swap request', async () => {
      const approved = await service.approveSwap(requestId, APPROVER);

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(APPROVER);
      expect(approved.approvedAt).toBeDefined();
    });

    it('should reject approving already approved request', async () => {
      await service.approveSwap(requestId, APPROVER);

      await expect(
        service.approveSwap(requestId, APPROVER)
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid request ID', async () => {
      await expect(
        service.approveSwap(INVALID_UUID, APPROVER)
      ).rejects.toMatchObject({
        code: 'INVALID_REQUEST_ID',
      });
    });
  });

  describe('rejectSwap', () => {
    let requestId: string;

    beforeEach(async () => {
      const times1 = getShiftTimes(24, 4);
      const times2 = getShiftTimes(48, 4);

      const shift1 = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times1.start,
        scheduledEnd: times1.end,
        department: 'restaurant',
        position: 'Server',
      });

      const shift2 = await service.createShift({
        staffId: STAFF_2,
        staffName: 'Jane Doe',
        shiftType: 'evening',
        scheduledStart: times2.start,
        scheduledEnd: times2.end,
        department: 'restaurant',
        position: 'Server',
      });

      const request = await service.requestSwap({
        requestingShiftId: shift1.id,
        targetShiftId: shift2.id,
        reason: 'Family event',
      });
      requestId = request.id;
    });

    it('should reject swap request', async () => {
      const rejected = await service.rejectSwap(requestId, APPROVER);

      expect(rejected.status).toBe('rejected');
      expect(rejected.approvedBy).toBe(APPROVER);
    });

    it('should reject rejecting already approved request', async () => {
      await service.approveSwap(requestId, APPROVER);

      await expect(
        service.rejectSwap(requestId, APPROVER)
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid request ID', async () => {
      await expect(
        service.rejectSwap(INVALID_UUID, APPROVER)
      ).rejects.toMatchObject({
        code: 'INVALID_REQUEST_ID',
      });
    });
  });

  describe('cancelSwapRequest', () => {
    let requestId: string;

    beforeEach(async () => {
      const times1 = getShiftTimes(24, 4);
      const times2 = getShiftTimes(48, 4);

      const shift1 = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times1.start,
        scheduledEnd: times1.end,
        department: 'restaurant',
        position: 'Server',
      });

      const shift2 = await service.createShift({
        staffId: STAFF_2,
        staffName: 'Jane Doe',
        shiftType: 'evening',
        scheduledStart: times2.start,
        scheduledEnd: times2.end,
        department: 'restaurant',
        position: 'Server',
      });

      const request = await service.requestSwap({
        requestingShiftId: shift1.id,
        targetShiftId: shift2.id,
        reason: 'Family event',
      });
      requestId = request.id;
    });

    it('should cancel pending swap request', async () => {
      const cancelled = await service.cancelSwapRequest(requestId);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject cancelling approved request', async () => {
      await service.approveSwap(requestId, APPROVER);

      await expect(service.cancelSwapRequest(requestId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid request ID', async () => {
      await expect(service.cancelSwapRequest(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_REQUEST_ID',
      });
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no shifts', async () => {
      const stats = await service.getStats();

      expect(stats.totalShifts).toBe(0);
      expect(stats.scheduledShifts).toBe(0);
      expect(stats.totalHoursScheduled).toBe(0);
    });

    it('should count shifts by status', async () => {
      const times1 = getShiftTimes(24, 4);
      const times2 = getShiftTimes(48, 4);

      const shift1 = await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times1.start,
        scheduledEnd: times1.end,
        department: 'restaurant',
        position: 'Server',
      });

      await service.createShift({
        staffId: STAFF_2,
        staffName: 'Jane Doe',
        shiftType: 'evening',
        scheduledStart: times2.start,
        scheduledEnd: times2.end,
        department: 'restaurant',
        position: 'Server',
      });

      await service.cancelShift(shift1.id);

      const stats = await service.getStats();

      expect(stats.totalShifts).toBe(2);
      expect(stats.cancelledShifts).toBe(1);
      expect(stats.scheduledShifts).toBe(1);
    });

    it('should calculate total hours', async () => {
      const times = getShiftTimes(24, 8);

      await service.createShift({
        staffId: STAFF_1,
        staffName: 'John Doe',
        shiftType: 'morning',
        scheduledStart: times.start,
        scheduledEnd: times.end,
        breakMinutes: 30,
        department: 'restaurant',
        position: 'Server',
      });

      const stats = await service.getStats();

      expect(stats.totalHoursScheduled).toBe(7.5); // 8 hours - 30 min break
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getShiftTypes', () => {
    it('should return all shift types', () => {
      const types = service.getShiftTypes();

      expect(types).toContain('morning');
      expect(types).toContain('afternoon');
      expect(types).toContain('evening');
      expect(types).toContain('night');
      expect(types).toContain('split');
      expect(types).toContain('on_call');
    });
  });

  describe('getStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getStatuses();

      expect(statuses).toContain('scheduled');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('cancelled');
      expect(statuses).toContain('no_show');
    });
  });

  describe('getDepartments', () => {
    it('should return all departments', () => {
      const departments = service.getDepartments();

      expect(departments.length).toBeGreaterThan(0);
      expect(departments).toContain('restaurant');
      expect(departments).toContain('pool');
    });
  });

  describe('calculateShiftHours', () => {
    it('should calculate hours correctly', () => {
      const start = '2024-01-01T09:00:00.000Z';
      const end = '2024-01-01T17:00:00.000Z';

      const hours = service.calculateShiftHours(start, end, 30);

      expect(hours).toBe(7.5); // 8 hours - 30 min break
    });

    it('should return 0 for negative result', () => {
      const start = '2024-01-01T09:00:00.000Z';
      const end = '2024-01-01T10:00:00.000Z';

      const hours = service.calculateShiftHours(start, end, 120);

      expect(hours).toBe(0);
    });
  });
});
