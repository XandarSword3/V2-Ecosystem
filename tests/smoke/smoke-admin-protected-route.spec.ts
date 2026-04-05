import { test, expect } from '../fixtures/auth.fixture';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3005';
const ADMIN_ROUTE = `${API_BASE_URL}/api/v1/admin/users`;

test.describe('Smoke 04 - Protected Admin Route', () => {
  test('SMOKE-04 @smoke admin route denies non-admin and allows admin', async ({ request, auth }) => {
    const unauthenticatedResponse = await request.get(ADMIN_ROUTE);
    expect([401, 403]).toContain(unauthenticatedResponse.status());

    const customerToken = await auth.getApiToken('customer');
    const customerResponse = await request.get(ADMIN_ROUTE, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(customerResponse.status()).toBe(403);

    const adminToken = await auth.getApiToken('admin');
    const adminResponse = await request.get(ADMIN_ROUTE, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminResponse.status()).toBe(200);
  });
});