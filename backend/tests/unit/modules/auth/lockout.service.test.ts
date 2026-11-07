/**
 * Account Lockout Service Unit Tests
 * 
 * Verifies real business logic of lockout.service:
 * - Tracking failed attempts & window expiry
 * - Progressive delay calculation
 * - Captcha enforcement threshold
 * - Full account lockout & duration
 * - Security alert email notification
 * - Admin manual unlock
 * - Turnstile token validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockCache, mockSendEmail } = vi.hoisted(() => ({
  mockCache: new Map<string, any>(),
  mockSendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../src/utils/cache', () => ({
  cache: {
    get: vi.fn(async (key: string) => mockCache.get(key) || null),
    set: vi.fn(async (key: string, val: any) => {
      mockCache.set(key, val);
    }),
    del: vi.fn(async (key: string) => {
      mockCache.delete(key);
    }),
  },
}));

vi.mock('../../../../src/services/email.service', () => ({
  emailService: {
    sendEmail: mockSendEmail,
  },
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as lockoutService from '../../../../src/modules/auth/lockout.service';

describe('LockoutService (Real Behavior & Branches)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.clear();
  });

  describe('Failed Login Progression & Lockout Thresholds', () => {
    it('initial attempt returns no delay and 4 remaining attempts', async () => {
      const res = await lockoutService.recordFailedAttempt('user@example.com');
      expect(res.locked).toBe(false);
      expect(res.remainingAttempts).toBe(4);
      expect(res.requiresCaptcha).toBe(false);
      expect(res.delayMs).toBe(0);

      const isLocked = await lockoutService.isAccountLocked('user@example.com');
      expect(isLocked.locked).toBe(false);
    });

    it('requires CAPTCHA after 3 failed attempts and gives progressive delay', async () => {
      await lockoutService.recordFailedAttempt('user@example.com');
      await lockoutService.recordFailedAttempt('user@example.com');
      const res3 = await lockoutService.recordFailedAttempt('user@example.com');

      expect(res3.requiresCaptcha).toBe(true);
      expect(res3.remainingAttempts).toBe(2);
      expect(res3.delayMs).toBe(5000); // progressiveDelays[2]

      const captchaReq = await lockoutService.isCaptchaRequired('user@example.com');
      expect(captchaReq).toBe(true);

      const delay = await lockoutService.getProgressiveDelay('user@example.com');
      expect(delay).toBe(15000); // 3 attempts -> index 3
    });

    it('locks account on 5th failed attempt and triggers email notification', async () => {
      for (let i = 0; i < 4; i++) {
        await lockoutService.recordFailedAttempt('target@example.com', 'target@example.com');
      }

      const res5 = await lockoutService.recordFailedAttempt(
        'target@example.com',
        'target@example.com',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(res5.locked).toBe(true);
      expect(res5.remainingAttempts).toBe(0);

      const lockedCheck = await lockoutService.isAccountLocked('target@example.com');
      expect(lockedCheck.locked).toBe(true);
      expect(lockedCheck.message).toMatch(/Account is locked due to too many failed login attempts/);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'target@example.com',
          subject: expect.stringContaining('Account Temporarily Locked'),
        })
      );
    });

    it('clears lockout on successful login', async () => {
      await lockoutService.recordFailedAttempt('user@example.com');
      await lockoutService.recordFailedAttempt('user@example.com');

      await lockoutService.recordSuccessfulLogin('user@example.com');

      const status = await lockoutService.getLockoutStatus('user@example.com');
      expect(status.failedAttempts).toBe(0);
      expect(status.isLocked).toBe(false);
    });
  });

  describe('Admin Unlock and Status View', () => {
    it('returns false when trying to unlock an account that is not locked', async () => {
      const res = await lockoutService.unlockAccount('notlocked@example.com', 'admin-1');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Account is not currently locked');
    });

    it('successfully unlocks a locked account', async () => {
      for (let i = 0; i < 5; i++) {
        await lockoutService.recordFailedAttempt('locked@example.com', 'locked@example.com');
      }

      const statusBefore = await lockoutService.getLockoutStatus('locked@example.com');
      expect(statusBefore.isLocked).toBe(true);
      expect(statusBefore.failedAttempts).toBe(5);

      const unlockRes = await lockoutService.unlockAccount('locked@example.com', 'admin-1');
      expect(unlockRes.success).toBe(true);
      expect(unlockRes.message).toBe('Account has been unlocked successfully');

      const statusAfter = await lockoutService.getLockoutStatus('locked@example.com');
      expect(statusAfter.isLocked).toBe(false);
    });
  });

  describe('Turnstile / Captcha Verification', () => {
    it('rejects missing or empty tokens', async () => {
      expect(await lockoutService.verifyCaptchaToken()).toBe(false);
      expect(await lockoutService.verifyCaptchaToken('')).toBe(false);
      expect(await lockoutService.verifyCaptchaToken('   ')).toBe(false);
    });

    it('accepts valid test tokens in test environment', async () => {
      expect(await lockoutService.verifyCaptchaToken('valid-token-sample')).toBe(true);
      expect(await lockoutService.verifyCaptchaToken('XXXX.DUMMY.TOKEN.XXXX')).toBe(true);
    });
  });
});
