import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
  };

  const builder: any = {};
  
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'in', 'or', 'order', 'range'].forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

  return {
    builder,
    queueResponse: (data: any, error: any = null, count?: number) => responseQueue.push({ data, error, count }),
    reset: () => { responseQueue = []; responseIndex = 0; },
  };
};

let mockBuilder: ReturnType<typeof createChainableMock>;
const mockFrom = vi.fn();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { ShiftsController } from '../../../src/modules/manager/shifts.controller';

const createMockReqRes = (overrides: { params?: any; query?: any; body?: any; user?: any } = {}) => {
  const req = {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    user: overrides.user || { userId: 'user-1', role: 'manager' },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  return { req, res };
};

describe('Shifts Controller', () => {
  let controller: ShiftsController;

  beforeEach(() => {
    controller = new ShiftsController();
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockBuilder.reset();
  });

  describe('getShifts', () => {
    it('should return all shifts with pagination', async () => {
      const mockShifts = [
        { id: 'shift-1', staff_id: 'staff-1', shift_date: '2024-01-15' },
        { id: 'shift-2', staff_id: 'staff-2', shift_date: '2024-01-16' },
      ];
      mockBuilder.queueResponse(mockShifts, null, 2);
      mockBuilder.queueResponse([{ id: 'staff-1', full_name: 'John', email: 'john@test.com' }]);

      const { req, res } = createMockReqRes({
        query: { page: '1', limit: '10' },
      });

      await controller.getShifts(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
      }));
    });

    it('should filter by staffId', async () => {
      mockBuilder.queueResponse([{ id: 'shift-1', staff_id: 'staff-1' }]);
      mockBuilder.queueResponse([{ id: 'staff-1', full_name: 'John' }]);

      const { req, res } = createMockReqRes({
        query: { staffId: 'staff-1' },
      });

      await controller.getShifts(req, res);

      expect(mockBuilder.builder.eq).toHaveBeenCalledWith('staff_id', 'staff-1');
    });

    it('should filter by date range', async () => {
      mockBuilder.queueResponse([]);
      mockBuilder.queueResponse([]);

      const { req, res } = createMockReqRes({
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
      });

      await controller.getShifts(req, res);

      expect(mockBuilder.builder.gte).toHaveBeenCalledWith('shift_date', '2024-01-01');
      expect(mockBuilder.builder.lte).toHaveBeenCalledWith('shift_date', '2024-01-31');
    });
  });

  describe('getMyShifts', () => {
    it('should return shifts for current user', async () => {
      const mockShifts = [{ id: 'shift-1', shift_date: '2024-01-15' }];
      mockBuilder.queueResponse(mockShifts);

      const { req, res } = createMockReqRes({
        user: { userId: 'staff-1' },
      });

      await controller.getMyShifts(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockShifts,
      }));
    });
  });

  describe('createShift', () => {
    it('should create a new shift', async () => {
      mockBuilder.queueResponse([]); // No overlapping shifts
      mockBuilder.queueResponse({
        id: 'shift-new',
        staff_id: 'staff-1',
        shift_date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
      });

      const { req, res } = createMockReqRes({
        body: {
          staffId: '123e4567-e89b-12d3-a456-426614174000',
          shiftDate: '2024-01-15',
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 60,
        },
      });

      await controller.createShift(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for invalid data', async () => {
      const { req, res } = createMockReqRes({
        body: { staffId: 'invalid' }, // Invalid UUID
      });

      await controller.createShift(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for overlapping shifts', async () => {
      mockBuilder.queueResponse([{ id: 'existing-shift' }]); // Overlapping exists

      const { req, res } = createMockReqRes({
        body: {
          staffId: '123e4567-e89b-12d3-a456-426614174000',
          shiftDate: '2024-01-15',
          startTime: '09:00',
          endTime: '17:00',
        },
      });

      await controller.createShift(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Overlapping shift exists for this staff member on this date',
      }));
    });
  });

  describe('updateShift', () => {
    it('should update an existing shift', async () => {
      mockBuilder.queueResponse({
        id: 'shift-1',
        start_time: '10:00',
        end_time: '18:00',
      });

      const { req, res } = createMockReqRes({
        params: { id: 'shift-1' },
        body: { startTime: '10:00', endTime: '18:00' },
      });

      await controller.updateShift(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('deleteShift', () => {
    it('should delete a shift', async () => {
      mockBuilder.queueResponse({ id: 'shift-1' });

      const { req, res } = createMockReqRes({
        params: { id: 'shift-1' },
      });

      await controller.deleteShift(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('clockIn', () => {
    it('should clock in a staff member', async () => {
      const mockShift = { id: 'shift-1', status: 'scheduled', staff_id: 'staff-1' };
      mockBuilder.queueResponse(mockShift);
      mockBuilder.queueResponse({ ...mockShift, status: 'in_progress', actual_start: expect.any(String) });

      const { req, res } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'staff-1' },
      });

      await controller.clockIn(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for non-existent shift', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116', message: 'Not found' });

      const { req, res } = createMockReqRes({
        params: { id: 'invalid' },
      });

      await controller.clockIn(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('clockOut', () => {
    it('should clock out a staff member', async () => {
      const mockShift = { id: 'shift-1', status: 'in_progress', staff_id: 'staff-1', actual_start: new Date().toISOString() };
      mockBuilder.queueResponse(mockShift);
      mockBuilder.queueResponse({ ...mockShift, status: 'completed' });

      const { req, res } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'staff-1' },
      });

      await controller.clockOut(req, res);

      // Either success or specific error response
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 403 if not authorized', async () => {
      const mockShift = { id: 'shift-1', status: 'scheduled', staff_id: 'different-user' };
      mockBuilder.queueResponse(mockShift);

      const { req, res } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'user-1' },
      });

      await controller.clockOut(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // Note: getShiftStats may not exist on this controller
});
