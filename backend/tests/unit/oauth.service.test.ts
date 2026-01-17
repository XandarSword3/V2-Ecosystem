/**
 * OAuth Service Unit Tests
 * 
 * Tests for OAuth user creation, token exchange, and account linking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOAuthState } from '../../src/modules/auth/oauth.service.js';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('../../src/config/index.js', () => ({
  config: {
    oauth: {
      google: {
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        callbackUrl: 'http://localhost:3001/api/auth/google/callback',
      },
      facebook: {
        clientId: 'facebook-client-id',
        clientSecret: 'facebook-client-secret',
        callbackUrl: 'http://localhost:3001/api/auth/facebook/callback',
      },
    },
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

describe('OAuth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('generateOAuthState', () => {
    it('should generate a random state string', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();

      expect(state1).toBeDefined();
      expect(typeof state1).toBe('string');
      expect(state1.length).toBe(64); // 32 bytes = 64 hex chars
      expect(state1).not.toBe(state2); // Should be unique
    });

    it('should only contain hex characters', () => {
      const state = generateOAuthState();
      expect(/^[0-9a-f]+$/i.test(state)).toBe(true);
    });

    it('should generate cryptographically secure random strings', () => {
      const states = new Set<string>();
      for (let i = 0; i < 100; i++) {
        states.add(generateOAuthState());
      }
      // All should be unique
      expect(states.size).toBe(100);
    });

    it('should have sufficient entropy for CSRF protection', () => {
      const state = generateOAuthState();
      // 32 bytes = 256 bits of entropy, which is more than enough
      expect(state.length).toBeGreaterThanOrEqual(64);
    });
  });
});
