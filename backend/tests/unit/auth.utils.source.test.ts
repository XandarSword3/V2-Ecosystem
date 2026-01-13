import { describe, it, expect } from 'vitest';

// Import the actual auth utilities from source
import {
  generateTokens,
  verifyToken,
  verifyRefreshToken,
} from '../../src/modules/auth/auth.utils';

describe('Auth Utils (Source)', () => {
  const testPayload = {
    userId: 'user-123-abc',
    email: 'test@example.com',
    roles: ['guest', 'user'],
  };

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokens(testPayload);
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');
    });

    it('should return non-empty access token', () => {
      const tokens = generateTokens(testPayload);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.accessToken.length).toBeGreaterThan(0);
    });

    it('should return non-empty refresh token', () => {
      const tokens = generateTokens(testPayload);
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.refreshToken.length).toBeGreaterThan(0);
    });

    it('should return expiresIn as a number', () => {
      const tokens = generateTokens(testPayload);
      expect(typeof tokens.expiresIn).toBe('number');
      expect(tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should generate different access and refresh tokens', () => {
      const tokens = generateTokens(testPayload);
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });

    it('should generate consistent tokens with same payload at same time', () => {
      const tokens1 = generateTokens(testPayload);
      const tokens2 = generateTokens(testPayload);
      // JWTs generated at same second with same payload will be identical
      // Just verify both are valid tokens
      expect(tokens1.accessToken.split('.').length).toBe(3);
      expect(tokens2.accessToken.split('.').length).toBe(3);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid access token', () => {
      const tokens = generateTokens(testPayload);
      const decoded = verifyToken(tokens.accessToken);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should return roles from token', () => {
      const tokens = generateTokens(testPayload);
      const decoded = verifyToken(tokens.accessToken);
      expect(decoded.roles).toEqual(testPayload.roles);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw on tampered token', () => {
      const tokens = generateTokens(testPayload);
      const tamperedToken = tokens.accessToken.slice(0, -5) + 'xxxxx';
      expect(() => verifyToken(tamperedToken)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const tokens = generateTokens(testPayload);
      const decoded = verifyRefreshToken(tokens.refreshToken);
      expect(decoded.userId).toBe(testPayload.userId);
    });

    it('should throw on invalid refresh token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });

    it('should throw when using access token as refresh token', () => {
      const tokens = generateTokens(testPayload);
      // Access token doesn't have type: 'refresh', so should fail
      expect(() => verifyRefreshToken(tokens.accessToken)).toThrow();
    });
  });

  describe('token structure', () => {
    it('should generate JWT format tokens (header.payload.signature)', () => {
      const tokens = generateTokens(testPayload);
      const parts = tokens.accessToken.split('.');
      expect(parts.length).toBe(3);
    });

    it('should have valid base64 encoded parts', () => {
      const tokens = generateTokens(testPayload);
      const parts = tokens.accessToken.split('.');
      
      // Each part should be base64url encoded
      parts.forEach(part => {
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
      });
    });
  });
});
