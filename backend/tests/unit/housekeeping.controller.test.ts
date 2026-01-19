import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// Create a properly chainable Supabase mock
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
  
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
  ];
  
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

  return {
    builder,
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => {
      responseQueue = [];
      responseIndex = 0;
    },
  };
};

let mockBuilder: ReturnType<typeof createChainableMock>;
const mockFrom = vi.fn();

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { HousekeepingController } from '../../src/modules/housekeeping/housekeeping.controller';

describe('Housekeeping Controller', () => {
  let controller: HousekeepingController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    controller = new HousekeepingController();
    responseJson = {};
    responseStatus = 200;
    
    mockResponse = {
      status: vi.fn().mockImplementation((code) => {
        responseStatus = code;
        return mockResponse;
      }),
      json: vi.fn().mockImplementation((data) => {
        responseJson = data;
        return mockResponse;
      }),
    };
    
    mockRequest = {
      user: { id: 'staff-123', role: 'staff' },
      params: {},
      query: {},
      body: {},
    };
    
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    vi.clearAllMocks();
    mockFrom.mockReturnValue(mockBuilder.builder);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockBuilder.reset();
  });

  describe('getTaskTypes', () => {
    it('should return all task types', async () => {
      const mockTaskTypes = [
        { id: 'type-1', name: 'Room Cleaning', estimated_duration: 45, is_active: true },
        { id: 'type-2', name: 'Bed Making', estimated_duration: 15, is_active: true },
      ];

      mockBuilder.queueResponse(mockTaskTypes, null);

      await controller.getTaskTypes(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockFrom).toHaveBeenCalledWith('housekeeping_task_types');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTaskTypes,
      });
    });

    it('should handle database errors', async () => {
      mockBuilder.queueResponse(null, { message: 'Database error' });

      await controller.getTaskTypes(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTasks', () => {
    it('should return paginated tasks', async () => {
      mockRequest.query = { page: '1', limit: '10' };

      const mockTasks = [
        { id: 'task-1', status: 'pending', priority: 'high' },
        { id: 'task-2', status: 'in_progress', priority: 'normal' },
      ];

      mockBuilder.queueResponse(mockTasks, null, 50);

      await controller.getTasks(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
      expect(responseJson.data).toEqual(mockTasks);
    });

    it('should filter by status', async () => {
      mockRequest.query = { status: 'pending' };

      mockBuilder.queueResponse([{ id: 'task-1', status: 'pending' }], null, 10);

      await controller.getTasks(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      mockRequest.body = {
        taskTypeId: 'type-1',
        chaletId: 'chalet-1',
        priority: 'high',
        notes: 'Deep clean needed',
      };

      const createdTask = {
        id: 'task-new',
        task_type_id: 'type-1',
        chalet_id: 'chalet-1',
        status: 'pending',
        priority: 'high',
        notes: 'Deep clean needed',
      };

      mockBuilder.queueResponse(createdTask, null);

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson.success).toBe(true);
    });

    it('should reject invalid priority', async () => {
      mockRequest.body = {
        taskTypeId: 'type-1',
        priority: 'invalid',
      };

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseJson.error).toBe('Validation failed');
    });
  });

  describe('assignTask', () => {
    it('should assign task to staff', async () => {
      mockRequest.params = { id: 'task-1' };
      mockRequest.body = { staffId: 'staff-456' };

      const updatedTask = {
        id: 'task-1',
        status: 'pending',
        assigned_to: 'staff-456',
      };

      mockBuilder.queueResponse(updatedTask, null);

      await controller.assignTask(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });

    it('should return 404 for non-existent task', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { staffId: 'staff-456' };

      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      await controller.assignTask(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      mockRequest.params = { id: 'task-1' };
      mockRequest.body = { notes: 'All done' };

      // Get task
      mockBuilder.queueResponse({
        id: 'task-1',
        status: 'in_progress',
        assigned_to: 'staff-123',
      }, null);
      
      // Update task
      mockBuilder.queueResponse({
        id: 'task-1',
        status: 'completed',
        completed_at: new Date().toISOString(),
      }, null);

      await controller.completeTask(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });
  });

  describe('getStaff', () => {
    it('should return housekeeping staff', async () => {
      const mockStaff = [
        { id: 'staff-1', name: 'John', active_tasks: 2 },
        { id: 'staff-2', name: 'Jane', active_tasks: 1 },
      ];

      mockBuilder.queueResponse(mockStaff, null);

      await controller.getStaff(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard summary', async () => {
      // Get pending tasks
      mockBuilder.queueResponse([{ id: 't1' }, { id: 't2' }], null, 5);
      // Get in progress
      mockBuilder.queueResponse([{ id: 't3' }], null, 3);
      // Get completed today
      mockBuilder.queueResponse([{ id: 't4' }, { id: 't5' }], null, 10);

      await controller.getDashboard(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseJson.success).toBe(true);
    });
  });
});
