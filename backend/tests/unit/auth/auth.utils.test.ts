import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock the config module
vi.mock('../../../src/config/index', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret',
      refreshSecret: 'test-refresh-secret',
      expiresIn: '15m',
      refreshExpiresIn: '7d'
    }
  }
}));

import { generateTokens, verifyToken, verifyRefreshToken } from '../../../src/modules/auth/auth.utils';

describe('Auth Utils', () => {
  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer']
      };

      const tokens = generateTokens(payload);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900); // 15 minutes in seconds
    });

    it('should include user info in access token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['admin', 'staff']
      };

      const tokens = generateTokens(payload);
      const decoded = jwt.decode(tokens.accessToken) as any;

      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toEqual(['admin', 'staff']);
    });

    it('should include only userId and type in refresh token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer']
      };

      const tokens = generateTokens(payload);
      const decoded = jwt.decode(tokens.refreshToken) as any;

      expect(decoded.userId).toBe('user-123');
      expect(decoded.type).toBe('refresh');
      expect(decoded.email).toBeUndefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid access token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer']
      };

      const { accessToken } = generateTokens(payload);
      const decoded = verifyToken(accessToken);

      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toEqual(['customer']);
    });

    it('should throw for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw for tampered token', () => {
      const { accessToken } = generateTokens({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer']
      });

      // Tamper with the token
      const tampered = accessToken.slice(0, -5) + 'xxxxx';

      expect(() => verifyToken(tampered)).toThrow();
    });

    it('should throw for expired token', () => {
      // Create a token with very short expiry
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', roles: [] },
        'test-jwt-secret',
        { expiresIn: -1 }
      );

      expect(() => verifyToken(token)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer']
      };

      const { refreshToken } = generateTokens(payload);
      const decoded = verifyRefreshToken(refreshToken);

      expect(decoded.userId).toBe('user-123');
    });

    it('should throw for invalid refresh token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });

    it('should throw for access token used as refresh token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer']
      };

      const { accessToken } = generateTokens(payload);

      // Access token has different secret, should fail verification
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });

    it('should throw for token without refresh type', () => {
      // Create a token without type: 'refresh'
      const token = jwt.sign(
        { userId: 'user-123' },
        'test-refresh-secret',
        { expiresIn: 3600 }
      );

      expect(() => verifyRefreshToken(token)).toThrow('Invalid token type');
    });
  });
});
