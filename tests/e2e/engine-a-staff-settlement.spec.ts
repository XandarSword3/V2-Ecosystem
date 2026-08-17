import { test, expect } from '@playwright/test';

/**
 * Engine A (instant_transaction) Staff Settlement Spec
 *
 * Exercises the complete staff settlement path:
 * 1. Customer places an order for a menu item
 * 2. Staff settles the order via POST /api/v1/staff/modules/:slug/orders/:orderId/pay
 * 3. Asserts order advances to 'completed' with payment_status: 'paid'
 * 4. Security checks: rejects missing auth (403) and nonexistent orders (404)
 */

const API_URL = process.env.API_URL || 'http://localhost:3005';
const TEST_MODULE_SLUG = process.env.E2E_ENGINE_A_SLUG || 'poolside-grill';
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'menu.service.staff@v2ecosystem.com';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'staff123';
const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || 'e2e.customer@test.com';
const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD || 'TestPass123!';

async function getAuthToken(request: any, email: string, pass: string): Promise<string | null> {
  const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: pass },
  });
  if (!loginRes.ok()) return null;
  const loginBody = await loginRes.json();
  return loginBody.data?.tokens?.accessToken || loginBody.data?.token || loginBody.token || null;
}

test.describe('Engine A: Staff Settlement Flow (payModuleOrder)', () => {
  let staffToken: string | null = null;
  let customerToken: string | null = null;

  test.beforeAll(async ({ request }) => {
    staffToken = await getAuthToken(request, STAFF_EMAIL, STAFF_PASSWORD);
    customerToken = await getAuthToken(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  });

  test('staff settles a real customer order with cash (happy path)', async ({ request }) => {
    expect(customerToken).toBeTruthy();
    expect(staffToken).toBeTruthy();

    // 1. Resolve catalog item
    const catalogRes = await request.get(`${API_URL}/api/v1/modules/${TEST_MODULE_SLUG}/catalog`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(catalogRes.ok()).toBe(true);
    const catalogBody = await catalogRes.json();
    const items = catalogBody.data?.items || catalogBody.data || [];
    expect(items.length).toBeGreaterThan(0);
    const catalogItemId = items[0].id;

    // 2. Customer creates order
    const createRes = await request.post(`${API_URL}/api/v1/modules/${TEST_MODULE_SLUG}/orders`, {
      data: {
        customerName: 'E2E Test Customer',
        customerPhone: '+15551234567',
        orderType: 'dine_in',
        tableNumber: 'T-10',
        paymentMethod: 'cash',
        items: [{ catalog_item_id: catalogItemId, quantity: 1 }],
      },
      headers: { Authorization: `Bearer ${customerToken}` },
    });

    expect(createRes.status()).toBe(201);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    const orderId = createBody.data.id;
    expect(orderId).toBeTruthy();

    // 3. Staff settles the order
    const payRes = await request.post(`${API_URL}/api/v1/staff/modules/${TEST_MODULE_SLUG}/orders/${orderId}/pay`, {
      data: {
        paymentMethod: 'cash',
        amountPaid: createBody.data.amount || 25.0,
        tipAmount: 2.0,
      },
      headers: { Authorization: `Bearer ${staffToken}` },
    });

    expect(payRes.status()).toBe(200);
    const payBody = await payRes.json();
    expect(payBody.success).toBe(true);
    expect(payBody.data.status).toBe('completed');
    expect(payBody.data.metadata.payment_status).toBe('paid');
  });

  test('rejects request without Bearer token (CSRF blocks before auth)', async ({ request }) => {
    const fakeOrderId = '00000000-0000-0000-0000-000000000001';
    const res = await request.post(`${API_URL}/api/v1/staff/modules/${TEST_MODULE_SLUG}/orders/${fakeOrderId}/pay`, {
      data: {
        paymentMethod: 'cash',
        amountPaid: 25.0,
      },
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('CSRF');
  });

  test('returns 404 for nonexistent order with valid staff auth', async ({ request }) => {
    expect(staffToken).toBeTruthy();

    const fakeOrderId = '00000000-0000-0000-0000-000000000099';

    const res = await request.post(`${API_URL}/api/v1/staff/modules/${TEST_MODULE_SLUG}/orders/${fakeOrderId}/pay`, {
      data: {
        paymentMethod: 'cash',
        amountPaid: 30.0,
        tipAmount: 3.0,
      },
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    expect(res.status()).toBe(404);
  });
});
