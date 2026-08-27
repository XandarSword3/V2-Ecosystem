import { test, expect } from '@playwright/test';

/**
 * Engine A (instant_transaction) Catalog Lifecycle Spec (Phase 8)
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ ⚠  THIS IS AN API-LEVEL TEST, NOT A BROWSER/UI E2E TEST.          │
 * │                                                                    │
 * │ It uses Playwright request-context API calls (request.post/put)     │
 * │ and therefore does NOT test the actual mounted frontend controls.   │
 * │ It does NOT log in via a browser, click UI buttons, or assert      │
 * │ rendered DOM elements.                                              │
 * │                                                                    │
 * │ For real browser E2E that clicks actual Publish/Pause/Restore/      │
 * │ Sell Out/Archive buttons and asserts visible lifecycle badges, see: │
 * │   engine-a-catalog-lifecycle-browser.spec.ts                        │
 * │                                                                    │
 * │ Phase 8 frontend is NOT complete from API-level tests alone.       │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Proves the frontend → backend lifecycle data flow:
 * 1. Create a catalog item (starts as 'active')
 * 2. Transition through every legal lifecycle state
 * 3. Assert each transition sends the correct STATE NAME (not action verb)
 *    to the backend's isValidLifecycleTransition
 * 4. Assert invalid transitions are rejected
 * 5. Assert customer menu filtering by lifecycle_status
 *
 * This bridges the gap between backend integration tests (which call
 * the API directly with state strings) and browser tests (which would
 * click UI buttons). It proves the API contract that the frontend
 * buttons rely on.
 */

const API_URL = process.env.API_URL || 'http://localhost:3005';
const TEST_MODULE_SLUG = process.env.E2E_ENGINE_A_SLUG || 'poolside-grill';
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'menu.service.staff@v2ecosystem.com';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'staff123';

async function getAuthToken(request: any, email: string, pass: string): Promise<string | null> {
  const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: pass },
  });
  if (!loginRes.ok()) return null;
  const loginBody = await loginRes.json();
  return loginBody.data?.tokens?.accessToken || loginBody.data?.token || loginBody.token || null;
}

test.describe('Engine A: Catalog Lifecycle (Phase 8)', () => {
  let staffToken: string | null = null;
  let testItemId: string | null = null;

  test.beforeAll(async ({ request }) => {
    staffToken = await getAuthToken(request, STAFF_EMAIL, STAFF_PASSWORD);
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: delete the test item
    if (staffToken && testItemId) {
      await request.delete(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${testItemId}`, {
        headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'default' },
      });
    }
  });

  test('create catalog item (starts as active)', async ({ request }) => {
    expect(staffToken).toBeTruthy();

    const res = await request.post(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items`, {
      headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'default' },
      data: { name: 'E2E Lifecycle Burger', price: 15.00 },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    testItemId = body.data?.id;
    expect(testItemId).toBeTruthy();
    // Default lifecycle_status is 'active'
    expect(body.data?.lifecycle_status).toBe('active');
  });

  test('active → temporarily_unavailable (Pause)', async ({ request }) => {
    expect(staffToken).toBeTruthy();
    expect(testItemId).toBeTruthy();

    // The frontend sends lifecycle_status: 'temporarily_unavailable'
    // This must match the backend's state name, not the action verb 'pause'
    const res = await request.put(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${testItemId}`, {
      headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'default' },
      data: { lifecycle_status: 'temporarily_unavailable' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data?.lifecycle_status).toBe('temporarily_unavailable');
  });

  test('temporarily_unavailable → active (Restore)', async ({ request }) => {
    expect(staffToken).toBeTruthy();
    expect(testItemId).toBeTruthy();

    // The frontend sends lifecycle_status: 'active'
    // NOT 'restore' (the action verb)
    const res = await request.put(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${testItemId}`, {
      headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'default' },
      data: { lifecycle_status: 'active' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data?.lifecycle_status).toBe('active');
  });

  test('active → sold_out (Sell Out)', async ({ request }) => {
    expect(staffToken).toBeTruthy();
    expect(testItemId).toBeTruthy();

    // The frontend sends lifecycle_status: 'sold_out'
    // NOT 'sell_out' (the action verb)
    const res = await request.put(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${testItemId}`, {
      headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'default' },
      data: { lifecycle_status: 'sold_out' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data?.lifecycle_status).toBe('sold_out');
  });

  test('sold_out is terminal — cannot transition', async ({ request }) => {
    expect(staffToken).toBeTruthy();
    expect(testItemId).toBeTruthy();

    // Attempting sold_out → active must fail with 400
    const res = await request.put(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${testItemId}`, {
      headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'default' },
      data: { lifecycle_status: 'active' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid lifecycle transition');
  });

  test('customer menu hides sold_out items', async ({ request }) => {
    expect(staffToken).toBeTruthy();
    expect(testItemId).toBeTruthy();

    const res = await request.get(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/items`, {
      headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'default' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    const itemIds = (body.data || []).map((i: any) => i.id);
    // sold_out item should NOT appear in the customer menu
    expect(itemIds).not.toContain(testItemId);
  });
});
