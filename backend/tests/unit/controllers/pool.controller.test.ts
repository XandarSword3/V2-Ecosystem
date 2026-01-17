import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';
import { createPoolController, PoolController } from '../../../src/lib/controllers/pool.controller';
import { PoolService } from '../../../src/lib/services/pool.service';

describe('PoolController', () => {
  let controller: PoolController;
  let mockPoolService: Partial<PoolService>;

  beforeEach(() => {
    mockPoolService = {
      getSessions: vi.fn(),
      getSessionById: vi.fn(),
      getAvailability: vi.fn(),
      purchaseTicket: vi.fn(),
      getTicketById: vi.fn(),
      getTicketsByUser: vi.fn(),
      validateTicket: vi.fn(),
      recordEntry: vi.fn(),
      recordExit: vi.fn(),
      getTicketsByDate: vi.fn(),
      createSession: vi.fn(),
      updateSession: vi.fn(),
      deleteSession: vi.fn()
    };

    controller = createPoolController({ poolService: mockPoolService as PoolService });
  });

  describe('getSessions', () => {
    it('should return all sessions', async () => {
      const mockSessions = [
        { id: 'session-1', name: 'Morning', startTime: '08:00', endTime: '12:00' },
        { id: 'session-2', name: 'Afternoon', startTime: '13:00', endTime: '17:00' }
      ];

      vi.mocked(mockPoolService.getSessions!).mockResolvedValue(mockSessions as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await controller.getSessions(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSessions
      });
    });

    it('should filter sessions by moduleId', async () => {
      vi.mocked(mockPoolService.getSessions!).mockResolvedValue([]);

      const { req, res, next } = createMockReqRes({ query: { moduleId: 'pool-1' } });
      await controller.getSessions(req, res, next);

      expect(mockPoolService.getSessions).toHaveBeenCalledWith('pool-1');
    });

    it('should handle errors', async () => {
      vi.mocked(mockPoolService.getSessions!).mockRejectedValue(new Error('Service error'));

      const { req, res, next } = createMockReqRes({ query: {} });
      await controller.getSessions(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return session by id', async () => {
      const mockSession = { id: 'session-1', name: 'Morning' };
      vi.mocked(mockPoolService.getSessionById!).mockResolvedValue(mockSession as any);

      const { req, res, next } = createMockReqRes({ params: { id: 'session-1' } });
      await controller.getSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession
      });
    });

    it('should return 404 for non-existent session', async () => {
      vi.mocked(mockPoolService.getSessionById!).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({ params: { id: 'non-existent' } });
      await controller.getSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found'
      });
    });
  });

  describe('getAvailability', () => {
    it('should return availability for given date', async () => {
      const mockAvailability = [
        { sessionId: 's-1', available: 50, total: 100 }
      ];
      vi.mocked(mockPoolService.getAvailability!).mockResolvedValue(mockAvailability as any);

      const { req, res, next } = createMockReqRes({
        query: { date: '2026-01-20', sessionId: 's-1' }
      });
      await controller.getAvailability(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAvailability
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
    it('should create ticket successfully', async () => {
      const mockResult = {
        ticket: { id: 'ticket-1', ticketNumber: 'T-001' },
        qrCode: 'qr-data'
      };
      vi.mocked(mockPoolService.purchaseTicket!).mockResolvedValue(mockResult as any);

      const { req, res, next } = createMockReqRes({
        body: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          ticketDate: '2026-01-20',
          customerName: 'John Doe',
          customerPhone: '+1234567890',
          numberOfGuests: 3,
          numberOfAdults: 2,
          numberOfChildren: 1,
          paymentMethod: 'card'
        },
        user: { id: 'user-1', role: 'customer', userId: 'user-1' }
      });

      await controller.purchaseTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.ticket,
        qrCode: mockResult.qrCode
      });
    });

    it('should handle validation errors', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          // Missing required fields
          sessionId: 'invalid-uuid'
        }
      });

      await controller.purchaseTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Validation failed'
      }));
    });

    it('should handle service errors', async () => {
      const serviceError = {
        message: 'Session sold out',
        code: 'SESSION_FULL',
        statusCode: 400
      };
      vi.mocked(mockPoolService.purchaseTicket!).mockRejectedValue(serviceError);

      const { req, res, next } = createMockReqRes({
        body: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          ticketDate: '2026-01-20',
          customerName: 'John Doe',
          customerPhone: '+1234567890',
          numberOfGuests: 2,
          numberOfAdults: 2,
          numberOfChildren: 0,
          paymentMethod: 'card'
        }
      });

      await controller.purchaseTicket(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 400,
        code: 'SESSION_FULL'
      }));
    });
  });

  describe('getTicket', () => {
    it('should return ticket by id', async () => {
      const mockTicket = { id: 'ticket-1', ticketNumber: 'T-001' };
      vi.mocked(mockPoolService.getTicketById!).mockResolvedValue(mockTicket as any);

      const { req, res, next } = createMockReqRes({ params: { id: 'ticket-1' } });
      await controller.getTicket(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicket
      });
    });

    it('should return 404 for non-existent ticket', async () => {
      vi.mocked(mockPoolService.getTicketById!).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({ params: { id: 'non-existent' } });
      await controller.getTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket not found'
      });
    });
  });

  describe('getMyTickets', () => {
    it('should return tickets for current user', async () => {
      const mockTickets = [
        { id: 'ticket-1', ticketNumber: 'T-001' },
        { id: 'ticket-2', ticketNumber: 'T-002' }
      ];
      vi.mocked(mockPoolService.getTicketsByUser!).mockResolvedValue(mockTickets as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'customer', userId: 'user-1' }
      });
      await controller.getMyTickets(req, res, next);

      expect(mockPoolService.getTicketsByUser).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTickets
      });
    });
  });

  describe('validateTicket', () => {
    it('should validate ticket by ticket number', async () => {
      const mockResult = { valid: true, ticket: { id: 't-1' } };
      vi.mocked(mockPoolService.validateTicket!).mockResolvedValue(mockResult as any);

      const { req, res, next } = createMockReqRes({
        body: { ticketNumber: 'T-001' }
      });
      await controller.validateTicket(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        ...mockResult
      });
    });

    it('should validate ticket from QR code', async () => {
      const mockResult = { valid: true };
      vi.mocked(mockPoolService.validateTicket!).mockResolvedValue(mockResult as any);

      const { req, res, next } = createMockReqRes({
        body: { qrCode: JSON.stringify({ ticketNumber: 'T-001' }) }
      });
      await controller.validateTicket(req, res, next);

      expect(mockPoolService.validateTicket).toHaveBeenCalledWith('T-001');
    });

    it('should require ticketNumber or qrCode', async () => {
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
      const mockTicket = { id: 'ticket-1', status: 'entered' };
      vi.mocked(mockPoolService.recordEntry!).mockResolvedValue(mockTicket as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        user: { id: 'staff-1', role: 'staff', userId: 'staff-1' }
      });
      await controller.recordEntry(req, res, next);

      expect(mockPoolService.recordEntry).toHaveBeenCalledWith('ticket-1', 'staff-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicket
      });
    });
  });

  describe('recordExit', () => {
    it('should record ticket exit', async () => {
      const mockTicket = { id: 'ticket-1', status: 'exited' };
      vi.mocked(mockPoolService.recordExit!).mockResolvedValue(mockTicket as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        user: { id: 'staff-1', role: 'staff', userId: 'staff-1' }
      });
      await controller.recordExit(req, res, next);

      expect(mockPoolService.recordExit).toHaveBeenCalledWith('ticket-1', 'staff-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicket
      });
    });
  });

  describe('getTodayTickets', () => {
    it('should return tickets for today', async () => {
      const mockTickets = [{ id: 'ticket-1' }];
      vi.mocked(mockPoolService.getTicketsByDate!).mockResolvedValue(mockTickets as any);

      const { req, res, next } = createMockReqRes();
      await controller.getTodayTickets(req, res, next);

      expect(mockPoolService.getTicketsByDate).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTickets
      });
    });
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      const mockSession = { id: 'session-1', name: 'Evening' };
      vi.mocked(mockPoolService.createSession!).mockResolvedValue(mockSession as any);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Evening', startTime: '18:00', endTime: '22:00' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });
      await controller.createSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession
      });
    });
  });

  describe('updateSession', () => {
    it('should update session successfully', async () => {
      const mockSession = { id: 'session-1', name: 'Updated' };
      vi.mocked(mockPoolService.updateSession!).mockResolvedValue(mockSession as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' },
        body: { name: 'Updated' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });
      await controller.updateSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession
      });
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      vi.mocked(mockPoolService.deleteSession!).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'session-1' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });
      await controller.deleteSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Session deleted'
      });
    });
  });
});
