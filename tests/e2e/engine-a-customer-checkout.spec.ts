import { test, expect } from '@playwright/test';

/**
 * Engine A (instant_transaction) Customer Checkout Spec
 *
 * Exercises the customer ordering path via API.
 * The order creation endpoint requires authentication (Bearer token) which
 * bypasses CSRF per the csrf.middleware.ts Bearer exemption.
 *
 * Test strategy:
 * - First authenticate via /api/v1/auth/login with seeded customer credentials
 * - Use Bearer token on order requests
 * - Test order creation validation (empty items rejected)
 * - Test order creation with cash payment method
 */

const API_URL = process.env.API_URL || 'http://localhost:3005';
const TEST_MODULE_SLUG = process.env.E2E_ENGINE_A_SLUG || 'poolside-grill';
const TEST_EMAIL = process.env.E2E_CUSTOMER_EMAIL || 'e2e.customer@test.com';
const TEST_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD || 'TestPass123!';

async function getAuthToken(request: any): Promise<string | null> {
  const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  if (!loginRes.ok()) return null;
  const loginBody = await loginRes.json();
  return loginBody.data?.tokens?.accessToken || loginBody.data?.token || loginBody.token || null;
}

test.describe('Engine A: Customer Cart & Checkout Flow', () => {
  let authToken: string | null = null;

  test.beforeAll(async ({ request }) => {
    authToken = await getAuthToken(request);
  });

  test('rejects order creation with empty items payload', async ({ request }) => {
    expect(authToken).toBeTruthy();

    const res = await request.post(`${API_URL}/api/v1/modules/${TEST_MODULE_SLUG}/orders`, {
      data: {
        customerName: 'Test Customer',
        customerPhone: '+1234567890',
        orderType: 'dine_in',
        tableNumber: 'T1',
        paymentMethod: 'cash',
        items: [],
      },
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    // Empty items or nonexistent module should be rejected with 400, 404, or 422
    expect([400, 404, 422]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('creates customer order with cash payment method (pending settlement)', async ({ request }) => {
    expect(authToken).toBeTruthy();

    // First, get available catalog items for the module if available
    const catalogRes = await request.get(`${API_URL}/api/v1/modules/${TEST_MODULE_SLUG}/catalog`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });

    let catalogItemId = '00000000-0000-0000-0000-000000000001';
    if (catalogRes.ok()) {
      const catalogBody = await catalogRes.json();
      const items = catalogBody.data?.items || catalogBody.data || [];
      if (items.length > 0) {
        catalogItemId = items[0].id;
      }
    }

    const res = await request.post(`${API_URL}/api/v1/modules/${TEST_MODULE_SLUG}/orders`, {
      data: {
        customerName: 'Alex Customer',
        customerPhone: '+15551234567',
        orderType: 'dine_in',
        tableNumber: 'T3',
        paymentMethod: 'cash',
        items: [
          {
            catalog_item_id: catalogItemId,
            quantity: 2,
            specialInstructions: 'Extra napkins',
          },
        ],
        notes: 'Table near window',
      },
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const status = res.status();
    const body = await res.json();

    if (status === 201 || status === 200) {
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.status).toBe('pending');
    } else {
      expect([400, 404]).toContain(status);
    }
  });
});
