import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: {}, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
});

vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  logSecurityEvent,
  logLoginSuccess,
  logLoginFailure,
  logAccountLocked,
  logPasswordChange,
  SecurityEventType,
  SecurityEventSeverity,
} from '../../../src/services/security-audit.service';

describe('SecurityAuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  describe('logSecurityEvent', () => {
    it('should log a security event to database', async () => {
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        userId: 'user-1',
        description: 'User logged in',
      });

      expect(mockFrom).toHaveBeenCalledWith('security_audit_log');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: SecurityEventType.LOGIN_SUCCESS,
          severity: SecurityEventSeverity.INFO,
          user_id: 'user-1',
          description: 'User logged in',
        }),
      );
    });

    it('should handle metadata', async () => {
      await logSecurityEvent({
        eventType: SecurityEventType.LOGIN_FAILURE,
        severity: SecurityEventSeverity.WARNING,
        description: 'Failed login',
        metadata: { reason: 'invalid_password' },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: JSON.stringify({ reason: 'invalid_password' }),
        }),
      );
    });

    it('should not throw on database error', async () => {
      mockInsert.mockResolvedValue({ error: new Error('DB Error') });

      await expect(logSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        description: 'Test event',
      })).resolves.not.toThrow();
    });
  });

  describe('logLoginSuccess', () => {
    it('should log successful login', async () => {
      await logLoginSuccess('user-1', '192.168.1.1', 'Mozilla/5.0');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: SecurityEventType.LOGIN_SUCCESS,
          severity: SecurityEventSeverity.INFO,
          user_id: 'user-1',
          ip_address: '192.168.1.1',
        }),
      );
    });

    it('should support different login methods', async () => {
      await logLoginSuccess('user-1', '192.168.1.1', 'Mozilla/5.0', '2fa');

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('logLoginFailure', () => {
    it('should log failed login attempt', async () => {
      await logLoginFailure('user@test.com', '192.168.1.1', 'Mozilla/5.0', 'invalid_password');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: SecurityEventType.LOGIN_FAILURE,
          severity: SecurityEventSeverity.WARNING,
        }),
      );
    });
  });

  describe('logAccountLocked', () => {
    it('should log account lockout', async () => {
      await logAccountLocked('user-1', '192.168.1.1', 'Too many failed attempts');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: SecurityEventType.ACCOUNT_LOCKED,
        }),
      );
    });
  });

  describe('logPasswordChange', () => {
    it('should log password change', async () => {
      await logPasswordChange('user-1', '192.168.1.1');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: SecurityEventType.PASSWORD_CHANGE,
          user_id: 'user-1',
        }),
      );
    });
  });

  describe('SecurityEventType enum', () => {
    it('should have login events', () => {
      expect(SecurityEventType.LOGIN_SUCCESS).toBeDefined();
      expect(SecurityEventType.LOGIN_FAILURE).toBeDefined();
    });

    it('should have account events', () => {
      expect(SecurityEventType.ACCOUNT_LOCKED).toBeDefined();
      expect(SecurityEventType.PASSWORD_CHANGE).toBeDefined();
    });
  });

  describe('SecurityEventSeverity enum', () => {
    it('should have severity levels', () => {
      expect(SecurityEventSeverity.INFO).toBeDefined();
      expect(SecurityEventSeverity.WARNING).toBeDefined();
      expect(SecurityEventSeverity.CRITICAL).toBeDefined();
    });
  });
});
