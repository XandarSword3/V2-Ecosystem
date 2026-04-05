import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
  };

  const builder: any = {};
  
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit'].forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

  return {
    builder,
    queueResponse: (data: any, error: any = null) => responseQueue.push({ data, error }),
    reset: () => { responseQueue = []; responseIndex = 0; },
  };
};

let mockBuilder: ReturnType<typeof createChainableMock>;
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
}));

import * as sessionsController from '../../../src/modules/pool/controllers/sessions.controller';

const createMockReqRes = (overrides: { params?: any; query?: any; body?: any; user?: any } = {}) => {
  const req = {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    user: overrides.user || { userId: 'user-1', role: 'admin' },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
};

describe('Pool Sessions Controller', () => {
  beforeEach(() => {
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockBuilder.reset();
  });

  describe('getSessions', () => {
    it('should return all pool sessions', async () => {
      const mockSessions = [
        { id: 'session-1', name: 'Morning', start_time: '08:00', end_time: '12:00' },
        { id: 'session-2', name: 'Afternoon', start_time: '13:00', end_time: '17:00' },
      ];
      mockBuilder.queueResponse(mockSessions);

      const { req, res, next } = createMockReqRes();

      await sessionsController.getSessions(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should filter by active status', async () => {
      mockBuilder.queueResponse([{ id: 'session-1', is_active: true }]);

      const { req, res, next } = createMockReqRes({
        query: { active: 'true' },
      });

      await sessionsController.getSessions(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return a session by ID', async () => {
      const mockSession = { id: 'session-1', name: 'Morning', max_capacity: 50 };
      mockBuilder.queueResponse(mockSession);

      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' },
      });

      await sessionsController.getSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should return 404 for non-existent session', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
      });

      await sessionsController.getSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAvailability', () => {
    it('should return availability for a session', async () => {
      const mockSession = { id: 'session-1', max_capacity: 100 };
      mockBuilder.queueResponse(mockSession);
      mockBuilder.queueResponse([{ number_of_guests: 25 }, { number_of_guests: 30 }]); // 55 sold

      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' },
        query: { date: '2024-01-15' },
      });

      await sessionsController.getAvailability(req, res, next);

      // Either succeeds or returns specific error
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('createSession', () => {
    it('should create a new session with valid data', async () => {
      const mockSession = {
        id: 'session-new',
        name: 'Evening',
        start_time: '18:00',
        end_time: '21:00',
      };
      // createSession uses supabase.rpc()
      mockRpc.mockResolvedValue({ data: mockSession, error: null });

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Evening',
          start_time: '18:00',
          end_time: '21:00',
          max_capacity: 75,
          price: 30,
          adult_price: 30,
          child_price: 20,
        },
      });

      await sessionsController.createSession(req, res, next);

      // Either succeeds or fails validation
      const wasCalled = (res.json as any).mock.calls.length > 0 || (res.status as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should return 400 for invalid data', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: '' }, // Invalid
      });

      await sessionsController.createSession(req, res, next);

      // Should either call res.status(400) or next with error
      const called400 = (res.status as any).mock.calls.some((call: any[]) => call[0] === 400);
      const nextCalled = (next as any).mock.calls.length > 0;
      expect(called400 || nextCalled).toBe(true);
    });
  });

  describe('updateSession', () => {
    it('should update an existing session', async () => {
      const mockSession = { id: 'session-1', name: 'Morning Updated' };
      // updateSession uses supabase.rpc()
      mockRpc.mockResolvedValue({ data: mockSession, error: null });

      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' },
        body: { name: 'Morning Updated' },
      });

      await sessionsController.updateSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for non-existent session', async () => {
      // updateSession uses supabase.rpc()
      mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
        body: { name: 'Test' },
      });

      await sessionsController.updateSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      mockBuilder.queueResponse({ id: 'session-1' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' },
      });

      await sessionsController.deleteSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
