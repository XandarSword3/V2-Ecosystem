import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';
import { createPoolController } from '../../../src/lib/controllers/pool.controller';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('PoolController (lib)', () => {
  let mockPoolService: any;
  let controller: ReturnType<typeof createPoolController>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPoolService = {
      getSessions: vi.fn().mockResolvedValue([
        { id: 'session-1', name: 'Morning', capacity: 50 },
        { id: 'session-2', name: 'Afternoon', capacity: 50 }
      ]),
      getSessionById: vi.fn().mockResolvedValue({
        id: 'session-1',
        name: 'Morning Session',
        capacity: 50
      }),
      getAvailability: vi.fn().mockResolvedValue([
        { sessionId: 'session-1', available: 30 }
      ]),
      purchaseTicket: vi.fn().mockResolvedValue({
        id: 'ticket-1',
        sessionId: 'session-1',
        guestCount: 2
      }),
      getTicketById: vi.fn().mockResolvedValue({
        id: 'ticket-1',
        status: 'valid'
      }),
      getTicketsByUser: vi.fn().mockResolvedValue([
        { id: 'ticket-1', status: 'valid' }
      ]),
      getTicketsByDate: vi.fn().mockResolvedValue([
        { id: 'ticket-1', guestCount: 2 }
      ]),
      validateTicket: vi.fn().mockResolvedValue({
        valid: true,
        ticket: { id: 'ticket-1' }
      }),
      recordEntry: vi.fn().mockResolvedValue({
        id: 'ticket-1',
        enteredAt: new Date().toISOString()
      }),
      recordExit: vi.fn().mockResolvedValue({
        id: 'ticket-1',
        exitedAt: new Date().toISOString()
      }),
      getTodayTickets: vi.fn().mockResolvedValue([
        { id: 'ticket-1', guestCount: 2 }
      ]),
      createSession: vi.fn().mockResolvedValue({
        id: 'new-session',
        name: 'New Session'
      }),
      updateSession: vi.fn().mockResolvedValue({
        id: 'session-1',
        name: 'Updated Session'
      }),
      deleteSession: vi.fn().mockResolvedValue({ success: true })
    };

    controller = createPoolController({ poolService: mockPoolService });
  });

  describe('getSessions', () => {
    it('should return all sessions', async () => {
      const { req, res, next } = createMockReqRes({ query: {} });
      
      await controller.getSessions(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'Morning' })
        ])
      });
    });

    it('should filter by moduleId', async () => {
      const { req, res, next } = createMockReqRes({ 
        query: { moduleId: 'pool-1' } 
      });
      
      await controller.getSessions(req, res, next);
      
      expect(mockPoolService.getSessions).toHaveBeenCalledWith('pool-1');
    });
  });

  describe('getSession', () => {
    it('should return session by id', async () => {
      const { req, res, next } = createMockReqRes({ 
        params: { id: 'session-1' } 
      });
      
      await controller.getSession(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: 'session-1' })
      });
    });

    it('should return 404 for non-existent session', async () => {
      mockPoolService.getSessionById.mockResolvedValue(null);
      const { req, res, next } = createMockReqRes({ 
        params: { id: 'non-existent' } 
      });
      
      await controller.getSession(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found'
      });
    });
  });

  describe('getAvailability', () => {
    it('should return availability for date', async () => {
      const { req, res, next } = createMockReqRes({ 
        query: { date: '2024-01-15' } 
      });
      
      await controller.getAvailability(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ available: 30 })
        ])
      });
    });

    it('should require date parameter', async () => {
      const { req, res, next } = createMockReqRes({ query: {} });
      
      await controller.getAvailability(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'date required'
      });
    });
  });

  describe('purchaseTicket', () => {
    it('should return validation error for invalid input', async () => {
      const { req, res, next } = createMockReqRes({
        body: {} // Missing required fields
      });
      
      await controller.purchaseTicket(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Validation failed' })
      );
    });
  });

  describe('getTicket', () => {
    it('should return ticket by id', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' }
      });
      
      await controller.getTicket(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: 'ticket-1' })
      });
    });

    it('should return 404 for non-existent ticket', async () => {
      mockPoolService.getTicketById.mockResolvedValue(null);
      const { req, res, next } = createMockReqRes({
        params: { id: 'non-existent' }
      });
      
      await controller.getTicket(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyTickets', () => {
    it('should return user tickets', async () => {
      const { req, res, next } = createMockReqRes();
      
      await controller.getMyTickets(req, res, next);
      
      // createMockReqRes sets user.id = 'admin-1'
      expect(mockPoolService.getTicketsByUser).toHaveBeenCalledWith('admin-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
  });

  describe('validateTicket', () => {
    it('should validate ticket with ticketNumber', async () => {
      const { req, res, next } = createMockReqRes({
        body: { ticketNumber: 'TK-001' }
      });
      
      await controller.validateTicket(req, res, next);
      
      expect(mockPoolService.validateTicket).toHaveBeenCalledWith('TK-001');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should validate ticket with qrCode', async () => {
      const { req, res, next } = createMockReqRes({
        body: { qrCode: JSON.stringify({ ticketNumber: 'TK-002' }) }
      });
      
      await controller.validateTicket(req, res, next);
      
      expect(mockPoolService.validateTicket).toHaveBeenCalledWith('TK-002');
    });

    it('should require ticketNumber or qrCode in body', async () => {
      const { req, res, next } = createMockReqRes({ body: {} });
      
      await controller.validateTicket(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'ticketNumber or qrCode required'
      });
    });
  });

  describe('recordEntry', () => {
    it('should record ticket entry', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' }
      });
      
      await controller.recordEntry(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ enteredAt: expect.any(String) })
      });
    });
  });

  describe('recordExit', () => {
    it('should record ticket exit', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' }
      });
      
      await controller.recordExit(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ exitedAt: expect.any(String) })
      });
    });
  });

  describe('getTodayTickets', () => {
    it('should return today tickets', async () => {
      const { req, res, next } = createMockReqRes();
      
      await controller.getTodayTickets(req, res, next);
      
      expect(mockPoolService.getTicketsByDate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
  });

  describe('createSession', () => {
    it('should create new session', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Evening Session',
          startTime: '18:00',
          endTime: '21:00',
          capacity: 40
        }
      });
      
      await controller.createSession(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateSession', () => {
    it('should update existing session', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' },
        body: { name: 'Updated Morning' }
      });
      
      await controller.updateSession(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ name: 'Updated Session' })
      });
    });
  });

  describe('deleteSession', () => {
    it('should delete session', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' }
      });
      
      await controller.deleteSession(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Session deleted'
      });
    });
  });

  describe('error handling', () => {
    it('should handle service errors with code', async () => {
      mockPoolService.getSessions.mockRejectedValue({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
        statusCode: 404
      });
      
      const { req, res, next } = createMockReqRes({ query: {} });
      
      await controller.getSessions(req, res, next);
      
      expect(next).toHaveBeenCalledWith({
        status: 404,
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    });

    it('should pass through generic errors', async () => {
      const genericError = new Error('Generic error');
      mockPoolService.getSessions.mockRejectedValue(genericError);
      
      const { req, res, next } = createMockReqRes({ query: {} });
      
      await controller.getSessions(req, res, next);
      
      expect(next).toHaveBeenCalledWith(genericError);
    });
  });
});
