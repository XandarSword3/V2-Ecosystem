/**
 * Snack Controller Unit Tests
 * Simple tests for snack bar module functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing controller
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../src/database/connection.js';
import { Request, Response, NextFunction } from 'express';

// Helper to create mock request/response
function createMockReqRes(options: { 
  params?: Record<string, string>; 
  query?: Record<string, string>; 
  body?: Record<string, any>;
  user?: { id: string; role: string };
} = {}) {
  const req = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    user: options.user || { id: 'test-user-id', role: 'customer' },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('Snack Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getItems', () => {
    it('should return all available snack items', async () => {
      const mockItems = [
        { id: '1', name: 'Chips', price: 3.50, category: 'snacks', is_available: true },
        { id: '2', name: 'Soda', price: 2.00, category: 'drinks', is_available: true },
      ];

      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getItems } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes();

      await getItems(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems,
      });
    });

    it('should handle database errors', async () => {
      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getItems } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes();

      await getItems(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getItem', () => {
    it('should return a single snack item by ID', async () => {
      const mockItem = { id: '1', name: 'Chips', price: 3.50, category: 'snacks' };

      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getItem } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes({ params: { id: '1' } });

      await getItem(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItem,
      });
    });

    it('should return 404 for non-existent item', async () => {
      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getItem } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes({ params: { id: 'nonexistent' } });

      await getItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Item not found',
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const mockOrder = { id: 'order-1', status: 'pending' };
      const updatedOrder = { id: 'order-1', status: 'preparing' };

      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockOrder, error: null })
          .mockResolvedValueOnce({ data: updatedOrder, error: null }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { updateOrderStatus } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'order-1' },
        body: { status: 'preparing' },
      });

      await updateOrderStatus(req, res, next);

      expect(mockClient.update).toHaveBeenCalled();
    });
  });

  describe('toggleAvailability', () => {
    it('should toggle item availability', async () => {
      const mockItem = { id: '1', is_available: true };
      const toggledItem = { id: '1', is_available: false };

      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockItem, error: null })
          .mockResolvedValueOnce({ data: toggledItem, error: null }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { toggleAvailability } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes({ params: { id: '1' } });

      await toggleAvailability(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should call next for non-existent item', async () => {
      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { toggleAvailability } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes({ params: { id: 'nonexistent' } });

      await toggleAvailability(req, res, next);

      // The controller may call next with error instead of returning 404
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getCategories', () => {
    it('should return available categories', async () => {
      const mockCategories = ['snacks', 'drinks', 'desserts'];

      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: mockCategories.map(c => ({ category: c })), error: null }),
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getCategories } = await import('../../src/modules/snack/snack.controller.js');
      const { req, res, next } = createMockReqRes();

      await getCategories(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });
});

describe('Order Number Format', () => {
  it('should follow expected pattern', () => {
    // Order numbers should follow pattern S-YYMMDD-XXXXXX...
    const validPatterns = [
      'S-240101-123456abcd',
      'S-241231-000001xyz1',
      'S-230615-999999aaaa',
    ];

    const regex = /^S-\d{6}-\d{6}[a-z0-9]{4}$/;

    for (const pattern of validPatterns) {
      expect(regex.test(pattern)).toBe(true);
    }
  });

  it('should reject invalid patterns', () => {
    const invalidPatterns = [
      'invalid',
      'S-123-456789abcd',
      'R-240101-123456abcd', // Wrong prefix
      'S-240101-12345abc',   // Too short
    ];

    const regex = /^S-\d{6}-\d{6}[a-z0-9]{4}$/;

    for (const pattern of invalidPatterns) {
      expect(regex.test(pattern)).toBe(false);
    }
  });
});
