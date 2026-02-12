/**
 * Housekeeping Advanced Controller Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createMockReqRes } from '../utils';

// Mock supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  single: vi.fn(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
};

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { HousekeepingAdvancedController } from '../../../src/modules/housekeeping/housekeeping-advanced.controller';

describe('Housekeeping Advanced Controller', () => {
  let controller: HousekeepingAdvancedController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HousekeepingAdvancedController();
    const mocks = createMockReqRes();
    mockReq = mocks.req;
    mockRes = mocks.res;

    // Reset mock chains
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.upsert.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.order.mockReturnThis();
    mockSupabase.single.mockReset();
  });

  describe('getSLAConfig', () => {
    it('should return SLA configuration', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [
          { task_type: 'standard_cleaning', target_minutes: 60 },
          { task_type: 'deep_cleaning', target_minutes: 120 },
        ],
        error: null,
      });

      await controller.getSLAConfig(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
      });
    });

    it('should handle errors', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await controller.getSLAConfig(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateSLAConfig', () => {
    it('should update SLA configuration', async () => {
      mockReq.body = {
        taskType: 'standard_cleaning',
        targetMinutes: 60,
        warningMinutes: 45,
        criticalMinutes: 75,
      };

      mockSupabase.single.mockResolvedValue({
        data: {
          task_type: 'standard_cleaning',
          target_minutes: 60,
          warning_minutes: 45,
          critical_minutes: 75,
        },
        error: null,
      });

      await controller.updateSLAConfig(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          task_type: 'standard_cleaning',
        }),
      });
    });

    it('should handle errors', async () => {
      mockReq.body = { taskType: 'standard_cleaning' };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await controller.updateSLAConfig(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createTask', () => {
    it('should return 400 if validation fails', async () => {
      mockReq.body = {}; // Missing required fields

      await controller.createTask(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should create task successfully', async () => {
      mockReq.body = {
        chaletId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        taskType: 'standard_cleaning',
        priority: 'high',
      };
      mockReq.user = { userId: 'user-1' };

      // Set up full mock chain
      let selectCallCount = 0;
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { task_type: 'standard_cleaning', target_minutes: 60 },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'task-1',
                chalet_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                task_type: 'standard_cleaning',
                status: 'pending',
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }));

      await controller.createTask(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          task_type: 'standard_cleaning',
        }),
      });
    });

    it('should handle errors', async () => {
      mockReq.body = {
        chaletId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        taskType: 'standard_cleaning',
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('Database error') });

      await controller.createTask(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
