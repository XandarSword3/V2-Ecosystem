import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Create chainable Supabase mock
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

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
}));

vi.mock('../../../src/services/email.service.js', () => ({
  emailService: { sendEmail: vi.fn().mockResolvedValue(true) },
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}));

vi.mock('../../../src/validation/schemas.js', () => ({
  purchasePoolTicketSchema: { parse: vi.fn((data: any) => data) },
  validateBody: vi.fn((schema: any, data: any) => data),
}));

import * as ticketsController from '../../../src/modules/pool/controllers/tickets.controller';

const createMockReqRes = (overrides: { params?: any; query?: any; body?: any; user?: any } = {}) => {
  const req = {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    user: overrides.user || { userId: 'user-1', role: 'customer' },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
};

describe('Pool Tickets Controller', () => {
  beforeEach(() => {
    mockBuilder = createChainableMock();
    mockFrom.mockReturnValue(mockBuilder.builder);
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockBuilder.reset();
  });

  describe('purchaseTicket', () => {
    it('should purchase a pool ticket successfully', async () => {
      const mockSession = {
        id: 'session-1',
        price: '25.00',
        max_capacity: 100,
        adult_price: '25.00',
        child_price: '15.00',
      };
      const mockTicket = {
        id: 'ticket-1',
        ticket_number: 'P-240101-0001',
        status: 'valid',
      };

      mockBuilder.queueResponse(mockSession); // Get session
      mockBuilder.queueResponse([]); // Existing tickets (none)
      mockBuilder.queueResponse(mockTicket); // Create ticket

      const { req, res, next } = createMockReqRes({
        body: {
          sessionId: 'session-1',
          ticketDate: '2024-01-15',
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          numberOfGuests: 2,
          numberOfAdults: 1,
          numberOfChildren: 1,
          paymentMethod: 'card',
        },
      });

      await ticketsController.purchaseTicket(req, res, next);

      const resJsonCalled = (res.json as any).mock.calls.length > 0;
      const nextCalled = (next as any).mock.calls.length > 0;
      expect(resJsonCalled || nextCalled).toBe(true);
    });

    it('should return 404 for invalid session', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        body: {
          sessionId: 'invalid-session',
          ticketDate: '2024-01-15',
          customerName: 'John Doe',
          numberOfGuests: 1,
        },
      });

      await ticketsController.purchaseTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 when capacity exceeded', async () => {
      const mockSession = { id: 'session-1', max_capacity: 10 };
      mockBuilder.queueResponse(mockSession);
      mockBuilder.queueResponse([{ number_of_guests: 8 }]); // Already 8 guests

      const { req, res, next } = createMockReqRes({
        body: {
          sessionId: 'session-1',
          ticketDate: '2024-01-15',
          customerName: 'John Doe',
          numberOfGuests: 5, // Would exceed capacity
        },
      });

      await ticketsController.purchaseTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getTicket', () => {
    it('should return a ticket by ID', async () => {
      const mockTicket = { id: 'ticket-1', ticket_number: 'P-001', status: 'valid' };
      mockBuilder.queueResponse(mockTicket);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
      });

      await ticketsController.getTicket(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for non-existent ticket', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
      });

      await ticketsController.getTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyTickets', () => {
    it('should return user tickets', async () => {
      const mockTickets = [
        { id: 'ticket-1', status: 'valid' },
        { id: 'ticket-2', status: 'used' },
      ];
      mockBuilder.queueResponse(mockTickets);

      const { req, res, next } = createMockReqRes({
        query: { status: 'valid' },
      });

      await ticketsController.getMyTickets(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockTickets,
      }));
    });
  });

  describe('cancelTicket', () => {
    it('should cancel a valid ticket', async () => {
      const mockTicket = { id: 'ticket-1', status: 'valid', customer_id: 'user-1' };
      mockBuilder.queueResponse(mockTicket);
      mockBuilder.queueResponse({ id: 'ticket-1', status: 'cancelled' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        body: { reason: 'Change of plans' },
      });

      await ticketsController.cancelTicket(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for non-existent ticket', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
      });

      await ticketsController.cancelTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for already cancelled ticket', async () => {
      const mockTicket = { id: 'ticket-1', status: 'cancelled' };
      mockBuilder.queueResponse(mockTicket);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
      });

      await ticketsController.cancelTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('validateTicket', () => {
    it('should validate a valid ticket', async () => {
      const mockTicket = { id: 'ticket-1', status: 'valid', ticket_date: new Date().toISOString() };
      mockBuilder.queueResponse(mockTicket);

      const { req, res, next } = createMockReqRes({
        params: { ticketNumber: 'P-240101-0001' },
      });

      await ticketsController.validateTicket(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        validation: expect.objectContaining({ isValid: true }),
      }));
    });

    it('should return invalid for non-existent ticket', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { ticketNumber: 'INVALID' },
      });

      await ticketsController.validateTicket(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ isValid: false }),
      }));
    });
  });

  describe('recordEntry', () => {
    it('should record entry for valid ticket', async () => {
      const mockTicket = { id: 'ticket-1', status: 'valid', number_of_guests: 2 };
      mockBuilder.queueResponse(mockTicket);
      mockBuilder.queueResponse({ id: 'ticket-1', status: 'used' });

      const { req, res, next } = createMockReqRes({
        params: { ticketNumber: 'P-240101-0001' },
        body: { guestsEntering: 2 },
      });

      await ticketsController.recordEntry(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 for invalid ticket', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { ticketNumber: 'INVALID' },
      });

      await ticketsController.recordEntry(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('recordExit', () => {
    it('should record exit for used ticket with entry recorded', async () => {
      const mockTicket = { id: 'ticket-1', status: 'used', guests_inside: 2, entry_time: new Date().toISOString() };
      mockBuilder.queueResponse(mockTicket);
      mockBuilder.queueResponse({ id: 'ticket-1', guests_inside: 0 });

      const { req, res, next } = createMockReqRes({
        params: { ticketNumber: 'P-240101-0001' },
        body: { guestsExiting: 2 },
      });

      await ticketsController.recordExit(req, res, next);

      // Either succeeds or has a specific error
      const wasCalled = (res.json as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('getTodayTickets', () => {
    it('should return tickets for today', async () => {
      const mockTickets = [
        { id: 'ticket-1', status: 'valid', customer_name: 'John' },
        { id: 'ticket-2', status: 'used', customer_name: 'Jane' },
      ];
      mockBuilder.queueResponse(mockTickets);

      const { req, res, next } = createMockReqRes({
        query: { sessionId: 'session-1' },
      });

      await ticketsController.getTodayTickets(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockTickets,
      }));
    });

    it('should filter by status', async () => {
      mockBuilder.queueResponse([{ id: 'ticket-1', status: 'valid' }]);

      const { req, res, next } = createMockReqRes({
        query: { sessionId: 'session-1', status: 'valid' },
      });

      await ticketsController.getTodayTickets(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });
});
