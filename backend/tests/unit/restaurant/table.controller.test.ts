/**
 * Restaurant Table Controller Unit Tests
 * Tests logic in table.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// 1. Mock Database
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// 2. Mock Logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// 3. Mock QRCode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockcode'),
  }
}));

import { getSupabase } from '../../../src/database/connection.js';

// Helper to create mock request/response
function createMockReqRes(options: { 
  params?: Record<string, string>; 
  body?: Record<string, any>;
} = {}) {
  const req = {
    params: options.params || {},
    body: options.body || {},
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('Table Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTables', () => {
    it('should return all tables', async () => {
      const mockTables = [
        { id: '1', table_number: '1', capacity: 4, status: 'available' },
        { id: '2', table_number: '2', capacity: 2, status: 'occupied' }
      ];

      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ // Added eq
                 order: vi.fn().mockResolvedValue({ data: mockTables, error: null })
            })
          })
        })
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getTables } = await import('../../../src/modules/restaurant/controllers/table.controller.js');
      const { req, res, next } = createMockReqRes();

      await getTables(req, res, next);

      expect(mockClient.from).toHaveBeenCalledWith('restaurant_tables');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTables
      });
    });

    it('should handle errors', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ // Added eq
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
            })
          })
        })
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { getTables } = await import('../../../src/modules/restaurant/controllers/table.controller.js');
      const { req, res, next } = createMockReqRes();

      await getTables(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('createTable', () => {
    it('should create a new table', async () => {
      const newTable = { tableNumber: '3', capacity: 6 };
      const createdTable = { id: '3', table_number: '3', capacity: 6, status: 'available' };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: createdTable, error: null })
            })
          })
        })
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { createTable } = await import('../../../src/modules/restaurant/controllers/table.controller.js');
      const { req, res, next } = createMockReqRes({ body: newTable });

      await createTable(req, res, next);

      expect(mockClient.from).toHaveBeenCalledWith('restaurant_tables');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdTable
      });
    });
  });

  describe('updateTable', () => {
    it('should update an existing table', async () => {
      const updateData = { status: 'occupied' };
      const updatedTable = { id: '1', table_number: '1', capacity: 4, ...updateData };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedTable, error: null })
              })
            })
          })
        })
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { updateTable } = await import('../../../src/modules/restaurant/controllers/table.controller.js');
      const { req, res, next } = createMockReqRes({ 
        params: { id: '1' }, 
        body: updateData 
      });

      await updateTable(req, res, next);

      expect(mockClient.from).toHaveBeenCalledWith('restaurant_tables');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTable
      });
    });
  });

  describe('deleteTable', () => {
    it('should delete a table', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      };

      vi.mocked(getSupabase).mockReturnValue(mockClient as any);

      const { deleteTable } = await import('../../../src/modules/restaurant/controllers/table.controller.js');
      const { req, res, next } = createMockReqRes({ params: { id: '1' } });

      await deleteTable(req, res, next);

      expect(mockClient.from).toHaveBeenCalledWith('restaurant_tables');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Table deleted'
      });
    });
  });
});
