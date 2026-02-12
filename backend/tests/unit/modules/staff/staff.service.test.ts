import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pattern for chainable Supabase queries
function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'range'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// Mock dependencies
vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

import * as staffController from '../../../../src/modules/staff/staff.controller';
import { getSupabase } from '../../../../src/database/connection.js';
import { logActivity } from '../../../../src/utils/activityLogger.js';

// Helper to create mock req/res
function createMockReqRes(overrides: Record<string, unknown> = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    user: { userId: 'user-123', role: 'staff' },
    ...overrides
  };
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('Staff Controller - Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Shifts Management
  // ============================================
  describe('getMyShifts', () => {
    it('should return shifts for the current user', async () => {
      const mockShifts = [
        { id: 'shift-1', staff_id: 'user-123', shift_date: '2024-06-15', start_time: '09:00', end_time: '17:00' },
        { id: 'shift-2', staff_id: 'user-123', shift_date: '2024-06-16', start_time: '09:00', end_time: '17:00' }
      ];

      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await staffController.getMyShifts(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });

    it('should filter shifts by date range', async () => {
      const mockShifts = [{ id: 'shift-1', shift_date: '2024-06-15' }];
      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });
      await staffController.getMyShifts(req as any, res as any, next);

      expect(mockQuery.gte).toHaveBeenCalledWith('shift_date', '2024-06-01');
      expect(mockQuery.lte).toHaveBeenCalledWith('shift_date', '2024-06-30');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      const mockQuery = createQueryMock(() => { throw error; });
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes();
      await staffController.getMyShifts(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getAllShifts', () => {
    it('should return all shifts with staff info', async () => {
      const mockShifts = [
        { id: 'shift-1', shift_date: '2024-06-15', staff: { id: 'staff-1', full_name: 'John Doe', email: 'john@test.com' } }
      ];

      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await staffController.getAllShifts(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });

    it('should filter by department', async () => {
      const mockShifts = [{ id: 'shift-1', department: 'housekeeping' }];
      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: { department: 'housekeeping' } });
      await staffController.getAllShifts(req as any, res as any, next);

      expect(mockQuery.eq).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });

    it('should filter by staff and status', async () => {
      const mockShifts = [{ id: 'shift-1', staff_id: 'staff-1', status: 'active' }];
      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ 
        query: { staffId: 'staff-1', status: 'active' } 
      });
      await staffController.getAllShifts(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });
  });

  describe('getStaffShifts', () => {
    it('should return shifts for a specific staff member', async () => {
      const mockShifts = [
        { id: 'shift-1', staff_id: 'staff-123', shift_date: '2024-06-15' }
      ];

      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        params: { staffId: 'staff-123' },
        query: {}
      });
      await staffController.getStaffShifts(req as any, res as any, next);

      expect(mockQuery.eq).toHaveBeenCalledWith('staff_id', 'staff-123');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockShifts });
    });

    it('should filter by date range', async () => {
      const mockShifts = [{ id: 'shift-1' }];
      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        params: { staffId: 'staff-123' },
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });
      await staffController.getStaffShifts(req as any, res as any, next);

      expect(mockQuery.gte).toHaveBeenCalledWith('shift_date', '2024-06-01');
      expect(mockQuery.lte).toHaveBeenCalledWith('shift_date', '2024-06-30');
    });
  });

  describe('createShift', () => {
    it('should create a new shift with valid data', async () => {
      const shiftData = {
        staffId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        shiftDate: '2024-06-15',
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 30,
        department: 'restaurant'
      };

      const mockCreatedShift = {
        id: 'shift-new',
        staff_id: shiftData.staffId,
        shift_date: shiftData.shiftDate,
        start_time: shiftData.startTime,
        end_time: shiftData.endTime,
        break_minutes: shiftData.breakMinutes,
        department: shiftData.department
      };

      const mockQuery = createQueryMock(() => [mockCreatedShift]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        body: shiftData,
        user: { userId: 'admin-1', role: 'admin' }
      });
      await staffController.createShift(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(logActivity).toHaveBeenCalled();
    });

    it('should return 400 for invalid staffId (not UUID)', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          staffId: 'invalid-uuid',
          shiftDate: '2024-06-15',
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      await staffController.createShift(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 400 for invalid date format', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          staffId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          shiftDate: 'invalid-date',
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      await staffController.createShift(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res, next } = createMockReqRes({
        body: { staffId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }
      });
      await staffController.createShift(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateShift', () => {
    it('should update a shift', async () => {
      const mockUpdatedShift = { id: 'shift-1', status: 'completed', department: 'restaurant' };
      const mockQuery = createQueryMock(() => [mockUpdatedShift]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        body: { status: 'completed', department: 'restaurant' }
      });
      await staffController.updateShift(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should update overtime approval', async () => {
      const mockUpdatedShift = { id: 'shift-1', overtime_approved: true };
      const mockQuery = createQueryMock(() => [mockUpdatedShift]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        body: { overtimeApproved: true }
      });
      await staffController.updateShift(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid status', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        body: { status: 'invalid-status' }
      });
      await staffController.updateShift(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteShift', () => {
    it('should delete a shift', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ params: { id: 'shift-1' } });
      await staffController.deleteShift(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Shift deleted' });
    });

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed');
      const mockQuery = createQueryMock(() => []);
      mockQuery.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(error)
      });
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ params: { id: 'shift-1' } });
      await staffController.deleteShift(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============================================
  // Clock In/Out
  // ============================================
  describe('clockIn', () => {
    it('should clock in to a shift', async () => {
      const mockShift = {
        id: 'shift-1',
        staff_id: 'user-123',
        shift_date: '2024-06-15',
        start_time: '09:00',
        actual_start: null
      };

      const selectMock = createQueryMock(() => [mockShift]);
      const updateMock = {
        actual_start: expect.any(String),
        status: 'active'
      };
      
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'staff_shifts') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ 
                      data: { ...mockShift, status: 'active', actual_start: new Date().toISOString() }, 
                      error: null 
                    })
                  })
                })
              })
            };
          }
          return selectMock;
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'user-123' }
      });
      await staffController.clockIn(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 if shift not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'nonexistent-shift' },
        user: { userId: 'user-123' }
      });
      await staffController.clockIn(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if shift belongs to another user', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'other-user' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'user-123' }
      });
      await staffController.clockIn(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if already clocked in', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'user-123', actual_start: '2024-06-15T09:00:00Z' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'user-123' }
      });
      await staffController.clockIn(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Already clocked in' });
    });
  });

  describe('clockOut', () => {
    it('should clock out of a shift', async () => {
      const mockShift = {
        id: 'shift-1',
        staff_id: 'user-123',
        actual_start: '2024-06-15T09:00:00Z',
        actual_end: null,
        break_minutes: 30
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { ...mockShift, status: 'completed', actual_end: new Date().toISOString() }, 
                  error: null 
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        body: { breakMinutes: 45 },
        user: { userId: 'user-123' }
      });
      await staffController.clockOut(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 if not clocked in', async () => {
      const mockShift = { id: 'shift-1', staff_id: 'user-123', actual_start: null };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'user-123' }
      });
      await staffController.clockOut(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not clocked in' });
    });

    it('should return 400 if already clocked out', async () => {
      const mockShift = { 
        id: 'shift-1', 
        staff_id: 'user-123', 
        actual_start: '2024-06-15T09:00:00Z',
        actual_end: '2024-06-15T17:00:00Z'
      };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'shift-1' },
        user: { userId: 'user-123' }
      });
      await staffController.clockOut(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Already clocked out' });
    });
  });

  // ============================================
  // Assignments
  // ============================================
  describe('getAssignments', () => {
    it('should return assignments grouped by department', async () => {
      const mockShifts = [
        { id: 'shift-1', department: 'housekeeping', staff: { full_name: 'Jane' }, shift_date: '2024-06-15', start_time: '09:00', end_time: '17:00', status: 'scheduled' },
        { id: 'shift-2', department: 'restaurant', staff: { full_name: 'John' }, shift_date: '2024-06-15', start_time: '08:00', end_time: '16:00', status: 'scheduled' }
      ];

      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await staffController.getAssignments(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          housekeeping: [expect.objectContaining({ id: 'shift-1' })],
          restaurant: [expect.objectContaining({ id: 'shift-2' })]
        }
      });
    });

    it('should filter by department', async () => {
      const mockShifts = [
        { id: 'shift-1', department: 'housekeeping', staff: { full_name: 'Jane' }, shift_date: '2024-06-15', start_time: '09:00', end_time: '17:00', status: 'scheduled' }
      ];

      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: { department: 'housekeeping' } });
      await staffController.getAssignments(req as any, res as any, next);

      expect(mockQuery.eq).toHaveBeenCalled();
    });

    it('should filter by date', async () => {
      const mockShifts = [];
      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: { date: '2024-06-15' } });
      await staffController.getAssignments(req as any, res as any, next);

      expect(mockQuery.eq).toHaveBeenCalled();
    });
  });

  describe('getMyAssignment', () => {
    it('should return current user assignment for today', async () => {
      const mockAssignment = { 
        id: 'shift-1', 
        staff_id: 'user-123', 
        department: 'housekeeping',
        status: 'scheduled'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({ data: mockAssignment, error: null })
                    })
                  })
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({ user: { userId: 'user-123' } });
      await staffController.getMyAssignment(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockAssignment });
    });

    it('should return null if no assignment exists', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                    })
                  })
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({ user: { userId: 'user-123' } });
      await staffController.getMyAssignment(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
    });
  });

  describe('updateStaffAssignments', () => {
    it('should update future assignments for a staff member', async () => {
      const mockUpdated = [
        { id: 'shift-1', department: 'restaurant' },
        { id: 'shift-2', department: 'restaurant' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { staffId: 'staff-123' },
        body: { department: 'restaurant', area: 'main floor' }
      });
      await staffController.updateStaffAssignments(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: true,
        message: 'Updated 2 shifts'
      }));
      expect(logActivity).toHaveBeenCalled();
    });

    it('should return 400 for missing department', async () => {
      const { req, res, next } = createMockReqRes({
        params: { staffId: 'staff-123' },
        body: {}
      });
      await staffController.updateStaffAssignments(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkAssignStaff', () => {
    it('should create multiple shifts at once', async () => {
      const assignments = [
        { staffId: 'staff-1', department: 'restaurant', date: '2024-06-15', startTime: '09:00', endTime: '17:00' },
        { staffId: 'staff-2', department: 'housekeeping', date: '2024-06-15', startTime: '08:00', endTime: '16:00' }
      ];

      const mockCreated = [
        { id: 'shift-1', ...assignments[0] },
        { id: 'shift-2', ...assignments[1] }
      ];

      const mockQuery = createQueryMock(() => mockCreated);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        body: { assignments },
        user: { userId: 'admin-1' }
      });
      await staffController.bulkAssignStaff(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for empty assignments array', async () => {
      const { req, res, next } = createMockReqRes({
        body: { assignments: [] }
      });
      await staffController.bulkAssignStaff(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing assignments', async () => {
      const { req, res, next } = createMockReqRes({
        body: {}
      });
      await staffController.bulkAssignStaff(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============================================
  // Shift Swap Workflow
  // ============================================
  describe('requestShiftSwap', () => {
    const validShiftId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    
    it('should create a swap request', async () => {
      const mockShift = { id: validShiftId, staff_id: 'user-123' };
      const mockSwapRequest = {
        id: 'swap-1',
        original_shift_id: validShiftId,
        requesting_staff_id: 'user-123',
        reason: 'Personal',
        status: 'pending'
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'staff_shifts') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
                })
              })
            };
          }
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockSwapRequest, error: null })
              })
            })
          };
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { shiftId: validShiftId, reason: 'Personal' },
        user: { userId: 'user-123' }
      });
      await staffController.requestShiftSwap(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 404 if shift not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { shiftId: validShiftId, reason: 'Personal' },
        user: { userId: 'user-123' }
      });
      await staffController.requestShiftSwap(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if shift belongs to another user', async () => {
      const mockShift = { id: validShiftId, staff_id: 'other-user' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockShift, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { shiftId: validShiftId, reason: 'Personal' },
        user: { userId: 'user-123' }
      });
      await staffController.requestShiftSwap(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for missing reason', async () => {
      const { req, res, next } = createMockReqRes({
        body: { shiftId: validShiftId },
        user: { userId: 'user-123' }
      });
      await staffController.requestShiftSwap(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getMySwapRequests', () => {
    it('should return swap requests for current user', async () => {
      const mockRequests = [
        { id: 'swap-1', status: 'pending', original_shift: { shift_date: '2024-06-15' } },
        { id: 'swap-2', status: 'accepted', original_shift: { shift_date: '2024-06-20' } }
      ];

      const mockQuery = createQueryMock(() => mockRequests);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ user: { userId: 'user-123' } });
      await staffController.getMySwapRequests(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRequests });
    });
  });

  describe('getAllSwapRequests', () => {
    it('should return all swap requests', async () => {
      const mockRequests = [
        { id: 'swap-1', status: 'pending', requester: { full_name: 'John' } }
      ];

      const mockQuery = createQueryMock(() => mockRequests);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await staffController.getAllSwapRequests(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRequests });
    });

    it('should filter by status', async () => {
      const mockRequests = [{ id: 'swap-1', status: 'pending' }];
      const mockQuery = createQueryMock(() => mockRequests);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({ query: { status: 'pending' } });
      await staffController.getAllSwapRequests(req as any, res as any, next);

      expect(mockQuery.eq).toHaveBeenCalled();
    });
  });

  describe('respondToSwapRequest', () => {
    it('should accept a swap request', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        target_staff_id: 'user-123',
        status: 'pending'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { ...mockRequest, status: 'accepted', accepted_by: 'user-123' }, 
                  error: null 
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { accept: true },
        user: { userId: 'user-123' }
      });
      await staffController.respondToSwapRequest(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should decline a swap request', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        target_staff_id: 'user-123',
        status: 'pending'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { ...mockRequest, status: 'rejected' }, 
                  error: null 
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { accept: false },
        user: { userId: 'user-123' }
      });
      await staffController.respondToSwapRequest(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: true,
        message: 'Swap request declined'
      }));
    });

    it('should return 404 if swap request not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'nonexistent' },
        body: { accept: true },
        user: { userId: 'user-123' }
      });
      await staffController.respondToSwapRequest(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        target_staff_id: 'other-user',
        status: 'pending'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { accept: true },
        user: { userId: 'user-123' }
      });
      await staffController.respondToSwapRequest(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('approveSwapRequest', () => {
    it('should approve an accepted swap request', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        status: 'accepted',
        accepted_by: 'target-user',
        original_shift_id: 'shift-1',
        original_shift: { id: 'shift-1' }
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'shift_swap_requests') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ 
                      data: { ...mockRequest, status: 'approved', approved_by: 'manager-1' }, 
                      error: null 
                    })
                  })
                })
              })
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          };
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { approve: true },
        user: { userId: 'manager-1' }
      });
      await staffController.approveSwapRequest(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: true,
        message: 'Shift swap approved and completed'
      }));
    });

    it('should reject a swap request', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        status: 'accepted',
        accepted_by: 'target-user'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { ...mockRequest, status: 'rejected' }, 
                  error: null 
                })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { approve: false },
        user: { userId: 'manager-1' }
      });
      await staffController.approveSwapRequest(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: true,
        message: 'Shift swap rejected by manager'
      }));
    });

    it('should return 400 if request not yet accepted', async () => {
      const mockRequest = { id: 'swap-1', status: 'pending' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        body: { approve: true },
        user: { userId: 'manager-1' }
      });
      await staffController.approveSwapRequest(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('cancelSwapRequest', () => {
    it('should cancel a swap request', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        requesting_staff_id: 'user-123',
        status: 'pending'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        user: { userId: 'user-123' }
      });
      await staffController.cancelSwapRequest(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Swap request cancelled' });
    });

    it('should return 403 if cancelling others request', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        requesting_staff_id: 'other-user',
        status: 'pending'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        user: { userId: 'user-123' }
      });
      await staffController.cancelSwapRequest(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if swap already approved', async () => {
      const mockRequest = { 
        id: 'swap-1', 
        requesting_staff_id: 'user-123',
        status: 'approved'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRequest, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'swap-1' },
        user: { userId: 'user-123' }
      });
      await staffController.cancelSwapRequest(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============================================
  // Time Tracking
  // ============================================
  describe('getTimeTrackingReport', () => {
    it('should return time tracking report with summaries', async () => {
      const mockShifts = [
        {
          id: 'shift-1',
          staff_id: 'staff-1',
          staff: { id: 'staff-1', full_name: 'John Doe' },
          shift_date: '2024-06-15',
          start_time: '09:00',
          end_time: '17:00',
          actual_start: '2024-06-15T09:05:00Z',
          actual_end: '2024-06-15T17:30:00Z',
          break_minutes: 30,
          actual_break_minutes: 30,
          status: 'completed'
        }
      ];

      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });
      await staffController.getTimeTrackingReport(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          shifts: mockShifts,
          summary: expect.any(Array)
        })
      }));
    });

    it('should filter by staff member', async () => {
      const mockShifts = [];
      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        query: { staffId: 'staff-1' }
      });
      await staffController.getTimeTrackingReport(req as any, res as any, next);

      expect(mockQuery.eq).toHaveBeenCalled();
    });

    it('should filter by department', async () => {
      const mockShifts = [];
      const mockQuery = createQueryMock(() => mockShifts);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any);

      const { req, res, next } = createMockReqRes({
        query: { department: 'restaurant' }
      });
      await staffController.getTimeTrackingReport(req as any, res as any, next);

      expect(mockQuery.eq).toHaveBeenCalled();
    });
  });

  describe('addTimeAdjustment', () => {
    it('should add a time adjustment to a shift', async () => {
      const mockAdjustment = {
        id: 'adj-1',
        shift_id: 'shift-1',
        adjustment_type: 'clock_in',
        original_time: '2024-06-15T09:15:00Z',
        adjusted_time: '2024-06-15T09:00:00Z',
        reason: 'Badge reader malfunction'
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'time_clock_adjustments') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdjustment, error: null })
                })
              })
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          };
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { shiftId: 'shift-1' },
        body: {
          adjustmentType: 'clock_in',
          originalTime: '2024-06-15T09:15:00Z',
          adjustedTime: '2024-06-15T09:00:00Z',
          reason: 'Badge reader malfunction'
        },
        user: { userId: 'manager-1' }
      });
      await staffController.addTimeAdjustment(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res, next } = createMockReqRes({
        params: { shiftId: 'shift-1' },
        body: { adjustmentType: 'clock_in' }
      });
      await staffController.addTimeAdjustment(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should update shift actual_start for clock_in adjustment', async () => {
      const mockAdjustment = {
        id: 'adj-1',
        adjustment_type: 'clock_in',
        adjusted_time: '2024-06-15T09:00:00Z'
      };

      let staffShiftUpdateCalled = false;
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'time_clock_adjustments') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdjustment, error: null })
                })
              })
            };
          }
          staffShiftUpdateCalled = true;
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          };
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { shiftId: 'shift-1' },
        body: {
          adjustmentType: 'clock_in',
          adjustedTime: '2024-06-15T09:00:00Z',
          reason: 'Correction'
        }
      });
      await staffController.addTimeAdjustment(req as any, res as any, next);

      expect(staffShiftUpdateCalled).toBe(true);
    });

    it('should update shift actual_end for clock_out adjustment', async () => {
      const mockAdjustment = {
        id: 'adj-1',
        adjustment_type: 'clock_out',
        adjusted_time: '2024-06-15T17:00:00Z'
      };

      let staffShiftUpdateCalled = false;
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'time_clock_adjustments') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdjustment, error: null })
                })
              })
            };
          }
          staffShiftUpdateCalled = true;
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          };
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { shiftId: 'shift-1' },
        body: {
          adjustmentType: 'clock_out',
          adjustedTime: '2024-06-15T17:00:00Z',
          reason: 'Correction'
        }
      });
      await staffController.addTimeAdjustment(req as any, res as any, next);

      expect(staffShiftUpdateCalled).toBe(true);
    });
  });
});
