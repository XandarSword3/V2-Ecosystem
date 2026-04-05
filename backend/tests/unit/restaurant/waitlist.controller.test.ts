import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';
import { waitlistController } from '../../../src/modules/restaurant/waitlist/waitlist.controller';
import { getSupabase } from '../../../src/database/connection';
import { emitToAll } from '../../../src/socket/index';

// Mock dependencies
vi.mock('../../../src/database/connection');
vi.mock('../../../src/socket/index');
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('Waitlist Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(emitToAll).mockImplementation(() => {});
  });

  describe('getWaitlist', () => {
    it('should return waitlist entries', async () => {
      const mockEntries = [
        { id: 'entry-1', customer_name: 'John', party_size: 4, status: 'waiting' }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockEntries, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        query: { type: 'restaurant' }
      });

      await waitlistController.getWaitlist(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'entry-1',
            customer_name: 'John',
            guest_name: 'John',
            party_size: 4,
            status: 'waiting',
            position: 1,
            estimated_wait: 10,
          }),
        ]),
      }));
    });

    it('should return entries without type filter', async () => {
      const mockEntries = [{ id: 'entry-1' }];

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEntries, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        query: {}
      });

      await waitlistController.getWaitlist(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'entry-1',
            position: 1,
            estimated_wait: 10,
          }),
        ]),
      }));
    });

    it('should handle errors', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        query: {}
      });

      await waitlistController.getWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'DB error' });
    });
  });

  describe('getEntry', () => {
    it('should return a single entry', async () => {
      const mockEntry = { id: 'entry-1', customer_name: 'Jane', party_size: 2 };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockEntry, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        params: { id: 'entry-1' }
      });

      await waitlistController.getEntry(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'entry-1',
          customer_name: 'Jane',
          guest_name: 'Jane',
          party_size: 2,
          position: 1,
          estimated_wait: 10,
        }),
      }));
    });

    it('should return 404 if entry not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        params: { id: 'entry-999' }
      });

      await waitlistController.getEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Entry not found' });
    });
  });

  describe('join', () => {
    it('should add a customer to waitlist', async () => {
      const mockEntry = { 
        id: 'entry-new', 
        customer_name: 'Bob', 
        party_size: 3,
        status: 'waiting',
        phone_number: '555-1234',
        created_at: '2025-01-01T10:00:00Z',
      };

      let fromCalls = 0;
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          fromCalls += 1;

          if (fromCalls === 1) {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockEntry, error: null }),
            };
          }

          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ count: 1, error: null }),
          };
        }),
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        body: { 
          customerName: 'Bob',
          partySize: 3,
          phone: '555-1234',
          type: 'restaurant'
        }
      });

      await waitlistController.join(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'entry-new',
          customer_name: 'Bob',
          guest_name: 'Bob',
          party_size: 3,
          phone: '555-1234',
          position: 1,
          estimated_wait: 10,
        }),
      }));
      expect(emitToAll).toHaveBeenCalledWith('waitlist.updated', expect.objectContaining({
        type: 'restaurant',
        action: 'join',
        entry: expect.objectContaining({
          id: 'entry-new',
        }),
      }));
    });

    it('should accept snake_case field names', async () => {
      const mockEntry = { 
        id: 'entry-new', 
        customer_name: 'Alice', 
        party_size: 2,
        phone_number: '555-5678',
        created_at: '2025-01-01T10:00:00Z',
      };

      let fromCalls = 0;
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          fromCalls += 1;

          if (fromCalls === 1) {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockEntry, error: null }),
            };
          }

          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ count: 1, error: null }),
          };
        }),
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        body: { 
          guest_name: 'Alice',
          party_size: 2,
          phone_number: '555-5678'
        }
      });

      await waitlistController.join(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for invalid data', async () => {
      const { req, res } = createMockReqRes({
        body: { partySize: 2 } // Missing customerName
      });

      await waitlistController.join(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle database errors', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        body: { 
          customerName: 'Test',
          partySize: 2
        }
      });

      await waitlistController.join(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateStatus', () => {
    it('should update entry to notified', async () => {
      const mockUpdated = { 
        id: 'entry-1', 
        status: 'notified',
        notified_at: expect.any(String)
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        params: { id: 'entry-1' },
        body: { status: 'notified' }
      });

      await waitlistController.updateStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
      expect(emitToAll).toHaveBeenCalledWith('waitlist.updated', {
        action: 'update',
        entry: mockUpdated
      });
    });

    it('should update entry to seated', async () => {
      const mockUpdated = { 
        id: 'entry-1', 
        status: 'seated',
        seated_at: expect.any(String)
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        params: { id: 'entry-1' },
        body: { status: 'seated' }
      });

      await waitlistController.updateStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it('should update entry to cancelled', async () => {
      const mockUpdated = { id: 'entry-1', status: 'cancelled' };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res } = createMockReqRes({
        params: { id: 'entry-1' },
        body: { status: 'cancelled' }
      });

      await waitlistController.updateStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it('should return 400 for invalid status', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'entry-1' },
        body: { status: 'invalid_status' }
      });

      await waitlistController.updateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid status' });
    });
  });
});
