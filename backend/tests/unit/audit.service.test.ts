/**
 * Audit Service Tests
 * Tests for DI-based audit/activity logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuditService, AuditServiceError } from '../../src/lib/services/audit.service.js';
import { createInMemoryAuditRepository } from '../../src/lib/repositories/audit.repository.memory.js';
import type { AuditLog, AuditAction, AuditResource, LoggerService } from '../../src/lib/container/types.js';

describe('AuditService', () => {
  let auditRepository: ReturnType<typeof createInMemoryAuditRepository>;
  let logger: LoggerService;
  let service: ReturnType<typeof createAuditService>;

  const validUserId = '550e8400-e29b-41d4-a716-446655440000';
  const validUserId2 = '550e8400-e29b-41d4-a716-446655440001';

  const mockLog: AuditLog = {
    id: 'audit-123',
    user_id: validUserId,
    action: 'create',
    resource: 'booking',
    resource_id: 'booking-456',
    old_value: null,
    new_value: { status: 'confirmed' },
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    created_at: '2024-01-01T10:00:00Z'
  };

  beforeEach(() => {
    auditRepository = createInMemoryAuditRepository();
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    service = createAuditService({ auditRepository, logger });

    // Add user info for enrichment tests
    auditRepository.addUser({
      id: validUserId,
      full_name: 'John Doe',
      email: 'john@example.com'
    });
  });

  // ============================================
  // logActivity Tests
  // ============================================

  describe('logActivity', () => {
    it('should create an audit log entry', async () => {
      const result = await service.logActivity({
        userId: validUserId,
        action: 'create',
        resource: 'booking',
        resourceId: 'booking-123',
        newValue: { status: 'confirmed' }
      });

      expect(result).toMatchObject({
        user_id: validUserId,
        action: 'create',
        resource: 'booking',
        resource_id: 'booking-123'
      });
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeDefined();
    });

    it('should log with optional fields', async () => {
      const result = await service.logActivity({
        userId: validUserId,
        action: 'update',
        resource: 'order',
        resourceId: 'order-123',
        oldValue: { status: 'pending' },
        newValue: { status: 'completed' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      expect(result.old_value).toEqual({ status: 'pending' });
      expect(result.new_value).toEqual({ status: 'completed' });
      expect(result.ip_address).toBe('192.168.1.1');
      expect(result.user_agent).toBe('Mozilla/5.0');
    });

    it('should throw for invalid user ID', async () => {
      await expect(service.logActivity({
        userId: '',
        action: 'create',
        resource: 'booking'
      })).rejects.toThrow('User ID is required');

      await expect(service.logActivity({
        userId: 'invalid-uuid',
        action: 'create',
        resource: 'booking'
      })).rejects.toThrow('Invalid user ID format');
    });

    it('should throw for invalid action', async () => {
      await expect(service.logActivity({
        userId: validUserId,
        action: 'invalid_action' as AuditAction,
        resource: 'booking'
      })).rejects.toThrow('Invalid action');
    });

    it('should throw for invalid resource', async () => {
      await expect(service.logActivity({
        userId: validUserId,
        action: 'create',
        resource: 'invalid_resource' as AuditResource
      })).rejects.toThrow('Invalid resource');
    });

    it('should throw for empty resource ID', async () => {
      await expect(service.logActivity({
        userId: validUserId,
        action: 'create',
        resource: 'booking',
        resourceId: ''
      })).rejects.toThrow('Resource ID must be a non-empty string');
    });

    it('should throw for non-object old/new values', async () => {
      await expect(service.logActivity({
        userId: validUserId,
        action: 'update',
        resource: 'booking',
        oldValue: 'string' as unknown as Record<string, unknown>
      })).rejects.toThrow('oldValue must be an object');
    });

    it.each([
      'create', 'update', 'delete', 'login', 'logout',
      'password_change', 'role_change', 'status_change', 'settings_update'
    ] as AuditAction[])('should accept valid action: %s', async (action) => {
      const result = await service.logActivity({
        userId: validUserId,
        action,
        resource: 'user'
      });
      expect(result.action).toBe(action);
    });

    it.each([
      'user', 'booking', 'order', 'chalet', 'menu_item',
      'review', 'settings', 'pool_ticket', 'snack_item', 'support_inquiry'
    ] as AuditResource[])('should accept valid resource: %s', async (resource) => {
      const result = await service.logActivity({
        userId: validUserId,
        action: 'create',
        resource
      });
      expect(result.resource).toBe(resource);
    });
  });

  // ============================================
  // getLogs Tests
  // ============================================

  describe('getLogs', () => {
    beforeEach(() => {
      auditRepository.addLog(mockLog);
      auditRepository.addLog({
        ...mockLog,
        id: 'audit-124',
        action: 'update',
        created_at: '2024-01-02T10:00:00Z'
      });
      auditRepository.addLog({
        ...mockLog,
        id: 'audit-125',
        user_id: validUserId2,
        resource: 'order',
        created_at: '2024-01-03T10:00:00Z'
      });
    });

    it('should return all logs with pagination', async () => {
      const result = await service.getLogs();

      expect(result.total).toBe(3);
      expect(result.logs).toHaveLength(3);
    });

    it('should filter by user ID', async () => {
      const result = await service.getLogs({
        filters: { userId: validUserId }
      });

      expect(result.total).toBe(2);
      expect(result.logs.every(l => l.user_id === validUserId)).toBe(true);
    });

    it('should filter by action', async () => {
      const result = await service.getLogs({
        filters: { action: 'create' }
      });

      expect(result.logs.every(l => l.action === 'create')).toBe(true);
    });

    it('should filter by resource', async () => {
      const result = await service.getLogs({
        filters: { resource: 'booking' }
      });

      expect(result.logs.every(l => l.resource === 'booking')).toBe(true);
    });

    it('should filter by date range', async () => {
      const result = await service.getLogs({
        filters: {
          startDate: '2024-01-02T00:00:00Z',
          endDate: '2024-01-02T23:59:59Z'
        }
      });

      expect(result.total).toBe(1);
    });

    it('should apply pagination', async () => {
      const result = await service.getLogs({
        limit: 2,
        offset: 0
      });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('should enrich with user info', async () => {
      const result = await service.getLogs({
        filters: { userId: validUserId }
      });

      expect(result.logs[0].user).toEqual({
        full_name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should throw for invalid limit', async () => {
      await expect(service.getLogs({ limit: 0 }))
        .rejects.toThrow('Limit must be between 1 and 1000');
      await expect(service.getLogs({ limit: 1001 }))
        .rejects.toThrow('Limit must be between 1 and 1000');
    });

    it('should throw for invalid offset', async () => {
      await expect(service.getLogs({ offset: -1 }))
        .rejects.toThrow('Offset must be a non-negative integer');
    });

    it('should throw for invalid date range', async () => {
      await expect(service.getLogs({
        filters: {
          startDate: '2024-02-01',
          endDate: '2024-01-01'
        }
      })).rejects.toThrow('Start date must be before end date');
    });

    it('should throw for invalid date format', async () => {
      await expect(service.getLogs({
        filters: { startDate: 'invalid-date' }
      })).rejects.toThrow('Invalid start date format');
    });
  });

  // ============================================
  // getLogById Tests
  // ============================================

  describe('getLogById', () => {
    it('should return log by ID', async () => {
      auditRepository.addLog(mockLog);

      const result = await service.getLogById('audit-123');

      expect(result).toMatchObject({
        id: 'audit-123',
        action: 'create',
        resource: 'booking'
      });
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.getLogById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw for empty ID', async () => {
      await expect(service.getLogById('')).rejects.toThrow('Log ID is required');
    });
  });

  // ============================================
  // getLogsByResource Tests
  // ============================================

  describe('getLogsByResource', () => {
    beforeEach(() => {
      auditRepository.addLog({ ...mockLog, resource: 'booking', resource_id: 'b1' });
      auditRepository.addLog({ ...mockLog, id: 'a2', resource: 'booking', resource_id: 'b2' });
      auditRepository.addLog({ ...mockLog, id: 'a3', resource: 'order', resource_id: 'o1' });
    });

    it('should return logs for a resource type', async () => {
      const result = await service.getLogsByResource('booking');

      expect(result).toHaveLength(2);
      expect(result.every(l => l.resource === 'booking')).toBe(true);
    });

    it('should filter by resource ID', async () => {
      const result = await service.getLogsByResource('booking', 'b1');

      expect(result).toHaveLength(1);
      expect(result[0].resource_id).toBe('b1');
    });

    it('should throw for invalid resource', async () => {
      await expect(service.getLogsByResource('invalid' as AuditResource))
        .rejects.toThrow('Invalid resource');
    });
  });

  // ============================================
  // getUserActivity Tests
  // ============================================

  describe('getUserActivity', () => {
    beforeEach(() => {
      auditRepository.addLog(mockLog);
      auditRepository.addLog({ ...mockLog, id: 'a2', action: 'update' });
      auditRepository.addLog({ ...mockLog, id: 'a3', user_id: validUserId2 });
    });

    it('should return activity for a user', async () => {
      const result = await service.getUserActivity(validUserId);

      expect(result).toHaveLength(2);
      expect(result.every(l => l.user_id === validUserId)).toBe(true);
    });

    it('should limit results', async () => {
      const result = await service.getUserActivity(validUserId, 1);

      expect(result).toHaveLength(1);
    });

    it('should throw for invalid user ID', async () => {
      await expect(service.getUserActivity('invalid'))
        .rejects.toThrow('Invalid user ID format');
    });
  });

  // ============================================
  // getRecentLogins Tests
  // ============================================

  describe('getRecentLogins', () => {
    beforeEach(() => {
      auditRepository.addLog({ ...mockLog, action: 'login' });
      auditRepository.addLog({ ...mockLog, id: 'a2', action: 'login' });
      auditRepository.addLog({ ...mockLog, id: 'a3', action: 'create' });
    });

    it('should return only login actions', async () => {
      const result = await service.getRecentLogins();

      expect(result).toHaveLength(2);
      expect(result.every(l => l.action === 'login')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await service.getRecentLogins(1);

      expect(result).toHaveLength(1);
    });
  });

  // ============================================
  // getRecentChanges Tests
  // ============================================

  describe('getRecentChanges', () => {
    beforeEach(() => {
      auditRepository.addLog({ ...mockLog, resource: 'booking' });
      auditRepository.addLog({ ...mockLog, id: 'a2', resource: 'booking' });
      auditRepository.addLog({ ...mockLog, id: 'a3', resource: 'order' });
    });

    it('should return changes for a resource type', async () => {
      const result = await service.getRecentChanges('booking');

      expect(result).toHaveLength(2);
      expect(result.every(l => l.resource === 'booking')).toBe(true);
    });

    it('should throw for invalid resource', async () => {
      await expect(service.getRecentChanges('invalid' as AuditResource))
        .rejects.toThrow('Invalid resource');
    });
  });

  // ============================================
  // cleanupOldLogs Tests
  // ============================================

  describe('cleanupOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      auditRepository.addLog({
        ...mockLog,
        created_at: oldDate.toISOString()
      });
      auditRepository.addLog({
        ...mockLog,
        id: 'a2',
        created_at: new Date().toISOString()
      });

      const deleted = await service.cleanupOldLogs(90);

      expect(deleted).toBe(1);
      expect(auditRepository.getAllLogs()).toHaveLength(1);
    });

    it('should throw for invalid days', async () => {
      await expect(service.cleanupOldLogs(0))
        .rejects.toThrow('Days must be a positive integer');
      await expect(service.cleanupOldLogs(-1))
        .rejects.toThrow('Days must be a positive integer');
    });

    it('should enforce minimum retention of 30 days', async () => {
      await expect(service.cleanupOldLogs(29))
        .rejects.toThrow('Cannot delete logs newer than 30 days');
    });

    it('should log cleanup action', async () => {
      await service.cleanupOldLogs(90);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up')
      );
    });
  });

  // ============================================
  // Convenience Methods Tests
  // ============================================

  describe('logLogin', () => {
    it('should create a login log', async () => {
      const result = await service.logLogin(validUserId, '192.168.1.1', 'Chrome');

      expect(result.action).toBe('login');
      expect(result.resource).toBe('user');
      expect(result.resource_id).toBe(validUserId);
      expect(result.ip_address).toBe('192.168.1.1');
    });
  });

  describe('logLogout', () => {
    it('should create a logout log', async () => {
      const result = await service.logLogout(validUserId);

      expect(result.action).toBe('logout');
      expect(result.resource).toBe('user');
    });
  });

  describe('logCreate', () => {
    it('should create a create log', async () => {
      const result = await service.logCreate(
        validUserId,
        'booking',
        'booking-123',
        { status: 'confirmed' }
      );

      expect(result.action).toBe('create');
      expect(result.resource).toBe('booking');
      expect(result.new_value).toEqual({ status: 'confirmed' });
    });
  });

  describe('logUpdate', () => {
    it('should create an update log with old and new values', async () => {
      const result = await service.logUpdate(
        validUserId,
        'order',
        'order-123',
        { status: 'pending' },
        { status: 'completed' }
      );

      expect(result.action).toBe('update');
      expect(result.old_value).toEqual({ status: 'pending' });
      expect(result.new_value).toEqual({ status: 'completed' });
    });
  });

  describe('logDelete', () => {
    it('should create a delete log with old value', async () => {
      const result = await service.logDelete(
        validUserId,
        'menu_item',
        'item-123',
        { name: 'Deleted Item', price: 10 }
      );

      expect(result.action).toBe('delete');
      expect(result.old_value).toEqual({ name: 'Deleted Item', price: 10 });
    });
  });

  describe('logSettingsUpdate', () => {
    it('should create a settings update log', async () => {
      const result = await service.logSettingsUpdate(
        validUserId,
        { site_name: 'Old Name' },
        { site_name: 'New Name' }
      );

      expect(result.action).toBe('settings_update');
      expect(result.resource).toBe('settings');
    });
  });

  // ============================================
  // Utility Methods Tests
  // ============================================

  describe('getValidActions', () => {
    it('should return all valid actions', () => {
      const actions = service.getValidActions();

      expect(actions).toContain('create');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('login');
      expect(actions).toContain('logout');
    });
  });

  describe('getValidResources', () => {
    it('should return all valid resources', () => {
      const resources = service.getValidResources();

      expect(resources).toContain('user');
      expect(resources).toContain('booking');
      expect(resources).toContain('order');
      expect(resources).toContain('chalet');
    });
  });

  // ============================================
  // getAuditSummary Tests
  // ============================================

  describe('getAuditSummary', () => {
    beforeEach(() => {
      auditRepository.addLog({ ...mockLog, action: 'create', resource: 'booking' });
      auditRepository.addLog({ ...mockLog, id: 'a2', action: 'create', resource: 'order' });
      auditRepository.addLog({ ...mockLog, id: 'a3', action: 'update', resource: 'booking' });
      auditRepository.addLog({ ...mockLog, id: 'a4', action: 'login', resource: 'user' });
    });

    it('should return summary statistics', async () => {
      const result = await service.getAuditSummary();

      expect(result.totalLogs).toBe(4);
      expect(result.byAction['create']).toBe(2);
      expect(result.byAction['update']).toBe(1);
      expect(result.byAction['login']).toBe(1);
      expect(result.byResource['booking']).toBe(2);
      expect(result.byResource['order']).toBe(1);
      expect(result.byResource['user']).toBe(1);
    });

    it('should filter by date range', async () => {
      // Add log outside date range
      const oldLog = {
        ...mockLog,
        id: 'old-log',
        created_at: '2023-01-01T00:00:00Z'
      };
      auditRepository.addLog(oldLog);

      const result = await service.getAuditSummary('2024-01-01', '2024-12-31');

      expect(result.totalLogs).toBe(4); // Excludes the old log
    });
  });

  // ============================================
  // AuditServiceError Tests
  // ============================================

  describe('AuditServiceError', () => {
    it('should have correct properties', () => {
      const error = new AuditServiceError('Test error', 'TEST_CODE', 404);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('AuditServiceError');
    });

    it('should default to 400 status code', () => {
      const error = new AuditServiceError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(400);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should work without logger', async () => {
      const serviceWithoutLogger = createAuditService({ auditRepository });

      const result = await serviceWithoutLogger.logActivity({
        userId: validUserId,
        action: 'create',
        resource: 'booking'
      });

      expect(result.id).toBeDefined();
    });

    it('should handle null user info gracefully', async () => {
      auditRepository.addLog(mockLog);
      auditRepository.clear();
      auditRepository.addLog(mockLog); // Add back without user

      const result = await service.getLogById('audit-123');

      expect(result?.user).toBeNull();
    });

    it('should handle concurrent log creation', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.logActivity({
          userId: validUserId,
          action: 'create',
          resource: 'booking',
          resourceId: `booking-${i}`
        }));
      }

      await Promise.all(promises);

      const { total } = await service.getLogs();
      expect(total).toBe(10);
    });

    it('should handle complex nested values', async () => {
      const complexValue = {
        items: [
          { id: 1, details: { nested: true } },
          { id: 2, details: { nested: false } }
        ],
        meta: { timestamp: Date.now() }
      };

      const result = await service.logActivity({
        userId: validUserId,
        action: 'create',
        resource: 'order',
        newValue: complexValue
      });

      expect(result.new_value).toEqual(complexValue);
    });

    it('should return empty summary for no logs', async () => {
      const result = await service.getAuditSummary();

      expect(result.totalLogs).toBe(0);
      expect(result.byAction).toEqual({});
      expect(result.byResource).toEqual({});
    });
  });
});
