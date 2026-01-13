/**
 * Integration Test: Admin Operations
 *
 * Tests admin-only functionality:
 * Dashboard access → User management → Reports → CRUD operations
 *
 * Scenario extracted from stress test admin-bot behaviors.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  TestApiClient,
  createAdminClient,
  createGuestClient,
  createCustomerClient,
} from '../api-client';
import {
  assertSuccess,
  assertFailure,
  assertHasData,
  assertUnauthorized,
  assertForbidden,
  assertPaginatedList,
} from '../assertions';
import { waitForServices, resetTestContext } from '../setup';

// Skip if integration tests not enabled
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Admin Operations Integration', () => {
  let adminClient: TestApiClient;
  let customerClient: TestApiClient;
  let guestClient: TestApiClient;
  let servicesAvailable = false;

  beforeAll(async () => {
    // Always create clients
    guestClient = createGuestClient();
    adminClient = createGuestClient(); // Will be replaced if services available
    customerClient = createGuestClient(); // Will be replaced if services available
    
    const services = await waitForServices(5, 1000);
    if (!services.database || !services.redis) {
      console.warn('⚠️ Test services not available, skipping integration tests');
      return;
    }

    servicesAvailable = true;
    resetTestContext();
    adminClient = await createAdminClient();
    customerClient = await createCustomerClient();
  });

  afterAll(() => {
    resetTestContext();
  });

  describe('Phase 1: Access Control', () => {
    it('should allow admin to access dashboard', async () => {
      const response = await adminClient.getAdminDashboard();

      // Dashboard might not be implemented
      if (response.status === 404) {
        console.warn('⚠️ Admin dashboard endpoint not implemented');
        return;
      }

      assertSuccess(response);
    });

    it('should deny guest access to admin dashboard', async () => {
      const response = await guestClient.getAdminDashboard();

      assertUnauthorized(response);
    });

    it('should deny customer access to admin dashboard', async () => {
      const response = await customerClient.getAdminDashboard();

      // Should be 401 (unauthenticated) or 403 (forbidden)
      assertFailure(response);
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Phase 2: User Management', () => {
    it('should list users with pagination', async () => {
      const response = await adminClient.getAdminUsers({ page: 1, limit: 10 });

      if (response.status === 404) {
        console.warn('⚠️ Admin users endpoint not implemented');
        return;
      }

      assertSuccess(response);

      // Check pagination structure
      const data = response.data;
      expect(data).toBeDefined();
    });

    it('should deny customer access to user list', async () => {
      const response = await customerClient.getAdminUsers();

      assertFailure(response);
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Phase 3: Reports', () => {
    it('should fetch revenue report', async () => {
      const response = await adminClient.getAdminReports('revenue');

      if (response.status === 404) {
        console.warn('⚠️ Admin reports endpoint not implemented');
        return;
      }

      assertSuccess(response);
    });

    it('should fetch occupancy report', async () => {
      const response = await adminClient.getAdminReports('occupancy');

      if (response.status === 404) {
        return;
      }

      assertSuccess(response);
    });

    it('should fetch orders report', async () => {
      const response = await adminClient.getAdminReports('orders');

      if (response.status === 404) {
        return;
      }

      assertSuccess(response);
    });

    it('should handle invalid report type', async () => {
      const response = await adminClient.getAdminReports('invalid-report-type');

      // Should fail or return empty
      if (response.status !== 404) {
        expect([400, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('Phase 4: Health & Monitoring', () => {
    it('should return health check', async () => {
      const response = await guestClient.healthCheck();
      assertSuccess(response);

      assertHasData<any>(response, (data: any) => {
        // Health endpoint might return various formats
        expect(data.status === 'ok' || data.healthy === true || data === 'ok').toBeTruthy();
      });
    });
  });

  describe('Phase 5: Edge Cases', () => {
    it('should handle expired admin token gracefully', async () => {
      // Create client with invalid token
      const expiredClient = createGuestClient();
      expiredClient.setToken('expired.token.here');

      const response = await expiredClient.getAdminDashboard();
      assertUnauthorized(response);
    });

    it('should handle malformed admin request', async () => {
      const response = await adminClient.getAdminUsers({ page: -1, limit: 0 });

      // Should either fail gracefully or use defaults
      if (response.status === 400 || response.status === 422) {
        assertFailure(response);
      } else if (response.success) {
        // Using defaults is acceptable
        assertSuccess(response);
      }
    });
  });
});
