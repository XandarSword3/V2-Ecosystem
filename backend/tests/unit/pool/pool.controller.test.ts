import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock QRCode
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQRcode') }
}));

// Mock email service
vi.mock('../../../src/services/email.service.js', () => ({
  emailService: {
    sendPoolTicket: vi.fn().mockResolvedValue(true)
  }
}));

// Mock socket
vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn()
}));

// Mock activity logger
vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn()
}));

// Mock config
vi.mock('../../../src/config/index.js', () => ({
  config: {
    stripe: { secretKey: 'test_key' }
  }
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock Supabase
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

import * as poolController from '../../../src/modules/pool/pool.controller';
import { getSupabase } from '../../../src/database/connection.js';

describe('Pool Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSessions', () => {
    it('should return all active pool sessions', async () => {
      const mockSessions = [
        { id: 'sess-1', name: 'Morning Session', start_time: '08:00', end_time: '12:00', is_active: true, price: 25 },
        { id: 'sess-2', name: 'Afternoon Session', start_time: '13:00', end_time: '17:00', is_active: true, price: 30 }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockSessions, error: null })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await poolController.getSessions(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalledWith('pool_sessions');
      expect(res.json).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const error = new Error('DB error');
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockRejectedValue(error)
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes();

      await poolController.getSessions(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return a specific session', async () => {
      const mockSession = { 
        id: 'sess-1', 
        name: 'Morning Session',
        start_time: '08:00',
        end_time: '12:00',
        price: 25,
        adult_price: 25,
        child_price: 15
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSession, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sess-1' }
      });

      await poolController.getSession(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const jsonArg = vi.mocked(res.json).mock.calls[0][0];
      expect(jsonArg.success).toBe(true);
      expect(jsonArg.data.id).toBe('sess-1');
    });

    it('should return 404 for non-existent session', async () => {
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
        params: { id: 'invalid-id' }
      });

      await poolController.getSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Session not found' });
    });
  });

  describe('getAvailability', () => {
    it('should return 400 if date is missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await poolController.getAvailability(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'date required' });
    });

    it('should return availability for a date', async () => {
      const mockSessions = [
        { id: 'sess-1', name: 'Morning', capacity: 50 }
      ];
      const mockTickets = [
        { session_id: 'sess-1', adults: 2, children: 1, status: 'confirmed' }
      ];

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'pool_sessions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  or: vi.fn().mockResolvedValue({ data: mockSessions, error: null })
                })
              })
            };
          }
          if (table === 'pool_tickets') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: mockTickets, error: null })
                })
              })
            };
          }
          return { select: vi.fn().mockReturnThis() };
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: { date: '2024-06-15' }
      });

      await poolController.getAvailability(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalledWith('pool_sessions');
    });
  });

  describe('getTicket', () => {
    it('should return a ticket by ID', async () => {
      const mockTicket = {
        id: 'ticket-1',
        ticket_number: 'P-240615-1234',
        session_id: 'sess-1',
        adults: 2,
        children: 1,
        total_amount: 65,
        status: 'confirmed'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockTicket, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' }
      });

      await poolController.getTicket(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 for non-existent ticket', async () => {
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
        params: { id: 'invalid-id' }
      });

      await poolController.getTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyTickets', () => {
    it('should return user tickets', async () => {
      const mockTickets = [
        { id: 'ticket-1', status: 'confirmed' },
        { id: 'ticket-2', status: 'used' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockTickets, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await poolController.getMyTickets(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('cancelTicket', () => {
    it('should cancel a ticket', async () => {
      const mockTicket = {
        id: 'ticket-1',
        status: 'confirmed',
        user_id: 'user-1',
        // FIX: Iteration 2 - Use ticket_date (matches actual pool_tickets schema, not visit_date)
        ticket_date: new Date(Date.now() + 86400000).toISOString() // tomorrow
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockTicket, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: { ...mockTicket, status: 'cancelled' }, error: null })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ticket-1' },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await poolController.cancelTicket(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('validateTicket', () => {
    it('should validate a ticket with ticketNumber', async () => {
      const mockTicket = {
        id: 'ticket-1',
        ticket_number: 'P-240615-1234',
        status: 'valid',
        ticket_date: new Date().toISOString(),
        number_of_guests: 2
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockTicket, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockTicket, error: null })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { ticketNumber: 'P-240615-1234' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await poolController.validateTicket(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should return 404 if ticket not found', async () => {
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
        body: { ticketNumber: 'invalid-ticket' },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await poolController.validateTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('recordEntry', () => {
    it('should record pool entry', async () => {
      const mockTicket = {
        id: 'ticket-1',
        status: 'confirmed',
        adults: 2,
        children: 1
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockTicket, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          }),
          insert: vi.fn().mockResolvedValue({ error: null })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { ticketId: 'ticket-1' },
        body: { guestsEntering: 3 },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await poolController.recordEntry(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalledWith('pool_tickets');
    });
  });

  describe('recordExit', () => {
    it('should record pool exit', async () => {
      const mockLog = { id: 'log-1', ticket_id: 'ticket-1', action: 'entry' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockLog, error: null })
                })
              })
            })
          }),
          insert: vi.fn().mockResolvedValue({ error: null })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { ticketId: 'ticket-1' },
        body: { guestsExiting: 2 },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      await poolController.recordExit(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('getCurrentCapacity', () => {
    it('should return current pool capacity', async () => {
      const mockSettings = { max_capacity: 100 };
      const mockLogs = [
        { action: 'entry', guests_count: 10 },
        { action: 'exit', guests_count: 3 }
      ];

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'pool_settings') {
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockSettings, error: null })
              })
            };
          }
          if (table === 'pool_access_logs') {
            return {
              select: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({ data: mockLogs, error: null })
                })
              })
            };
          }
          return { select: vi.fn().mockReturnThis() };
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes();

      await poolController.getCurrentCapacity(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create a new pool session', async () => {
      const mockSession = {
        id: 'sess-new',
        name: 'Evening Session',
        start_time: '18:00',
        end_time: '21:00',
        max_capacity: 30,
        adult_price: '35',
        child_price: '20'
      };

      // createSession uses supabase.rpc() instead of from().insert()
      const mockSupabase = {
        from: vi.fn().mockReturnValue(createChainableMock()),
        rpc: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Evening Session',
          startTime: '18:00',
          endTime: '21:00',
          maxCapacity: 30,
          adult_price: 35,
          child_price: 20
        },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await poolController.createSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'Test Session' }, // missing other required fields
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await poolController.createSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateSession', () => {
    it('should update a pool session', async () => {
      const mockSession = { id: 'sess-1', name: 'Updated Session' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockSession, error: null })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sess-1' },
        body: { name: 'Updated Session' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await poolController.updateSession(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('should soft-delete a pool session', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sess-1' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await poolController.deleteSession(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Session deleted' });
    });
  });

  describe('getPoolSettings', () => {
    it('should return pool settings', async () => {
      const mockSettings = [
        { key: 'maxCapacity', value: '100' },
        { key: 'ticketPrice', value: '15.00' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockSettings, error: null })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes();

      await poolController.getPoolSettings(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('updatePoolSettings', () => {
    it('should update pool settings', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ error: null })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { maxCapacity: 150 },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await poolController.updatePoolSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Pool settings updated' });
    });
  });

  describe('resetOccupancy', () => {
    it('should reset pool occupancy', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ error: null })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { reason: 'End of day reset' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await poolController.resetOccupancy(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Occupancy reset to 0' });
    });
  });

  describe('getMaintenanceLogs', () => {
    it('should return maintenance logs', async () => {
      const mockLogs = [
        { id: 'log-1', type: 'cleaning', notes: 'Daily cleaning' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockLogs, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes();

      await poolController.getMaintenanceLogs(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('createMaintenanceLog', () => {
    it('should create a maintenance log', async () => {
      const mockLog = {
        id: 'log-new',
        type: 'chemical_check',
        notes: 'Chlorine levels checked'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockLog, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { type: 'chemical_check', notes: 'Chlorine levels checked' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await poolController.createMaintenanceLog(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
