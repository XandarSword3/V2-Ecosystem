import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

import { getSupabase } from '../../../src/database/connection';
import { getAuditLogs, getAuditLogsByResource } from '../../../src/modules/admin/controllers/audit.controller';

describe('AuditController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with user details', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-1',
          action: 'CREATE',
          resource: 'chalet',
          resource_id: 'chalet-1',
          old_value: null,
          new_value: '{"name": "Beach Chalet"}',
          created_at: '2026-01-15T10:00:00Z',
          users: { full_name: 'John Doe', email: 'john@example.com' }
        },
        {
          id: 'log-2',
          user_id: 'user-2',
          action: 'UPDATE',
          resource: 'menu_item',
          resource_id: 'item-1',
          old_value: { price: 10 },
          new_value: { price: 15 },
          created_at: '2026-01-15T09:00:00Z',
          users: { full_name: 'Jane Smith', email: 'jane@example.com' }
        }
      ];

      const queryBuilder = createChainableMock(mockLogs);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({ query: { limit: '50', offset: '0' } });
      await getAuditLogs(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'log-1',
            action: 'CREATE',
            entity_type: 'chalet',
            entity_id: 'chalet-1'
          })
        ])
      }));
    });

    it('should parse JSON old_value and new_value strings', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-1',
          action: 'UPDATE',
          resource: 'settings',
          resource_id: 'setting-1',
          old_value: '{"theme": "dark"}',
          new_value: '{"theme": "light"}',
          created_at: '2026-01-15T10:00:00Z',
          users: { full_name: 'Admin', email: 'admin@example.com' }
        }
      ];

      const queryBuilder = createChainableMock(mockLogs);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getAuditLogs(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            old_values: { theme: 'dark' },
            new_values: { theme: 'light' }
          })
        ])
      }));
    });

    it('should use default pagination values', async () => {
      const queryBuilder = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getAuditLogs(req, res, next);

      expect(queryBuilder.range).toHaveBeenCalledWith(0, 49);
    });

    it('should respect custom pagination', async () => {
      const queryBuilder = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({ query: { limit: '20', offset: '40' } });
      await getAuditLogs(req, res, next);

      expect(queryBuilder.range).toHaveBeenCalledWith(40, 59);
    });

    it('should handle database errors', async () => {
      const queryBuilder = createChainableMock(null, new Error('Database error'));
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getAuditLogs(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle empty logs', async () => {
      const queryBuilder = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getAuditLogs(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle null old_value and new_value', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-1',
          action: 'DELETE',
          resource: 'item',
          resource_id: 'item-1',
          old_value: null,
          new_value: null,
          created_at: '2026-01-15T10:00:00Z',
          users: { full_name: 'Admin', email: 'admin@example.com' }
        }
      ];

      const queryBuilder = createChainableMock(mockLogs);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getAuditLogs(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            old_values: null,
            new_values: null
          })
        ])
      }));
    });
  });

  describe('getAuditLogsByResource', () => {
    it('should return logs for a specific resource type', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-1',
          action: 'UPDATE',
          resource: 'chalet',
          resource_id: 'chalet-1',
          created_at: '2026-01-15T10:00:00Z',
          users: { full_name: 'John', email: 'john@example.com' }
        }
      ];

      const queryBuilder = createChainableMock(mockLogs);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { resource: 'chalet' },
        query: {}
      });
      await getAuditLogsByResource(req, res, next);

      expect(queryBuilder.eq).toHaveBeenCalledWith('resource', 'chalet');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs
      });
    });

    it('should filter by resource ID when provided', async () => {
      const mockLogs = [];
      const queryBuilder = createChainableMock(mockLogs);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { resource: 'chalet', resourceId: 'chalet-123' },
        query: {}
      });
      await getAuditLogsByResource(req, res, next);

      expect(queryBuilder.eq).toHaveBeenCalledWith('resource', 'chalet');
      expect(queryBuilder.eq).toHaveBeenCalledWith('resource_id', 'chalet-123');
    });

    it('should respect limit parameter', async () => {
      const queryBuilder = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { resource: 'chalet' },
        query: { limit: '10' }
      });
      await getAuditLogsByResource(req, res, next);

      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should use default limit of 20', async () => {
      const queryBuilder = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { resource: 'chalet' },
        query: {}
      });
      await getAuditLogsByResource(req, res, next);

      expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    });

    it('should handle database errors', async () => {
      const queryBuilder = createChainableMock(null, new Error('Database error'));
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { resource: 'chalet' },
        query: {}
      });
      await getAuditLogsByResource(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
