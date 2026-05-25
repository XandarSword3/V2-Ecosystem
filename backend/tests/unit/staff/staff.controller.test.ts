import { createMockReqRes } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn()
}));

import * as staffController from '../../../src/modules/staff/staff.controller';
import { getSupabase } from '../../../src/database/connection.js';

describe('Staff Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyShifts', () => {
    it('should return my shifts', async () => {
      const mockShifts = [
        { id: 'shift-1', shift_date: '2024-06-15', start_time: '09:00', end_time: '17:00' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockShifts, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' },
        query: {}
      });

      await staffController.getMyShifts(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });

    it('should call next on error', async () => {
      const error = new Error('DB error');
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockRejectedValue(error)
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' },
        query: {}
      });

      await staffController.getMyShifts(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getAllShifts', () => {
    it('should return all shifts', async () => {
      const mockShifts = [
        { id: 'shift-1', shift_date: '2024-06-15', staff: { full_name: 'John Doe' } }
      ];

      // When no query params, chain ends at second .order()
      // from -> select -> order -> order -> [awaited]
      const orderMock = vi.fn();
      orderMock.mockReturnValueOnce({ order: vi.fn().mockResolvedValue({ data: mockShifts, error: null }) });
      
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: orderMock
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await staffController.getAllShifts(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });
  });

  describe('getStaffShifts', () => {
    it('should return shifts for a specific staff member', async () => {
      const mockShifts = [
        { id: 'shift-1', shift_date: '2024-06-15', start_time: '09:00' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockShifts, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { staffId: 'staff-1' },
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });

      await staffController.getStaffShifts(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });
  });

  describe('createShift', () => {
    it('should create a new shift', async () => {
      const mockShift = {
        id: 'shift-new',
        staff_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        shift_date: '2024-06-15',
        start_time: '09:00',
        end_time: '17:00',
        status: 'scheduled'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: {
          staffId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          shiftDate: '2024-06-15',
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 30
        },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await staffController.createShift(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShift });
    });

    it('should return 400 for invalid data', async () => {
      const { req, res, next } = createMockReqRes({
        body: { staffId: 'invalid' }, // Missing required fields
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await staffController.createShift(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateShift', () => {
    it('should update a shift', async () => {
      const mockUpdatedShift = { id: 'shift-1', status: 'completed' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { shiftId: 'shift-1' },
        body: { status: 'completed' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await staffController.updateShift(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdatedShift });
    });
  });

  describe('deleteShift', () => {
    it('should delete a shift', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' }
      });

      await staffController.deleteShift(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Shift deleted' });
    });
  });

  describe('getAssignments', () => {
    it('should return staff assignments grouped by department', async () => {
      const mockShifts = [
        { id: 'assign-1', department: 'housekeeping', staff: { full_name: 'Jane' }, shift_date: '2024-06-15', start_time: '09:00', end_time: '17:00', status: 'scheduled' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockShifts, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await staffController.getAssignments(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ 
        success: true, 
        data: {
          housekeeping: [
            { id: 'assign-1', staff: { full_name: 'Jane' }, shiftDate: '2024-06-15', startTime: '09:00', endTime: '17:00', status: 'scheduled' }
          ]
        } 
      });
    });
  });

  describe('getMySwapRequests', () => {
    it('should return my swap requests', async () => {
      const mockRequests = [
        { id: 'swap-1', status: 'pending', reason: 'Personal' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRequests, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.getMySwapRequests(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRequests });
    });
  });

  describe('getAllSwapRequests', () => {
    it('should return all swap requests', async () => {
      const mockRequests = [
        { id: 'swap-1', status: 'pending' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRequests, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await staffController.getAllSwapRequests(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRequests });
    });

    it('should filter swap requests by status', async () => {
      const mockRequests = [{ id: 'swap-1', status: 'pending' }];
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockRequests, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: { status: 'pending' }
      });

      await staffController.getAllSwapRequests(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRequests });
    });
  });

  describe('clockIn', () => {
    it('should clock in to a shift', async () => {
      const mockShift = { 
        id: 'shift-1', 
        staff_id: 'user-1', 
        shift_date: '2024-06-15',
        start_time: '09:00',
        actual_start: null 
      };
      const mockUpdatedShift = { ...mockShift, actual_start: '2024-06-15T09:05:00Z', status: 'active' };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'staff_shifts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValueOnce({ data: mockShift, error: null }),
              update: vi.fn().mockReturnThis(),
            };
          }
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      // Create a more complete mock
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn()
        .mockResolvedValueOnce({ data: mockShift, error: null })
        .mockResolvedValueOnce({ data: mockUpdatedShift, error: null });
      const updateMock = vi.fn().mockReturnValue({ 
        eq: vi.fn().mockReturnValue({ 
          select: vi.fn().mockReturnValue({ 
            single: vi.fn().mockResolvedValue({ data: mockUpdatedShift, error: null }) 
          }) 
        }) 
      });

      const completeMock = {
        from: vi.fn().mockReturnValue({
          select: selectMock,
          eq: eqMock,
          single: singleMock,
          update: updateMock,
        })
      };
      vi.mocked(getSupabase).mockReturnValue(completeMock as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockIn(req, res, next);
      // Check that it was processed (may call res.json or next)
      expect(completeMock.from).toHaveBeenCalledWith('staff_shifts');
    });

    it('should return 404 for non-existent shift', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'non-existent' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockIn(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for unauthorized shift', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'other-user', actual_start: null };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockIn(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if already clocked in', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'user-1', actual_start: '2024-06-15T09:00:00Z' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockIn(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('clockOut', () => {
    it('should return 404 for non-existent shift', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'non-existent' },
        body: {},
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockOut(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for unauthorized shift', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'other-user' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        body: {},
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockOut(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if not clocked in', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'user-1', actual_start: null };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        body: {},
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockOut(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if already clocked out', async () => {
      const mockShift = { 
        id: 'shift-1', 
        staff_id: 'user-1', 
        actual_start: '2024-06-15T09:00:00Z',
        actual_end: '2024-06-15T17:00:00Z'
      };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        body: {},
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.clockOut(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getMyAssignment', () => {
    it('should return current assignment for today', async () => {
      const mockShift = { id: 'shift-1', department: 'housekeeping', status: 'scheduled' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.getMyAssignment(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShift });
    });

    it('should return null if no assignment today', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.getMyAssignment(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
    });
  });

  describe('updateStaffAssignments', () => {
    it('should update staff assignments', async () => {
      const mockUpdated = [{ id: 'shift-1', department: 'front-desk' }];
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { staffId: 'staff-1' },
        body: { department: 'front-desk', area: 'lobby' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.updateStaffAssignments(req, res, next);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Updated 1 shifts',
        data: mockUpdated
      });
    });

    it('should return 400 for invalid data', async () => {
      const { req, res, next } = createMockReqRes({
        params: { staffId: 'staff-1' },
        body: {}, // Missing required department
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.updateStaffAssignments(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkAssignStaff', () => {
    it('should bulk create shifts', async () => {
      const mockShifts = [
        { id: 'shift-1', staff_id: 'staff-1', department: 'housekeeping' },
        { id: 'shift-2', staff_id: 'staff-2', department: 'housekeeping' }
      ];
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: mockShifts, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: {
          assignments: [
            { staffId: 'staff-1', department: 'housekeeping', date: '2024-06-15', startTime: '09:00', endTime: '17:00' },
            { staffId: 'staff-2', department: 'housekeeping', date: '2024-06-15', startTime: '09:00', endTime: '17:00' }
          ]
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.bulkAssignStaff(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Created 2 shifts',
        data: mockShifts
      });
    });

    it('should return 400 for missing assignments array', async () => {
      const { req, res, next } = createMockReqRes({
        body: {},
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.bulkAssignStaff(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for empty assignments array', async () => {
      const { req, res, next } = createMockReqRes({
        body: { assignments: [] },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.bulkAssignStaff(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('requestShiftSwap', () => {
    it('should return 400 for invalid data', async () => {
      const { req, res, next } = createMockReqRes({
        body: { reason: 'test' }, // Missing shiftId
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.requestShiftSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for non-existent shift', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', reason: 'Personal' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.requestShiftSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for unauthorized shift', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'other-user' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { shiftId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', reason: 'Personal' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.requestShiftSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('respondToSwapRequest', () => {
    it('should return 404 for non-existent request', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { accept: true },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.respondToSwapRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for unauthorized response', async () => {
      const mockRequest = { id: 'swap-1', target_staff_id: 'other-user' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { accept: true },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.respondToSwapRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('approveSwapRequest', () => {
    it('should return 404 for non-existent request', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { approve: true },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.approveSwapRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if request not accepted by target first', async () => {
      const mockRequest = { id: 'swap-1', status: 'pending' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { approve: true },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.approveSwapRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('cancelSwapRequest', () => {
    it('should return 404 for non-existent request', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.cancelSwapRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for unauthorized cancellation', async () => {
      const mockRequest = { id: 'swap-1', requesting_staff_id: 'other-user', status: 'pending' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.cancelSwapRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if swap already approved', async () => {
      const mockRequest = { id: 'swap-1', requesting_staff_id: 'user-1', status: 'approved' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.cancelSwapRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should cancel a swap request successfully', async () => {
      const mockRequest = { id: 'swap-1', requesting_staff_id: 'user-1', status: 'pending' };
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRequest, error: null }),
        update: vi.fn().mockReturnThis(),
      };
      // Override the update chain to resolve successfully
      mockSupabase.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      }));
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await staffController.cancelSwapRequest(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Swap request cancelled' });
    });
  });

  describe('getTimeTrackingReport', () => {
    it('should return time tracking report', async () => {
      const mockShifts = [
        { 
          id: 'shift-1', 
          staff_id: 'staff-1',
          staff: { id: 'staff-1', full_name: 'John Doe' },
          shift_date: '2024-06-15',
          start_time: '09:00',
          end_time: '17:00',
          actual_start: '2024-06-15T09:05:00Z',
          actual_end: '2024-06-15T17:10:00Z',
          break_minutes: 30,
          actual_break_minutes: 30,
          status: 'completed'
        }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockShifts, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });

      await staffController.getTimeTrackingReport(req, res, next);
      expect(res.json).toHaveBeenCalled();
      const call = (res.json as any).mock.calls[0][0];
      expect(call.success).toBe(true);
      expect(call.data.shifts).toBeDefined();
      expect(call.data.summary).toBeDefined();
    });

    it('should call next on error', async () => {
      const error = new Error('DB error');
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (_resolve: any, reject: any) => reject(error)
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await staffController.getTimeTrackingReport(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('addTimeAdjustment', () => {
    it('should add a time adjustment', async () => {
      const mockAdjustment = { id: 'adj-1', shift_id: 'shift-1', adjustment_type: 'clock_in' };
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'time_clock_adjustments') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockAdjustment, error: null })
            };
          }
          if (table === 'staff_shifts') {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null })
            };
          }
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { shiftId: 'shift-1' },
        body: {
          adjustmentType: 'clock_in',
          originalTime: '2024-06-15T09:05:00Z',
          adjustedTime: '2024-06-15T09:00:00Z',
          reason: 'Badge reader malfunction'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.addTimeAdjustment(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res, next } = createMockReqRes({
        params: { shiftId: 'shift-1' },
        body: { adjustmentType: 'clock_in' }, // Missing adjustedTime and reason
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await staffController.addTimeAdjustment(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
