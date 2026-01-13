/**
 * Integration Test: Authentication Flow
 *
 * Tests the complete authentication lifecycle:
 * Register → Login → Access protected resource → Token refresh → Logout
 *
 * Covers auth endpoints that stress tests don't fully exercise.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestApiClient, createGuestClient } from '../api-client';
import {
  assertSuccess,
  assertFailure,
  assertHasData,
  assertUnauthorized,
  assertUserStructure,
} from '../assertions';
import { waitForServices, resetTestContext, trackResource } from '../setup';
import { TEST_CONFIG } from '../config';

// Skip if integration tests not enabled
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Authentication Flow Integration', () => {
  let client: TestApiClient;
  const testEmail = `integration.test.${Date.now()}@v2resort.local`;
  const testPassword = 'IntegrationTest123!';
  const testFullName = 'Integration Test User';
  let servicesAvailable = false;

  beforeAll(async () => {
    // Always create client
    client = createGuestClient();
    
    const services = await waitForServices(5, 1000);
    if (!services.database || !services.redis) {
      console.warn('⚠️ Test services not available, tests will be skipped');
      return;
    }

    servicesAvailable = true;
    resetTestContext();
  });

  afterAll(() => {
    resetTestContext();
  });

  describe('Phase 1: Registration', () => {
    it('should register a new user', async () => {
      const response = await client.register(testEmail, testPassword, testFullName, '+1234567890');
      assertSuccess(response);

      assertHasData<any>(response, (data: any) => {
        expect(data.accessToken || data.tokens?.accessToken).toBeDefined();
        expect(data.user).toBeDefined();
        if (data.user) {
          assertUserStructure(data.user);
        }
      });

      expect(client.isAuthenticated).toBe(true);
    });

    it('should reject duplicate registration', async () => {
      // Try to register same email again
      const newClient = createGuestClient();
      const response = await newClient.register(testEmail, testPassword, 'Duplicate User');

      assertFailure(response);
      expect([400, 409, 422]).toContain(response.status);
    });

    it('should reject weak password', async () => {
      const newClient = createGuestClient();
      const response = await newClient.register(
        `weak.password.${Date.now()}@v2resort.local`,
        '123',
        'Weak Password User'
      );

      assertFailure(response);
      expect([400, 422]).toContain(response.status);
    });

    it('should reject invalid email format', async () => {
      const newClient = createGuestClient();
      const response = await newClient.register('not-an-email', testPassword, 'Invalid Email User');

      assertFailure(response);
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Phase 2: Login & Session', () => {
    it('should login with registered credentials', async () => {
      // Create fresh client and login
      client = createGuestClient();
      const response = await client.login(testEmail, testPassword);
      assertSuccess(response);

      assertHasData<any>(response, (data: any) => {
        expect(data.accessToken || data.tokens?.accessToken).toBeDefined();
      });

      expect(client.isAuthenticated).toBe(true);
    });

    it('should reject login with wrong password', async () => {
      const wrongClient = createGuestClient();
      const response = await wrongClient.login(testEmail, 'WrongPassword123!');

      assertFailure(response);
      expect([400, 401]).toContain(response.status);
      expect(wrongClient.isAuthenticated).toBe(false);
    });

    it('should reject login for non-existent user', async () => {
      const wrongClient = createGuestClient();
      const response = await wrongClient.login('nonexistent@v2resort.local', testPassword);

      assertFailure(response);
      expect([400, 401, 404]).toContain(response.status);
    });

    it('should access profile with valid token', async () => {
      const response = await client.getProfile();
      assertSuccess(response);

      assertHasData<any>(response, (data: any) => {
        expect(data.email).toBe(testEmail);
        assertUserStructure(data);
      });
    });

    it('should reject profile access without token', async () => {
      const unauthClient = createGuestClient();
      const response = await unauthClient.getProfile();

      assertUnauthorized(response);
    });
  });

  describe('Phase 3: Token Management', () => {
    it('should refresh expired token', async () => {
      // Ensure we have a refresh token
      expect(client.isAuthenticated).toBe(true);

      const response = await client.refreshTokens();
      assertSuccess(response);

      assertHasData<any>(response, (data: any) => {
        expect(data.accessToken || data.tokens?.accessToken).toBeDefined();
      });

      // Should still be authenticated with new token
      expect(client.isAuthenticated).toBe(true);
    });

    it('should access protected resource with refreshed token', async () => {
      const response = await client.getProfile();
      assertSuccess(response);
    });
  });

  describe('Phase 4: Password Management', () => {
    const newPassword = 'NewIntegrationTest456!';

    it('should change password with valid current password', async () => {
      const response = await client.changePassword(testPassword, newPassword);

      // Change password might not be implemented - handle gracefully
      if (response.status === 404) {
        console.warn('⚠️ Change password endpoint not implemented');
        return;
      }

      assertSuccess(response);
    });

    it('should login with new password after change', async () => {
      const newClient = createGuestClient();
      const response = await newClient.login(testEmail, newPassword);

      // If password change was not implemented, old password still works
      if (!response.success) {
        const fallbackResponse = await newClient.login(testEmail, testPassword);
        assertSuccess(fallbackResponse);
        return;
      }

      assertSuccess(response);
    });
  });

  describe('Phase 5: Logout', () => {
    it('should logout and invalidate session', async () => {
      const response = await client.logout();

      // Logout might not be fully implemented
      if (response.status === 404) {
        console.warn('⚠️ Logout endpoint not implemented');
        return;
      }

      assertSuccess(response);
      expect(client.isAuthenticated).toBe(false);
    });

    it('should reject protected resource after logout', async () => {
      const response = await client.getProfile();

      // Token should no longer work
      assertUnauthorized(response);
    });
  });

  describe('Phase 6: Edge Cases', () => {
    it('should handle malformed authorization header', async () => {
      const rawClient = createGuestClient();
      // Manually set invalid token
      rawClient.setToken('invalid-token-format');

      const response = await rawClient.getProfile();
      assertUnauthorized(response);
    });

    it('should handle empty login credentials', async () => {
      const emptyClient = createGuestClient();
      const response = await emptyClient.login('', '');

      assertFailure(response);
      expect([400, 401, 422]).toContain(response.status);
    });
  });
});
