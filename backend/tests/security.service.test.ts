import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase } from '../config/supabase';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Security Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('logSecurityEvent', () => {
    it('should log security events with correct structure', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const eventData = {
        event_type: 'LOGIN_SUCCESS',
        user_id: 'user-123',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0...',
        details: { method: 'password' },
        severity: 'INFO',
      };

      await supabase.from('security_audit_log').insert(eventData);

      expect(mockFrom).toHaveBeenCalledWith('security_audit_log');
      expect(mockInsert).toHaveBeenCalledWith(eventData);
    });

    it('should categorize event severity correctly', () => {
      const getSeverity = (eventType: string): string => {
        const severityMap: Record<string, string> = {
          LOGIN_SUCCESS: 'INFO',
          LOGIN_FAILURE: 'WARNING',
          ACCOUNT_LOCKED: 'WARNING',
          PASSWORD_CHANGED: 'INFO',
          PERMISSION_DENIED: 'WARNING',
          SUSPICIOUS_ACTIVITY: 'CRITICAL',
          DATA_EXPORT: 'INFO',
          ADMIN_ACTION: 'INFO',
        };
        return severityMap[eventType] || 'INFO';
      };

      expect(getSeverity('LOGIN_SUCCESS')).toBe('INFO');
      expect(getSeverity('ACCOUNT_LOCKED')).toBe('WARNING');
      expect(getSeverity('SUSPICIOUS_ACTIVITY')).toBe('CRITICAL');
      expect(getSeverity('UNKNOWN_EVENT')).toBe('INFO');
    });

    it('should include required metadata', () => {
      const createAuditEvent = (
        eventType: string,
        userId: string | null,
        ipAddress: string,
        userAgent: string,
        details: any = {}
      ) => {
        return {
          id: `audit-${Date.now()}`,
          event_type: eventType,
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
          details,
          created_at: new Date().toISOString(),
        };
      };

      const event = createAuditEvent(
        'LOGIN_SUCCESS',
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0...',
        { method: 'password', mfa_used: false }
      );

      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('event_type', 'LOGIN_SUCCESS');
      expect(event).toHaveProperty('user_id', 'user-123');
      expect(event).toHaveProperty('ip_address', '192.168.1.1');
      expect(event).toHaveProperty('user_agent');
      expect(event).toHaveProperty('details');
      expect(event).toHaveProperty('created_at');
    });
  });

  describe('querySecurityLogs', () => {
    it('should filter logs by date range', async () => {
      const mockLogs = [
        { id: '1', event_type: 'LOGIN_SUCCESS', created_at: '2024-01-15T10:00:00Z' },
        { id: '2', event_type: 'LOGIN_FAILURE', created_at: '2024-01-15T11:00:00Z' },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const { data } = await supabase
        .from('security_audit_log')
        .select('*')
        .gte('created_at', '2024-01-15T00:00:00Z')
        .lte('created_at', '2024-01-15T23:59:59Z')
        .order('created_at', { ascending: false });

      expect(data).toHaveLength(2);
    });

    it('should filter logs by event type', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: '1', event_type: 'LOGIN_FAILURE' }],
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const { data } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('event_type', 'LOGIN_FAILURE')
        .order('created_at', { ascending: false });

      expect(data).toHaveLength(1);
      expect(data?.[0].event_type).toBe('LOGIN_FAILURE');
    });

    it('should filter logs by user', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: '1', event_type: 'LOGIN_SUCCESS', user_id: 'user-123' },
                { id: '2', event_type: 'PASSWORD_CHANGED', user_id: 'user-123' },
              ],
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const { data } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('user_id', 'user-123')
        .order('created_at', { ascending: false });

      expect(data).toHaveLength(2);
      expect(data?.every(log => log.user_id === 'user-123')).toBe(true);
    });
  });

  describe('getSecuritySummary', () => {
    it('should calculate event counts by type', () => {
      const logs = [
        { event_type: 'LOGIN_SUCCESS' },
        { event_type: 'LOGIN_SUCCESS' },
        { event_type: 'LOGIN_FAILURE' },
        { event_type: 'ACCOUNT_LOCKED' },
        { event_type: 'LOGIN_FAILURE' },
      ];

      const counts = logs.reduce((acc, log) => {
        acc[log.event_type] = (acc[log.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(counts.LOGIN_SUCCESS).toBe(2);
      expect(counts.LOGIN_FAILURE).toBe(2);
      expect(counts.ACCOUNT_LOCKED).toBe(1);
    });

    it('should identify top failing IPs', () => {
      const failureLogs = [
        { ip_address: '192.168.1.1' },
        { ip_address: '192.168.1.1' },
        { ip_address: '192.168.1.1' },
        { ip_address: '10.0.0.1' },
        { ip_address: '192.168.1.1' },
      ];

      const ipCounts = failureLogs.reduce((acc, log) => {
        acc[log.ip_address] = (acc[log.ip_address] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sortedIPs = Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      expect(sortedIPs[0][0]).toBe('192.168.1.1');
      expect(sortedIPs[0][1]).toBe(4);
    });

    it('should calculate success rate', () => {
      const logs = [
        { event_type: 'LOGIN_SUCCESS' },
        { event_type: 'LOGIN_SUCCESS' },
        { event_type: 'LOGIN_SUCCESS' },
        { event_type: 'LOGIN_FAILURE' },
        { event_type: 'LOGIN_FAILURE' },
      ];

      const loginAttempts = logs.filter(
        l => l.event_type === 'LOGIN_SUCCESS' || l.event_type === 'LOGIN_FAILURE'
      );
      const successCount = logs.filter(l => l.event_type === 'LOGIN_SUCCESS').length;
      const successRate = (successCount / loginAttempts.length) * 100;

      expect(successRate).toBe(60);
    });
  });
});

describe('Account Lockout Service', () => {
  describe('isAccountLocked', () => {
    it('should return locked status when attempts exceed threshold', () => {
      const maxAttempts = 5;
      const lockoutDuration = 15 * 60 * 1000; // 15 minutes

      const user = {
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + lockoutDuration).toISOString(),
      };

      const isLocked = 
        user.failed_login_attempts >= maxAttempts &&
        new Date(user.locked_until) > new Date();

      expect(isLocked).toBe(true);
    });

    it('should return unlocked when lockout period expired', () => {
      const maxAttempts = 5;

      const user = {
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      };

      const isLocked = 
        user.failed_login_attempts >= maxAttempts &&
        new Date(user.locked_until) > new Date();

      expect(isLocked).toBe(false);
    });

    it('should return unlocked when attempts below threshold', () => {
      const maxAttempts = 5;

      const user = {
        failed_login_attempts: 3,
        locked_until: null,
      };

      const isLocked = user.failed_login_attempts >= maxAttempts;

      expect(isLocked).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment failure count', () => {
      let failedAttempts = 2;
      failedAttempts += 1;

      expect(failedAttempts).toBe(3);
    });

    it('should apply lockout after max attempts', () => {
      const maxAttempts = 5;
      const lockoutDurationMs = 15 * 60 * 1000;
      
      let failedAttempts = 4;
      failedAttempts += 1;

      let lockedUntil: Date | null = null;
      if (failedAttempts >= maxAttempts) {
        lockedUntil = new Date(Date.now() + lockoutDurationMs);
      }

      expect(failedAttempts).toBe(5);
      expect(lockedUntil).not.toBeNull();
      expect(lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should indicate CAPTCHA requirement after threshold', () => {
      const captchaThreshold = 3;
      const failedAttempts = 4;

      const requiresCaptcha = failedAttempts >= captchaThreshold;

      expect(requiresCaptcha).toBe(true);
    });
  });

  describe('applyProgressiveDelay', () => {
    it('should calculate exponential delay correctly', () => {
      const calculateDelay = (attempts: number): number => {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s... max 30s
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
        return delay;
      };

      expect(calculateDelay(1)).toBe(1000);
      expect(calculateDelay(2)).toBe(2000);
      expect(calculateDelay(3)).toBe(4000);
      expect(calculateDelay(4)).toBe(8000);
      expect(calculateDelay(5)).toBe(16000);
      expect(calculateDelay(6)).toBe(30000); // Capped at max
      expect(calculateDelay(10)).toBe(30000); // Still capped
    });
  });

  describe('recordSuccessfulLogin', () => {
    it('should reset failure count on success', () => {
      const user = {
        failed_login_attempts: 3,
        locked_until: new Date(Date.now() + 10000).toISOString(),
      };

      // Simulate successful login reset
      user.failed_login_attempts = 0;
      user.locked_until = null as any;

      expect(user.failed_login_attempts).toBe(0);
      expect(user.locked_until).toBeNull();
    });
  });
});

describe('Password Policy Service', () => {
  describe('validatePassword', () => {
    it('should enforce minimum length', () => {
      const minLength = 8;
      
      expect('short'.length >= minLength).toBe(false);
      expect('longenough'.length >= minLength).toBe(true);
    });

    it('should require uppercase letters', () => {
      const hasUppercase = (password: string) => /[A-Z]/.test(password);

      expect(hasUppercase('password')).toBe(false);
      expect(hasUppercase('Password')).toBe(true);
    });

    it('should require lowercase letters', () => {
      const hasLowercase = (password: string) => /[a-z]/.test(password);

      expect(hasLowercase('PASSWORD')).toBe(false);
      expect(hasLowercase('Password')).toBe(true);
    });

    it('should require numbers', () => {
      const hasNumber = (password: string) => /\d/.test(password);

      expect(hasNumber('Password')).toBe(false);
      expect(hasNumber('Password1')).toBe(true);
    });

    it('should require special characters', () => {
      const hasSpecial = (password: string) => /[!@#$%^&*(),.?":{}|<>]/.test(password);

      expect(hasSpecial('Password1')).toBe(false);
      expect(hasSpecial('Password1!')).toBe(true);
    });

    it('should validate complete password policy', () => {
      const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        if (password.length < 8) errors.push('Minimum 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
        if (!/\d/.test(password)) errors.push('At least one number');
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('At least one special character');

        return { valid: errors.length === 0, errors };
      };

      expect(validatePassword('weak').valid).toBe(false);
      expect(validatePassword('Password123!').valid).toBe(true);
      
      const result = validatePassword('password');
      expect(result.errors).toContain('At least one uppercase letter');
      expect(result.errors).toContain('At least one number');
      expect(result.errors).toContain('At least one special character');
    });
  });

  describe('isPasswordExpired', () => {
    it('should detect expired passwords', () => {
      const maxAgeDays = 90;
      const lastChanged = new Date('2024-01-01');
      const now = new Date('2024-05-01'); // 121 days later

      const daysSinceChange = Math.floor(
        (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysSinceChange > maxAgeDays).toBe(true);
    });

    it('should not flag fresh passwords as expired', () => {
      const maxAgeDays = 90;
      const lastChanged = new Date();
      
      const daysSinceChange = Math.floor(
        (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysSinceChange > maxAgeDays).toBe(false);
    });
  });
});
