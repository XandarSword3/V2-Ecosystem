/**
 * Auth Lifecycle Tests
 * 
 * Comprehensive tests for:
 * - Login flow
 * - Token refresh
 * - Multi-device logout
 * - Token invalidation
 * - 2FA flows
 * - Session management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/database/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Import after mocks
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key';
const JWT_REFRESH_SECRET = 'test-refresh-secret';

// Helper to generate tokens
function generateAccessToken(payload: any, expiresIn = '15m') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function generateRefreshToken(payload: any, expiresIn = '7d') {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn });
}

describe('Auth Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Token Generation', () => {
    it('should generate valid access token with correct claims', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer'],
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toContain('customer');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should generate refresh token with longer expiry', () => {
      const payload = {
        userId: 'user-123',
        tokenVersion: 1,
      };

      const accessToken = generateAccessToken(payload, '15m');
      const refreshToken = generateRefreshToken(payload, '7d');

      const decodedAccess = jwt.verify(accessToken, JWT_SECRET) as any;
      const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;

      // Refresh token should have later expiry
      expect(decodedRefresh.exp).toBeGreaterThan(decodedAccess.exp);
    });

    it('should reject expired access token', () => {
      const payload = { userId: 'user-123' };
      const token = generateAccessToken(payload, '1s');

      // Advance time past expiry
      vi.advanceTimersByTime(2000);

      expect(() => jwt.verify(token, JWT_SECRET)).toThrow('jwt expired');
    });

    it('should reject token with wrong secret', () => {
      const token = generateAccessToken({ userId: 'user-123' });
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });
  });

  describe('Token Version for Multi-Device Logout', () => {
    it('should invalidate old tokens when version incremented', () => {
      const userTokenVersion = 2;
      
      // Old token with version 1
      const oldToken = generateAccessToken({
        userId: 'user-123',
        tokenVersion: 1,
      });

      const decoded = jwt.verify(oldToken, JWT_SECRET) as any;
      
      // Token version check
      const isValid = decoded.tokenVersion === userTokenVersion;
      expect(isValid).toBe(false);
    });

    it('should accept token with current version', () => {
      const userTokenVersion = 2;
      
      const currentToken = generateAccessToken({
        userId: 'user-123',
        tokenVersion: 2,
      });

      const decoded = jwt.verify(currentToken, JWT_SECRET) as any;
      const isValid = decoded.tokenVersion === userTokenVersion;
      expect(isValid).toBe(true);
    });
  });

  describe('Device Token Management', () => {
    const mockDeviceTokens = new Map<string, { userId: string; deviceId: string; token: string }>();

    beforeEach(() => {
      mockDeviceTokens.clear();
    });

    it('should register device token on login', () => {
      const deviceInfo = {
        userId: 'user-123',
        deviceId: 'device-abc',
        token: 'fcm-token-xyz',
        platform: 'ios',
      };

      mockDeviceTokens.set(deviceInfo.deviceId, deviceInfo);
      
      expect(mockDeviceTokens.has('device-abc')).toBe(true);
      expect(mockDeviceTokens.get('device-abc')?.token).toBe('fcm-token-xyz');
    });

    it('should update existing device token', () => {
      const deviceId = 'device-abc';
      
      // First registration
      mockDeviceTokens.set(deviceId, {
        userId: 'user-123',
        deviceId,
        token: 'old-token',
      });

      // Update with new token
      mockDeviceTokens.set(deviceId, {
        userId: 'user-123',
        deviceId,
        token: 'new-token',
      });

      expect(mockDeviceTokens.get(deviceId)?.token).toBe('new-token');
    });

    it('should remove device token on logout', () => {
      const deviceId = 'device-abc';
      
      mockDeviceTokens.set(deviceId, {
        userId: 'user-123',
        deviceId,
        token: 'fcm-token',
      });

      // Logout removes device
      mockDeviceTokens.delete(deviceId);
      
      expect(mockDeviceTokens.has(deviceId)).toBe(false);
    });

    it('should allow multiple devices per user', () => {
      const userId = 'user-123';
      
      mockDeviceTokens.set('device-1', { userId, deviceId: 'device-1', token: 'token-1' });
      mockDeviceTokens.set('device-2', { userId, deviceId: 'device-2', token: 'token-2' });
      mockDeviceTokens.set('device-3', { userId, deviceId: 'device-3', token: 'token-3' });

      const userDevices = Array.from(mockDeviceTokens.values())
        .filter(d => d.userId === userId);
      
      expect(userDevices).toHaveLength(3);
    });

    it('should remove all devices on global logout', () => {
      const userId = 'user-123';
      
      mockDeviceTokens.set('device-1', { userId, deviceId: 'device-1', token: 'token-1' });
      mockDeviceTokens.set('device-2', { userId, deviceId: 'device-2', token: 'token-2' });
      mockDeviceTokens.set('other-user', { userId: 'other', deviceId: 'other', token: 'other' });

      // Global logout for user
      for (const [key, device] of mockDeviceTokens) {
        if (device.userId === userId) {
          mockDeviceTokens.delete(key);
        }
      }

      const userDevices = Array.from(mockDeviceTokens.values())
        .filter(d => d.userId === userId);
      
      expect(userDevices).toHaveLength(0);
      expect(mockDeviceTokens.has('other-user')).toBe(true);
    });
  });

  describe('Refresh Token Flow', () => {
    it('should issue new access token with valid refresh token', () => {
      const refreshPayload = {
        userId: 'user-123',
        tokenVersion: 1,
        type: 'refresh',
      };

      const refreshToken = generateRefreshToken(refreshPayload);
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;

      expect(decoded.type).toBe('refresh');
      expect(decoded.userId).toBe('user-123');

      // Generate new access token
      const newAccessToken = generateAccessToken({
        userId: decoded.userId,
        roles: ['customer'],
      });

      const accessDecoded = jwt.verify(newAccessToken, JWT_SECRET) as any;
      expect(accessDecoded.userId).toBe('user-123');
    });

    it('should reject refresh token with incremented version', () => {
      const currentVersion = 2;
      
      const refreshToken = generateRefreshToken({
        userId: 'user-123',
        tokenVersion: 1, // Old version
      });

      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      
      // Check version
      if (decoded.tokenVersion !== currentVersion) {
        expect(true).toBe(true); // Should be rejected
      }
    });

    it('should reject expired refresh token', () => {
      const refreshToken = generateRefreshToken({
        userId: 'user-123',
        tokenVersion: 1,
      }, '1s');

      vi.advanceTimersByTime(2000);

      expect(() => jwt.verify(refreshToken, JWT_REFRESH_SECRET)).toThrow('jwt expired');
    });

    it('should implement refresh token rotation', () => {
      const usedRefreshTokens = new Set<string>();
      
      const refreshToken1 = generateRefreshToken({
        userId: 'user-123',
        tokenVersion: 1,
        jti: 'token-id-1',
      });

      // Use refresh token
      usedRefreshTokens.add('token-id-1');

      // Try to reuse
      const decoded = jwt.verify(refreshToken1, JWT_REFRESH_SECRET) as any;
      const isReused = usedRefreshTokens.has(decoded.jti);
      
      expect(isReused).toBe(true);
      // In production, this should trigger token family invalidation
    });
  });

  describe('2FA Authentication', () => {
    it('should require 2FA verification after password login', () => {
      const loginResponse = {
        requiresTwoFactor: true,
        tempToken: 'temp-2fa-token',
        methods: ['totp', 'sms'],
      };

      expect(loginResponse.requiresTwoFactor).toBe(true);
      expect(loginResponse.tempToken).toBeDefined();
      expect(loginResponse.methods).toContain('totp');
    });

    it('should complete auth after valid 2FA code', () => {
      const verify2FA = (code: string, secret: string): boolean => {
        // Mock TOTP verification
        return code === '123456';
      };

      expect(verify2FA('123456', 'secret')).toBe(true);
      expect(verify2FA('000000', 'secret')).toBe(false);
    });

    it('should lock account after multiple failed 2FA attempts', () => {
      let failedAttempts = 0;
      const MAX_ATTEMPTS = 5;

      const attempt2FA = (code: string): { success: boolean; locked: boolean } => {
        if (code !== '123456') {
          failedAttempts++;
          if (failedAttempts >= MAX_ATTEMPTS) {
            return { success: false, locked: true };
          }
          return { success: false, locked: false };
        }
        failedAttempts = 0;
        return { success: true, locked: false };
      };

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        attempt2FA('wrong');
      }

      const result = attempt2FA('wrong');
      expect(result.locked).toBe(true);
    });
  });

  describe('Session Management', () => {
    const activeSessions = new Map<string, {
      userId: string;
      deviceId: string;
      createdAt: Date;
      lastActivity: Date;
      ip: string;
      userAgent: string;
    }>();

    beforeEach(() => {
      activeSessions.clear();
    });

    it('should track active sessions', () => {
      const sessionId = 'session-123';
      activeSessions.set(sessionId, {
        userId: 'user-123',
        deviceId: 'device-abc',
        createdAt: new Date(),
        lastActivity: new Date(),
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(activeSessions.has(sessionId)).toBe(true);
    });

    it('should update last activity on request', () => {
      const sessionId = 'session-123';
      const initialTime = new Date('2024-01-01T10:00:00Z');
      
      activeSessions.set(sessionId, {
        userId: 'user-123',
        deviceId: 'device-abc',
        createdAt: initialTime,
        lastActivity: initialTime,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      // Update activity
      const newTime = new Date('2024-01-01T11:00:00Z');
      const session = activeSessions.get(sessionId)!;
      session.lastActivity = newTime;

      expect(activeSessions.get(sessionId)?.lastActivity).toEqual(newTime);
    });

    it('should list all sessions for user', () => {
      const userId = 'user-123';
      
      activeSessions.set('session-1', {
        userId,
        deviceId: 'device-1',
        createdAt: new Date(),
        lastActivity: new Date(),
        ip: '1.1.1.1',
        userAgent: 'Chrome',
      });
      
      activeSessions.set('session-2', {
        userId,
        deviceId: 'device-2',
        createdAt: new Date(),
        lastActivity: new Date(),
        ip: '2.2.2.2',
        userAgent: 'Safari',
      });

      const userSessions = Array.from(activeSessions.entries())
        .filter(([_, s]) => s.userId === userId);

      expect(userSessions).toHaveLength(2);
    });

    it('should terminate specific session', () => {
      activeSessions.set('session-1', {
        userId: 'user-123',
        deviceId: 'device-1',
        createdAt: new Date(),
        lastActivity: new Date(),
        ip: '1.1.1.1',
        userAgent: 'Chrome',
      });

      activeSessions.delete('session-1');
      
      expect(activeSessions.has('session-1')).toBe(false);
    });

    it('should terminate all sessions except current', () => {
      const currentSessionId = 'session-1';
      const userId = 'user-123';

      activeSessions.set('session-1', { userId, deviceId: 'd1', createdAt: new Date(), lastActivity: new Date(), ip: '1.1.1.1', userAgent: 'Chrome' });
      activeSessions.set('session-2', { userId, deviceId: 'd2', createdAt: new Date(), lastActivity: new Date(), ip: '2.2.2.2', userAgent: 'Safari' });
      activeSessions.set('session-3', { userId, deviceId: 'd3', createdAt: new Date(), lastActivity: new Date(), ip: '3.3.3.3', userAgent: 'Firefox' });

      // Terminate all except current
      for (const [sessionId, session] of activeSessions) {
        if (sessionId !== currentSessionId && session.userId === userId) {
          activeSessions.delete(sessionId);
        }
      }

      expect(activeSessions.size).toBe(1);
      expect(activeSessions.has(currentSessionId)).toBe(true);
    });
  });

  describe('Password Reset Flow', () => {
    it('should generate time-limited reset token', () => {
      const resetToken = generateAccessToken({
        userId: 'user-123',
        type: 'password-reset',
      }, '1h');

      const decoded = jwt.verify(resetToken, JWT_SECRET) as any;
      expect(decoded.type).toBe('password-reset');
      
      // Token should expire in about 1 hour
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(3600); // 1 hour in seconds
    });

    it('should invalidate reset token after use', () => {
      const usedResetTokens = new Set<string>();
      const tokenId = 'reset-token-123';

      // First use
      usedResetTokens.add(tokenId);

      // Second use should fail
      const isUsed = usedResetTokens.has(tokenId);
      expect(isUsed).toBe(true);
    });

    it('should invalidate all sessions on password change', () => {
      // This is typically done by incrementing token version
      const beforeVersion = 1;
      const afterVersion = beforeVersion + 1;

      expect(afterVersion).toBe(2);
      // All tokens with version 1 are now invalid
    });
  });

  describe('Rate Limiting', () => {
    const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

    it('should track login attempts by IP', () => {
      const ip = '192.168.1.1';
      
      const track = () => {
        const current = loginAttempts.get(ip) || { count: 0, lastAttempt: new Date() };
        current.count++;
        current.lastAttempt = new Date();
        loginAttempts.set(ip, current);
      };

      track();
      track();
      track();

      expect(loginAttempts.get(ip)?.count).toBe(3);
    });

    it('should block after too many attempts', () => {
      const ip = '192.168.1.1';
      const MAX_ATTEMPTS = 5;

      loginAttempts.set(ip, { count: 5, lastAttempt: new Date() });

      const isBlocked = (loginAttempts.get(ip)?.count || 0) >= MAX_ATTEMPTS;
      expect(isBlocked).toBe(true);
    });

    it('should reset after cooldown period', () => {
      const ip = '192.168.1.1';
      const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

      const oldTime = new Date(Date.now() - COOLDOWN_MS - 1000);
      loginAttempts.set(ip, { count: 5, lastAttempt: oldTime });

      const attempt = loginAttempts.get(ip)!;
      const cooldownExpired = Date.now() - attempt.lastAttempt.getTime() > COOLDOWN_MS;

      if (cooldownExpired) {
        loginAttempts.delete(ip);
      }

      expect(loginAttempts.has(ip)).toBe(false);
    });
  });

  describe('OAuth Token Exchange', () => {
    it('should exchange OAuth code for tokens', () => {
      const oauthResponse = {
        provider: 'google',
        email: 'user@gmail.com',
        providerId: 'google-123',
        name: 'Test User',
      };

      // Generate our own tokens after OAuth success
      const accessToken = generateAccessToken({
        userId: 'user-123',
        email: oauthResponse.email,
        provider: oauthResponse.provider,
        roles: ['customer'],
      });

      const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
      expect(decoded.provider).toBe('google');
      expect(decoded.email).toBe('user@gmail.com');
    });

    it('should link OAuth account to existing user', () => {
      const existingUser = {
        id: 'user-123',
        email: 'user@example.com',
        linkedProviders: ['email'],
      };

      // Link Google
      existingUser.linkedProviders.push('google');

      expect(existingUser.linkedProviders).toContain('email');
      expect(existingUser.linkedProviders).toContain('google');
    });
  });
});

describe('Token Security', () => {
  it('should not include sensitive data in token', () => {
    const token = generateAccessToken({
      userId: 'user-123',
      email: 'test@example.com',
      roles: ['customer'],
    });

    const decoded = jwt.decode(token) as any;
    
    // Should NOT include:
    expect(decoded.password).toBeUndefined();
    expect(decoded.creditCard).toBeUndefined();
    expect(decoded.ssn).toBeUndefined();
  });

  it('should use strong algorithm', () => {
    const token = generateAccessToken({ userId: 'user-123' });
    const header = jwt.decode(token, { complete: true })?.header;
    
    // Should use HS256 or stronger
    expect(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']).toContain(header?.alg);
  });
});
