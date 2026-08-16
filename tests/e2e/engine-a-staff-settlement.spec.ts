import { test, expect } from '@playwright/test';

/**
 * Engine A (instant_transaction) Staff Settlement Spec
 *
 * Exercises the staff settlement path (POST /api/v1/staff/modules/:slug/orders/:orderId/pay).
 * Uses Bearer auth from seeded staff credentials.
 */

const API_URL = process.env.API_URL || 'http://localhost:3005';
const TEST_MODULE_SLUG = process.env.E2E_ENGINE_A_SLUG || 'poolside-grill';
const TEST_EMAIL = process.env.E2E_STAFF_EMAIL || 'menu.service.staff@v2ecosystem.com';
const TEST_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'staff123';

async function getAuthToken(request: any): Promise<string | null> {
  const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (!loginRes.ok()) return null;
  const loginBody = await loginRes.json();
  return loginBody.data?.tokens?.accessToken || loginBody.data?.token || loginBody.token || null;
}

test.describe('Engine A: Staff Settlement Flow (payModuleOrder)', () => {
  let authToken: string | null = null;

  test.beforeAll(async ({ request }) => {
    authToken = await getAuthToken(request);
  });

  test('rejects request without Bearer token (CSRF blocks before auth)', async ({ request }) => {
    const fakeOrderId = '00000000-0000-0000-0000-000000000001';
    const res = await request.post(`${API_URL}/api/v1/staff/modules/${TEST_MODULE_SLUG}/orders/${fakeOrderId}/pay`, {
      data: {
        paymentMethod: 'cash',
        amountPaid: 25.0,
      },
    });

    // Without Bearer token, CSRF middleware blocks with 403 (no cookie/header).
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('CSRF');
  });

  test('returns 404 for nonexistent order with valid staff auth', async ({ request }) => {
    expect(authToken).toBeTruthy();

    const fakeOrderId = '00000000-0000-0000-0000-000000000099';

    const res = await request.post(`${API_URL}/api/v1/staff/modules/${TEST_MODULE_SLUG}/orders/${fakeOrderId}/pay`, {
      data: {
        paymentMethod: 'cash',
        amountPaid: 30.0,
        tipAmount: 3.0,
      },
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    // With valid auth + nonexistent order, expect 404 from the handler or 403 if module doesn't match staff property
    expect([404, 403]).toContain(res.status());
  });
});
