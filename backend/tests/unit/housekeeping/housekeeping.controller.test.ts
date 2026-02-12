/**
 * Housekeeping Controller Tests - Comprehensive
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createMockReqRes } from '../utils';

// Chainable Supabase mock with response queue
const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;
  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) return responseQueue[responseIndex++];
    return { data: null, error: null };
  };
  const builder: any = {};
  ['select','insert','update','delete','upsert','eq','neq','gt','gte','lt','lte','like','ilike','is','in','or','not','filter','match','order','limit','range','contains','csv','head'].forEach(m => {
    builder[m] = vi.fn().mockImplementation(() => builder);
  });
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);
  const mockRpc = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  return {
    queueResponse: (data: any, error: any = null, count?: number) => { responseQueue.push({ data, error, count }); },
    reset: () => { responseQueue = []; responseIndex = 0; },
    build: () => ({ from: vi.fn().mockReturnValue(builder), rpc: mockRpc }),
    mockRpc,
  };
};

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from '../../../src/database/connection.js';
import { HousekeepingController } from '../../../src/modules/housekeeping/housekeeping.controller';

describe('Housekeeping Controller', () => {
  let mockBuilder: ReturnType<typeof createChainableMock>;
  let controller: HousekeepingController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HousekeepingController();
    mockBuilder = createChainableMock();
    vi.mocked(getSupabase).mockReturnValue(mockBuilder.build() as any);
  });

  // ---- getTaskTypes ----
  describe('getTaskTypes', () => {
    it('should return task types', async () => {
      mockBuilder.queueResponse([{ id: 'tt1', name: 'Deep Clean', estimated_duration: 60 }]);
      const mocks = createMockReqRes();
      await controller.getTaskTypes(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith({ success: true, data: expect.any(Array) });
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'DB error' });
      const mocks = createMockReqRes();
      await controller.getTaskTypes(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- getTasks ----
  describe('getTasks', () => {
    it('should return paginated tasks', async () => {
      mockBuilder.queueResponse([{ id: 't1', status: 'pending', chalet_id: 'c1', task_type_id: 'tt1', assigned_to: 'u1' }]);
      mockBuilder.queueResponse([{ id: 'tt1', name: 'Deep Clean' }]); // task types
      mockBuilder.queueResponse([{ id: 'c1', name: 'Chalet A', number: '101' }]); // chalets
      mockBuilder.queueResponse([{ id: 'u1', full_name: 'John', email: 'john@test.com' }]); // users
      const mocks = createMockReqRes({ query: { page: '1', limit: '10', status: 'pending' } });
      await controller.getTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Array) }));
    });

    it('should filter by priority and assignedTo', async () => {
      mockBuilder.queueResponse([]);
      mockBuilder.queueResponse([]); mockBuilder.queueResponse([]); mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: { priority: 'high', assignedTo: 'u1', chaletId: 'c1', date: '2024-01-15' } });
      await controller.getTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should filter unassigned tasks', async () => {
      mockBuilder.queueResponse([]);
      mockBuilder.queueResponse([]); mockBuilder.queueResponse([]); mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: { unassigned: 'true' } });
      await controller.getTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'DB error' });
      const mocks = createMockReqRes({ query: {} });
      await controller.getTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- getMyTasks ----
  describe('getMyTasks', () => {
    it('should return tasks for current user', async () => {
      mockBuilder.queueResponse([{ id: 't1', task_type_id: 'tt1', chalet_id: 'c1' }]);
      mockBuilder.queueResponse([{ id: 'tt1', name: 'Clean' }]);
      mockBuilder.queueResponse([{ id: 'c1', name: 'Chalet A', number: '101' }]);
      const mocks = createMockReqRes({ query: {} });
      (mocks.req as any).user = { id: 'u1' };
      await controller.getMyTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should filter by status', async () => {
      mockBuilder.queueResponse([]);
      mockBuilder.queueResponse([]); mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: { status: 'in_progress' } });
      (mocks.req as any).user = { id: 'u1' };
      await controller.getMyTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'error' });
      const mocks = createMockReqRes({ query: {} });
      (mocks.req as any).user = { id: 'u1' };
      await controller.getMyTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- getTask ----
  describe('getTask', () => {
    it('should return a single task with enrichment', async () => {
      mockBuilder.queueResponse({ id: 't1', task_type_id: 'tt1', chalet_id: 'c1', assigned_to: 'u1', created_by: 'u2' }); // task (single)
      mockBuilder.queueResponse({ id: 'tt1', name: 'Deep Clean', estimated_duration: 60, checklist: ['mop'] }); // type (single)
      mockBuilder.queueResponse({ id: 'c1', name: 'Chalet A', number: '101' }); // chalet (single)
      mockBuilder.queueResponse({ id: 'u1', full_name: 'John' }); // assignee (single)
      mockBuilder.queueResponse({ id: 'u2', full_name: 'Admin' }); // creator (single)
      mockBuilder.queueResponse([{ id: 'l1', action: 'created', performed_by: 'u2', created_at: '2024-01-15T10:00:00Z' }]); // logs
      mockBuilder.queueResponse([{ id: 'u2', full_name: 'Admin' }]); // log users
      const mocks = createMockReqRes({ params: { id: 't1' } });
      await controller.getTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for non-existent task', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' }); // single() returns error
      const mocks = createMockReqRes({ params: { id: 'nonexistent' } });
      await controller.getTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- createTask ----
  describe('createTask', () => {
    it('should create a task', async () => {
      mockBuilder.queueResponse({ id: 'tt1', name: 'Clean', estimated_duration: 30 }); // task type
      mockBuilder.queueResponse({ id: 't1', status: 'pending' }); // insert (single)
      mockBuilder.queueResponse(null); // log insert
      const mocks = createMockReqRes({
        body: { taskTypeId: '00000000-0000-0000-0000-000000000001', chaletId: '00000000-0000-0000-0000-000000000002', priority: 'normal', notes: 'Test' },
      });
      (mocks.req as any).user = { id: 'u1' };
      await controller.createTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      (mocks.req as any).user = { id: 'u1' };
      await controller.createTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'DB error' }); // task type lookup throws
      const mocks = createMockReqRes({
        body: { taskTypeId: '00000000-0000-0000-0000-000000000001', priority: 'normal' },
      });
      (mocks.req as any).user = { id: 'u1' };
      await controller.createTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- updateTask ----
  describe('updateTask', () => {
    it('should update a task', async () => {
      mockBuilder.queueResponse({ id: 't1', status: 'in_progress' }); // update (single)
      mockBuilder.queueResponse(null); // log insert for status change
      const mocks = createMockReqRes({ params: { id: 't1' }, body: { status: 'in_progress', notes: 'Updated' } });
      (mocks.req as any).user = { id: '00000000-0000-0000-0000-000000000001' };
      await controller.updateTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for no fields to update', async () => {
      const mocks = createMockReqRes({ params: { id: 't1' }, body: {} });
      (mocks.req as any).user = { id: 'u1' };
      await controller.updateTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if task not found', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' }); // update returns error
      const mocks = createMockReqRes({ params: { id: 'nope' }, body: { notes: 'test' } });
      (mocks.req as any).user = { id: 'u1' };
      await controller.updateTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- assignTask ----
  describe('assignTask', () => {
    it('should assign a task to staff', async () => {
      mockBuilder.queueResponse({ id: 't1', assigned_to: '00000000-0000-0000-0000-000000000002' }); // update (single)
      mockBuilder.queueResponse({ id: '00000000-0000-0000-0000-000000000002', full_name: 'Staff' }); // user lookup (single)
      mockBuilder.queueResponse(null); // log insert
      const mocks = createMockReqRes({ params: { id: 't1' }, body: { staffId: '00000000-0000-0000-0000-000000000002' } });
      (mocks.req as any).user = { id: '00000000-0000-0000-0000-000000000001' };
      await controller.assignTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ params: { id: 't1' }, body: {} });
      (mocks.req as any).user = { id: 'u1' };
      await controller.assignTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if task not found', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ params: { id: 'nope' }, body: { staffId: '00000000-0000-0000-0000-000000000002' } });
      (mocks.req as any).user = { id: '00000000-0000-0000-0000-000000000001' };
      await controller.assignTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- startTask ----
  describe('startTask', () => {
    it('should start a task assigned to user', async () => {
      mockBuilder.queueResponse({ id: 't1', assigned_to: 'u1', status: 'pending' }); // existing (single)
      mockBuilder.queueResponse({ id: 't1', status: 'in_progress' }); // update (single)
      mockBuilder.queueResponse(null); // log
      const mocks = createMockReqRes({ params: { id: 't1' } });
      (mocks.req as any).user = { id: 'u1', roles: ['staff'] };
      await controller.startTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should allow admin to start any task', async () => {
      mockBuilder.queueResponse({ id: 't1', assigned_to: 'u2', status: 'pending' });
      mockBuilder.queueResponse({ id: 't1', status: 'in_progress' });
      mockBuilder.queueResponse(null);
      const mocks = createMockReqRes({ params: { id: 't1' } });
      (mocks.req as any).user = { id: 'u1', roles: ['admin'] };
      await controller.startTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for non-existent task', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ params: { id: 'nope' } });
      (mocks.req as any).user = { id: 'u1', roles: ['staff'] };
      await controller.startTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not assigned', async () => {
      mockBuilder.queueResponse({ id: 't1', assigned_to: 'other', status: 'pending' });
      const mocks = createMockReqRes({ params: { id: 't1' } });
      (mocks.req as any).user = { id: 'u1', roles: ['staff'] };
      await controller.startTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(403);
    });
  });

  // ---- completeTask ----
  describe('completeTask', () => {
    it('should complete a task', async () => {
      mockBuilder.queueResponse({ id: 't1', assigned_to: 'u1', status: 'in_progress' });
      mockBuilder.queueResponse({ id: 't1', status: 'completed' });
      mockBuilder.queueResponse(null);
      const mocks = createMockReqRes({
        params: { id: 't1' },
        body: { notes: 'Done', checklistCompleted: { mop: true, vacuum: true } },
      });
      (mocks.req as any).user = { id: 'u1', roles: ['staff'] };
      await controller.completeTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for non-existent task', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ params: { id: 'nope' }, body: {} });
      (mocks.req as any).user = { id: 'u1', roles: ['staff'] };
      await controller.completeTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not assigned', async () => {
      mockBuilder.queueResponse({ id: 't1', assigned_to: 'other', status: 'in_progress' });
      const mocks = createMockReqRes({ params: { id: 't1' }, body: {} });
      (mocks.req as any).user = { id: 'u1', roles: ['staff'] };
      await controller.completeTask(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(403);
    });
  });

  // ---- reportIssue ----
  describe('reportIssue', () => {
    it('should report an issue', async () => {
      mockBuilder.queueResponse({ id: 't1' }); // update (single)
      mockBuilder.queueResponse(null); // log
      const mocks = createMockReqRes({
        params: { id: 't1' },
        body: { issueType: 'maintenance', notes: 'Broken pipe' },
      });
      (mocks.req as any).user = { id: 'u1' };
      await controller.reportIssue(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ params: { id: 't1' }, body: { issueType: 'damage' } });
      (mocks.req as any).user = { id: 'u1' };
      await controller.reportIssue(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- getSchedules ----
  describe('getSchedules', () => {
    it('should return schedules with enrichment', async () => {
      mockBuilder.queueResponse([{ id: 's1', task_type_id: 'tt1', chalet_id: 'c1', assigned_to: 'u1' }]);
      mockBuilder.queueResponse([{ id: 'tt1', name: 'Clean' }]);
      mockBuilder.queueResponse([{ id: 'c1', name: 'Chalet A' }]);
      mockBuilder.queueResponse([{ id: 'u1', full_name: 'John' }]);
      const mocks = createMockReqRes({ query: {} });
      await controller.getSchedules(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should filter by chaletId and dayOfWeek', async () => {
      mockBuilder.queueResponse([]);
      mockBuilder.queueResponse([]); mockBuilder.queueResponse([]); mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: { chaletId: 'c1', dayOfWeek: '1', isActive: 'true' } });
      await controller.getSchedules(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'error' });
      const mocks = createMockReqRes({ query: {} });
      await controller.getSchedules(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- createSchedule ----
  describe('createSchedule', () => {
    it('should create a schedule', async () => {
      mockBuilder.queueResponse({ id: 's1' }); // insert (single)
      const mocks = createMockReqRes({
        body: { taskTypeId: '00000000-0000-0000-0000-000000000001', timeSlot: '09:00' },
      });
      (mocks.req as any).user = { id: 'u1' };
      await controller.createSchedule(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for invalid body', async () => {
      const mocks = createMockReqRes({ body: {} });
      (mocks.req as any).user = { id: 'u1' };
      await controller.createSchedule(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });
  });

  // ---- updateSchedule ----
  describe('updateSchedule', () => {
    it('should update a schedule', async () => {
      mockBuilder.queueResponse({ id: 's1' }); // update (single)
      const mocks = createMockReqRes({ params: { id: 's1' }, body: { timeSlot: '10:00', isActive: false } });
      await controller.updateSchedule(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for empty body', async () => {
      const mocks = createMockReqRes({ params: { id: 's1' }, body: {} });
      await controller.updateSchedule(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if schedule not found', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });
      const mocks = createMockReqRes({ params: { id: 'nope' }, body: { timeSlot: '10:00' } });
      await controller.updateSchedule(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- deleteSchedule ----
  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      mockBuilder.queueResponse(null);
      const mocks = createMockReqRes({ params: { id: 's1' } });
      await controller.deleteSchedule(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'error' });
      const mocks = createMockReqRes({ params: { id: 's1' } });
      await controller.deleteSchedule(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- generateScheduledTasks ----
  describe('generateScheduledTasks', () => {
    it('should generate tasks from schedules', async () => {
      mockBuilder.queueResponse([{ id: 's1', chalet_id: 'c1', task_type_id: 'tt1', assigned_to: 'u1', day_of_week: 1, time_slot: '09:00' }]);
      mockBuilder.queueResponse([]); // existing tasks (empty = no dups)
      mockBuilder.queueResponse({ id: 't1' }); // insert (single)
      const mocks = createMockReqRes();
      await controller.generateScheduledTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle no active schedules', async () => {
      mockBuilder.queueResponse([]);
      const mocks = createMockReqRes();
      await controller.generateScheduledTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'error' });
      const mocks = createMockReqRes();
      await controller.generateScheduledTasks(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- getStats ----
  describe('getStats', () => {
    it('should return stats', async () => {
      mockBuilder.queueResponse([
        { id: 't1', status: 'pending', priority: 'high', assigned_to: 'u1', created_at: '2024-01-15T10:00:00Z', completed_at: null },
        { id: 't2', status: 'completed', priority: 'medium', assigned_to: 'u1', created_at: '2024-01-15T08:00:00Z', completed_at: '2024-01-15T09:00:00Z' },
      ]);
      mockBuilder.queueResponse([{ id: 'u1', full_name: 'John' }]); // staff names
      const mocks = createMockReqRes({ query: { period: '7' } });
      await controller.getStats(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ summary: expect.any(Object) }),
      }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'error' });
      const mocks = createMockReqRes({ query: {} });
      await controller.getStats(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---- getAvailableStaff ----
  describe('getAvailableStaff', () => {
    it('should return available staff', async () => {
      mockBuilder.queueResponse([{ id: 'r1', name: 'housekeeping' }]); // roles
      mockBuilder.queueResponse([{ user_id: 'u1', role_id: 'r1' }]); // user_roles
      mockBuilder.queueResponse([{ id: 'u1', full_name: 'John', email: 'john@test.com' }]); // users
      mockBuilder.queueResponse([{ assigned_to: 'u1', id: 'task1' }]); // active tasks
      const mocks = createMockReqRes();
      await controller.getAvailableStaff(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes();
      await controller.getAvailableStaff(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });
});
