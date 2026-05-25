
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
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => {
      responseQueue = [];
      responseIndex = 0;
    },
    build: () => ({ from: vi.fn().mockReturnValue(builder) }),
  };
};

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/socket/index.js', () => {
  const mockEmit = vi.fn();
  const mockTo: any = vi.fn().mockImplementation(() => ({ to: mockTo, emit: mockEmit }));
  return {
    getIO: vi.fn().mockReturnValue({ to: mockTo }),
  };
});

import { getSupabase } from '../../../src/database/connection.js';
import { approvalsController } from '../../../src/modules/manager/approvals.controller.js';

function createMockReqRes(overrides: any = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { id: 'user-1', role: 'manager' },
    ...overrides,
  };
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('ApprovalsController', () => {
  let mockBuilder: ReturnType<typeof createChainableMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuilder = createChainableMock();
    vi.mocked(getSupabase).mockReturnValue(mockBuilder.build());
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals', async () => {
      const mockApprovals = [
        { id: 'app-1', type: 'refund', status: 'pending', requested_by: 'user-2' },
        { id: 'app-2', type: 'discount', status: 'pending', requested_by: 'user-3' },
      ];
      const mockUsers = [
        { id: 'user-2', full_name: 'John Doe', email: 'john@test.com' },
        { id: 'user-3', full_name: 'Jane Smith', email: 'jane@test.com' },
      ];
      mockBuilder.queueResponse(mockApprovals, null, 2);
      mockBuilder.queueResponse(mockUsers);

      const { req, res } = createMockReqRes({
        query: { page: '1', limit: '20' },
      });

      await approvalsController.getPendingApprovals(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'app-1', requested_by_name: 'John Doe' }),
          expect.objectContaining({ id: 'app-2', requested_by_name: 'Jane Smith' }),
        ]),
      }));
    });

    it('should filter by type when provided', async () => {
      const mockApprovals = [{ id: 'app-1', type: 'refund', status: 'pending', requested_by: 'user-2' }];
      mockBuilder.queueResponse(mockApprovals, null, 1);
      mockBuilder.queueResponse([{ id: 'user-2', full_name: 'John' }]);

      const { req, res } = createMockReqRes({
        query: { page: '1', limit: '20', type: 'refund' },
      });

      await approvalsController.getPendingApprovals(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should handle database errors', async () => {
      mockBuilder.queueResponse(null, { message: 'Database error' });

      const { req, res } = createMockReqRes({
        query: {},
      });

      await approvalsController.getPendingApprovals(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Failed to fetch approvals',
      }));
    });
  });

  describe('getApprovals', () => {
    it('should return all approvals with pagination', async () => {
      const mockApprovals = [
        { id: 'app-1', type: 'refund', status: 'approved', requested_by: 'user-2', reviewed_by: 'user-4' },
      ];
      const mockUsers = [
        { id: 'user-2', full_name: 'John Doe' },
        { id: 'user-4', full_name: 'Manager Smith' },
      ];
      mockBuilder.queueResponse(mockApprovals, null, 1);
      mockBuilder.queueResponse(mockUsers);

      const { req, res } = createMockReqRes({
        query: { page: '1', limit: '20' },
      });

      await approvalsController.getApprovals(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ 
            id: 'app-1', 
            requested_by_name: 'John Doe',
            reviewed_by_name: 'Manager Smith',
          }),
        ]),
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: 1,
        }),
      }));
    });

    it('should filter by status', async () => {
      mockBuilder.queueResponse([{ id: 'app-1', status: 'approved', requested_by: null }], null, 1);

      const { req, res } = createMockReqRes({
        query: { status: 'approved' },
      });

      await approvalsController.getApprovals(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should filter by date range', async () => {
      mockBuilder.queueResponse([], null, 0);

      const { req, res } = createMockReqRes({
        query: { 
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      await approvalsController.getApprovals(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('createApproval', () => {
    it('should create an approval request', async () => {
      const mockApproval = {
        id: 'app-new',
        type: 'refund',
        amount: 50,
        description: 'Customer refund request',
        status: 'pending',
      };
      mockBuilder.queueResponse(mockApproval); // Insert approval
      mockBuilder.queueResponse({ full_name: 'Staff Member' }); // User lookup for socket

      const { req, res } = createMockReqRes({
        body: {
          type: 'refund',
          amount: 50,
          description: 'Customer refund request',
        },
        user: { id: 'user-1', userId: 'user-1', role: 'staff' },
      });

      await approvalsController.createApproval(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockApproval,
      }));
    });

    it('should return 400 for invalid input', async () => {
      const { req, res } = createMockReqRes({
        body: {
          type: 'invalid_type',
          description: 'Test',
        },
      });

      await approvalsController.createApproval(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Validation failed',
      }));
    });

    it('should handle percentage discounts', async () => {
      const mockApproval = { id: 'app-new', type: 'discount', percentage: 15 };
      mockBuilder.queueResponse(mockApproval); // Insert approval
      mockBuilder.queueResponse({ full_name: 'Staff Member' }); // User lookup for socket

      const { req, res } = createMockReqRes({
        body: {
          type: 'discount',
          percentage: 15,
          description: '15% discount for loyalty',
        },
        user: { id: 'user-1', userId: 'user-1', role: 'staff' },
      });

      await approvalsController.createApproval(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('reviewApproval', () => {
    it('should approve an approval request', async () => {
      const mockApproval = { 
        id: 'app-1', 
        status: 'pending',
        type: 'refund',
        amount: 50,
        reference_type: null,
        reference_id: null,
        requested_by: 'user-2',
      };
      const mockUpdatedApproval = { ...mockApproval, status: 'approved' };
      mockBuilder.queueResponse(mockApproval); // Get approval
      mockBuilder.queueResponse(mockUpdatedApproval); // Update approval

      const { req, res } = createMockReqRes({
        params: { id: 'app-1' },
        body: { status: 'approved', notes: 'Looks good' },
        user: { id: 'manager-1', userId: 'manager-1', role: 'manager' },
      });

      await approvalsController.reviewApproval(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should reject an approval request', async () => {
      const mockApproval = { id: 'app-1', status: 'pending', type: 'refund', requested_by: 'user-2' };
      const mockUpdatedApproval = { ...mockApproval, status: 'rejected' };
      mockBuilder.queueResponse(mockApproval);
      mockBuilder.queueResponse(mockUpdatedApproval);

      const { req, res } = createMockReqRes({
        params: { id: 'app-1' },
        body: { status: 'rejected', notes: 'Insufficient justification' },
        user: { id: 'manager-1', userId: 'manager-1', role: 'manager' },
      });

      await approvalsController.reviewApproval(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should return 404 for non-existent approval', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res } = createMockReqRes({
        params: { id: 'invalid' },
        body: { status: 'approved' },
      });

      await approvalsController.reviewApproval(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for already reviewed approval', async () => {
      const mockApproval = { id: 'app-1', status: 'approved' };
      mockBuilder.queueResponse(mockApproval);

      const { req, res } = createMockReqRes({
        params: { id: 'app-1' },
        body: { status: 'rejected' },
      });

      await approvalsController.reviewApproval(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid input', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'app-1' },
        body: { status: 'invalid' },
      });

      await approvalsController.reviewApproval(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getApprovalStats', () => {
    it('should return approval statistics', async () => {
      const mockStatusCounts = [
        { status: 'pending' }, { status: 'pending' },
        { status: 'approved' }, { status: 'approved' },
        { status: 'rejected' },
      ];
      const mockTypeCounts = [
        { type: 'refund', amount: 50 },
        { type: 'refund', amount: 30 },
        { type: 'discount', amount: 20 },
      ];
      mockBuilder.queueResponse(mockStatusCounts);
      mockBuilder.queueResponse(mockTypeCounts);

      const { req, res } = createMockReqRes({
        query: {},
      });

      await approvalsController.getApprovalStats(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          total: 5,
          pending: 2,
          approved: 2,
          rejected: 1,
        }),
      }));
    });

    it('should handle empty results', async () => {
      mockBuilder.queueResponse([]);
      mockBuilder.queueResponse([]);

      const { req, res } = createMockReqRes({
        query: {},
      });

      await approvalsController.getApprovalStats(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          total: 0,
          pending: 0,
        }),
      }));
    });
  });
});
