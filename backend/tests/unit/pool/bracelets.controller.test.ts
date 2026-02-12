import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('dayjs', () => {
  const mockDayjs = () => ({
    startOf: () => ({ toISOString: () => '2024-01-15T00:00:00.000Z' }),
    endOf: () => ({ toISOString: () => '2024-01-15T23:59:59.999Z' }),
  });
  mockDayjs.extend = vi.fn();
  return { default: mockDayjs };
});

import { getSupabase } from '../../../src/database/connection.js';
import * as braceletsController from '../../../src/modules/pool/controllers/bracelets.controller.js';

function createMockReqRes(overrides: any = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { userId: 'user-1', role: 'staff' },
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

describe('BraceletsController', () => {
  let mockBuilder: ReturnType<typeof createChainableMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuilder = createChainableMock();
    vi.mocked(getSupabase).mockReturnValue(mockBuilder.build());
  });

  describe('assignBracelet', () => {
    it('should assign bracelet to valid ticket', async () => {
      const mockTicket = { id: 'ticket-1', ticket_number: 'T-001', status: 'valid' };
      mockBuilder.queueResponse(mockTicket); // Ticket lookup
      mockBuilder.queueResponse([]); // No existing bracelet
      mockBuilder.queueResponse({ ...mockTicket, bracelet_number: 'B-001' }); // Update

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        body: { braceletNumber: 'B-001', braceletColor: 'blue' },
      });

      await braceletsController.assignBracelet(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ bracelet_number: 'B-001' }),
      });
    });

    it('should return 400 if braceletNumber is missing', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        body: {},
      });

      await braceletsController.assignBracelet(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'braceletNumber is required',
      });
    });

    it('should return 404 if ticket not found', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
        body: { braceletNumber: 'B-001' },
      });

      await braceletsController.assignBracelet(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket not found',
      });
    });

    it('should return 400 if ticket status is invalid', async () => {
      const mockTicket = { id: 'ticket-1', status: 'cancelled' };
      mockBuilder.queueResponse(mockTicket);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        body: { braceletNumber: 'B-001' },
      });

      await braceletsController.assignBracelet(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket is not valid for bracelet assignment',
      });
    });

    it('should return 409 if bracelet already in use', async () => {
      const mockTicket = { id: 'ticket-1', status: 'valid' };
      mockBuilder.queueResponse(mockTicket);
      mockBuilder.queueResponse([{ id: 'ticket-2', customer_name: 'John Doe' }]); // Existing bracelet

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        body: { braceletNumber: 'B-001' },
      });

      await braceletsController.assignBracelet(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Bracelet B-001 is already assigned to John Doe',
      });
    });
  });

  describe('returnBracelet', () => {
    it('should return bracelet successfully', async () => {
      const mockTicket = { 
        id: 'ticket-1', 
        bracelet_number: 'B-001',
        bracelet_returned_at: null,
      };
      mockBuilder.queueResponse(mockTicket);
      mockBuilder.queueResponse({ ...mockTicket, bracelet_returned_at: new Date().toISOString() });

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
      });

      await braceletsController.returnBracelet(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });

    it('should return 404 if ticket not found', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
      });

      await braceletsController.returnBracelet(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if no bracelet assigned', async () => {
      const mockTicket = { id: 'ticket-1', bracelet_number: null };
      mockBuilder.queueResponse(mockTicket);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
      });

      await braceletsController.returnBracelet(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getActiveBracelets', () => {
    it('should return all active bracelets', async () => {
      const mockBracelets = [
        { bracelet_number: 'B-001', customer_name: 'John Doe' },
        { bracelet_number: 'B-002', customer_name: 'Jane Smith' },
      ];
      mockBuilder.queueResponse(mockBracelets);

      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await braceletsController.getActiveBracelets(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBracelets,
        count: 2,
      });
    });

    it('should handle empty results', async () => {
      mockBuilder.queueResponse([]);

      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await braceletsController.getActiveBracelets(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        count: 0,
      });
    });
  });

  describe('searchByBracelet', () => {
    it('should find ticket by bracelet number', async () => {
      const mockTicket = { 
        id: 'ticket-1', 
        bracelet_number: 'B-001',
        customer_name: 'John Doe',
      };
      mockBuilder.queueResponse(mockTicket);

      const { req, res, next } = createMockReqRes({
        query: { braceletNumber: 'B-001' },
      });

      await braceletsController.searchByBracelet(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicket,
      });
    });

    it('should return 404 if bracelet not found', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        query: { braceletNumber: 'B-999' },
      });

      await braceletsController.searchByBracelet(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No ticket found with this bracelet number today',
      });
    });
  });
});
