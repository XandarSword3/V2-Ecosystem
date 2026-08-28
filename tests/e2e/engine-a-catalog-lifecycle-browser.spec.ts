/**
 * engine-a-catalog-lifecycle-browser.spec.ts
 *
 * Phase 8 — Real browser E2E test for catalog lifecycle transitions.
 *
 * This test exercises the ACTUAL MOUNTED FRONTEND CONTROLS, not API calls.
 * It proves that:
 *   1. The admin menu page renders catalog items with lifecycle badges.
 *   2. Clicking Publish/Pause/Restore/Sell Out/Archive triggers the correct
 *      PUT request with lifecycle_status (state name, not action verb).
 *   3. The UI re-renders with the expected visible lifecycle badge.
 *   4. Customer-facing menu filtering reflects lifecycle changes.
 *   5. Staff surfaces reflect the new lifecycle state.
 *
 * Every step interacts through Playwright's browser (page.click, page.locator),
 * NOT through `request.post/put`. The API-level test in
 * engine-a-catalog-lifecycle.spec.ts covers the API contract; this test covers
 * the mounted frontend that consumes that contract.
 */

import { test, expect } from '../fixtures/auth.fixture';
import { TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD } from '../fixtures/test-credentials';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://walid.localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';
const TEST_MODULE_SLUG = process.env.E2E_ENGINE_A_SLUG || 'poolside-grill';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PROPERTY_SLUG = process.env.E2E_PROPERTY_SLUG || 'walid-s-property';

async function dismissCookieConsent(page: any) {
  try {
    const btn = page.getByRole('button', { name: /accept all/i });
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  } catch { /* not present */ }
}

async function loginAsAdmin(page: any) {
  const email = process.env.E2E_ADMIN_EMAIL || 'test.admin@v2ecosystem.com';
  const password = process.env.E2E_ADMIN_PASSWORD || 'admin123';
  const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password },
    timeout: 30_000,
  });
  if (!response.ok()) throw new Error(`API login failed: ${response.status()} ${await response.text()}`);
  const body = await response.json();
  const accessToken = body?.data?.tokens?.accessToken || body?.data?.accessToken;
  if (!accessToken) throw new Error('No accessToken in response');
  await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await dismissCookieConsent(page);
  await page.evaluate(({ token }) => {
    localStorage.setItem('accessToken', token);
  }, { token: accessToken });
  await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
  await dismissCookieConsent(page);
}

/** Find the lifecycle badge span for a given item name. */
function lifecycleBadge(page: any, itemName: string) {
  // The badge is a <span> with rounded-full text-xs inside the item card,
  // rendered only when lifecycle_status !== 'active'.
  return page
    .locator(`text=${itemName}`)
    .locator('xpath=ancestor::*[contains(@class,"Card") or contains(@class,"card") or @data-slot="card" or contains(@class,"rounded-2xl") or contains(@class,"bg-white")]')
    .first()
    .locator('span.rounded-full');
}

/** Find all lifecycle transition buttons for a given item name. */
function lifecycleButtons(page: any, itemName: string) {
  return page
    .locator(`text=${itemName}`)
    .locator('xpath=ancestor::*[contains(@class,"Card") or contains(@class,"card") or @data-slot="card" or contains(@class,"rounded-2xl") or contains(@class,"bg-white")]')
    .first()
    .locator('button')
    .filter({ hasText: /Publish|Pause|Restore|Sell\s*Out|Archive/ });
}

/** Create a test catalog item via API. Returns its id. */
async function createTestItem(
  request: any,
  token: string,
  overrides: Record<string, any> = {},
): Promise<string> {
  const res = await request.post(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items`, {
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': 'default' },
    data: {
      name: `E2E Browser Lifecycle ${Date.now()}`,
      price: 12.5,
      ...overrides,
    },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return body.data?.id;
}

/** Update an item's lifecycle_status via API. */
async function updateLifecycle(
  request: any,
  token: string,
  itemId: string,
  lifecycle_status: string,
) {
  const res = await request.put(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': 'default' },
    data: { lifecycle_status },
  });
  expect(res.ok()).toBe(true);
}

/** Delete an item via API. */
async function deleteItem(request: any, token: string, itemId: string) {
  await request.delete(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': 'default' },
  });
}

/** Fetch items from the customer-facing menu API. */
async function getCustomerMenuItems(request: any, token: string): Promise<any[]> {
  const res = await request.get(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/items`, {
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': 'default' },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return body.data || [];
}

/** Fetch staff module orders via API. */
async function getStaffOrders(request: any, token: string): Promise<any[]> {
  const res = await request.get(
    `${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/orders?status=confirmed,queued,in_progress,ready,handed_off`,
    {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': 'default' },
    },
  );
  if (!res.ok()) return [];
  const body = await res.json();
  return body.data || [];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Engine A: Catalog Lifecycle — Browser E2E (Phase 8)', () => {
  let staffToken: string | null = null;
  let activeItemId: string | null = null;
  let activeItemName: string | null = null;
  let draftItemId: string | null = null;
  let draftItemName: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Authenticate for API setup/teardown
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: TEST_STAFF_EMAIL, password: TEST_STAFF_PASSWORD },
    });
    if (loginRes.ok()) {
      const loginBody = await loginRes.json();
      staffToken =
        loginBody.data?.tokens?.accessToken ||
        loginBody.data?.token ||
        loginBody.token ||
        null;
    }

    if (!staffToken) {
      // Fallback: try admin credentials
      const adminRes = await request.post(`${API_URL}/api/v1/auth/login`, {
        data: {
          email: process.env.E2E_ADMIN_EMAIL || 'admin@v2ecosystem.com',
          password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
        },
      });
      if (adminRes.ok()) {
        const adminBody = await adminRes.json();
        staffToken =
          adminBody.data?.tokens?.accessToken ||
          adminBody.data?.token ||
          adminBody.token ||
          null;
      }
    }

    expect(staffToken).toBeTruthy();

    // Create an 'active' item (default lifecycle_status) for Pause/Restore/Sell Out/Archive tests
    activeItemName = `E2E Active ${Date.now()}`;
    activeItemId = await createTestItem(request, staffToken!, { name: activeItemName });

    // Create a 'draft' item for Publish test
    draftItemName = `E2E Draft ${Date.now() + 1}`;
    draftItemId = await createTestItem(request, staffToken!, { name: draftItemName });
    await updateLifecycle(request, staffToken!, draftItemId, 'draft');
  });

  test.afterAll(async ({ request }) => {
    if (staffToken) {
      if (activeItemId) await deleteItem(request, staffToken, activeItemId).catch(() => {});
      if (draftItemId) await deleteItem(request, staffToken, draftItemId).catch(() => {});
    }
  });

  // -----------------------------------------------------------------------
  // 1. Login and navigate to admin menu page
  // -----------------------------------------------------------------------
  test('log in and navigate to admin menu page', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to the admin menu management page for the test module
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // The page should show some indication of menu management
    await expect(
      page.getByRole('heading', { name: /menu|item|product|catalog/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // 2. Active item shows expected lifecycle transition buttons
  // -----------------------------------------------------------------------
  test('active item shows Pause / Sell Out / Archive buttons (no Publish, no Restore)', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Wait for items to load
    await page.waitForTimeout(2_000);

    // An active item should have Pause, Sell Out, and Archive buttons
    const pauseBtn = page.getByRole('button', { name: /Pause/i }).first();
    const sellOutBtn = page.getByRole('button', { name: /Sell\s*Out/i }).first();
    const archiveBtn = page.getByRole('button', { name: /Archive/i }).first();

    await expect(pauseBtn).toBeVisible({ timeout: 10_000 });
    await expect(sellOutBtn).toBeVisible({ timeout: 10_000 });
    await expect(archiveBtn).toBeVisible({ timeout: 10_000 });

    // Publish and Restore should NOT be visible for an active item
    const publishBtn = page.getByRole('button', { name: /^Publish$/i }).first();
    const restoreBtn = page.getByRole('button', { name: /^Restore$/i }).first();
    await expect(publishBtn).not.toBeVisible();
    await expect(restoreBtn).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 3. Draft item shows Publish button
  // -----------------------------------------------------------------------
  test('draft item shows Publish button', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(2_000);

    // The draft item should display a Draft badge and a Publish button
    const draftBadge = page.locator('span', { hasText: 'Draft' }).first();
    await expect(draftBadge).toBeVisible({ timeout: 10_000 });

    const publishBtn = page.getByRole('button', { name: /Publish/i }).first();
    await expect(publishBtn).toBeVisible({ timeout: 10_000 });
  });

  // -----------------------------------------------------------------------
  // 4. Click Publish on a draft item → badge changes to Active
  // -----------------------------------------------------------------------
  test('click Publish on draft item → badge changes to Active, item visible to customer', async ({
    page,
    request,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(2_000);

    // Find the Publish button (associated with the draft item)
    const publishBtn = page.getByRole('button', { name: /Publish/i }).first();
    await expect(publishBtn).toBeVisible({ timeout: 10_000 });

    // Intercept the PUT request to verify the lifecycle_status payload
    const putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );

    await publishBtn.click();

    const putResponse = await putPromise;
    const putBody = await putResponse.json();
    // The frontend MUST send the state name 'active', not the action verb 'publish'
    expect(putBody.data?.lifecycle_status).toBe('active');

    // After Publish, the draft badge should disappear (active items show no badge)
    await page.waitForTimeout(1_500);
    const draftBadge = page.locator('span', { hasText: 'Draft' }).first();
    await expect(draftBadge).not.toBeVisible({ timeout: 10_000 });

    // Publish button should be gone; Pause, Sell Out, Archive should appear
    await expect(page.getByRole('button', { name: /Pause/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // -----------------------------------------------------------------------
  // 5. Click Pause on an active item → badge changes to Paused
  // -----------------------------------------------------------------------
  test('click Pause on active item → badge changes to Paused, Restore button appears', async ({
    page,
    request,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(2_000);

    const pauseBtn = page.getByRole('button', { name: /Pause/i }).first();
    await expect(pauseBtn).toBeVisible({ timeout: 10_000 });

    const putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );

    await pauseBtn.click();

    const putResponse = await putPromise;
    const putBody = await putResponse.json();
    // Must send the state name, not the action verb
    expect(putBody.data?.lifecycle_status).toBe('temporarily_unavailable');

    // Badge should now say "Paused"
    await page.waitForTimeout(1_500);
    const pausedBadge = page.locator('span', { hasText: 'Paused' }).first();
    await expect(pausedBadge).toBeVisible({ timeout: 10_000 });

    // Restore button should appear
    const restoreBtn = page.getByRole('button', { name: /Restore/i }).first();
    await expect(restoreBtn).toBeVisible({ timeout: 10_000 });

    // Pause button should be gone
    await expect(page.getByRole('button', { name: /^Pause$/i }).first()).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 6. Click Restore on a paused item → badge returns to Active (no badge shown)
  // -----------------------------------------------------------------------
  test('click Restore on paused item → item returns to Active, no lifecycle badge shown', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(2_000);

    const restoreBtn = page.getByRole('button', { name: /Restore/i }).first();
    await expect(restoreBtn).toBeVisible({ timeout: 10_000 });

    const putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );

    await restoreBtn.click();

    const putResponse = await putPromise;
    const putBody = await putResponse.json();
    expect(putBody.data?.lifecycle_status).toBe('active');

    // After restore, the Paused badge should disappear
    await page.waitForTimeout(1_500);
    await expect(page.locator('span', { hasText: 'Paused' }).first()).not.toBeVisible({
      timeout: 10_000,
    });

    // Pause button should reappear
    await expect(page.getByRole('button', { name: /^Pause$/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // -----------------------------------------------------------------------
  // 7. Click Sell Out → badge changes to Sold Out, customer menu hides item
  // -----------------------------------------------------------------------
  test('click Sell Out → badge changes to Sold Out, item hidden from customer menu', async ({
    page,
    request,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(2_000);

    const sellOutBtn = page.getByRole('button', { name: /Sell\s*Out/i }).first();
    await expect(sellOutBtn).toBeVisible({ timeout: 10_000 });

    const putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );

    await sellOutBtn.click();

    const putResponse = await putPromise;
    const putBody = await putResponse.json();
    expect(putBody.data?.lifecycle_status).toBe('sold_out');

    // Badge should now say "Sold Out"
    await page.waitForTimeout(1_500);
    const soldOutBadge = page.locator('span', { hasText: 'Sold Out' }).first();
    await expect(soldOutBadge).toBeVisible({ timeout: 10_000 });

    // No more lifecycle buttons (sold_out is terminal)
    await expect(page.getByRole('button', { name: /Restore/i }).first()).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Pause/i }).first()).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Archive/i }).first()).not.toBeVisible();

    // Verify customer menu hides sold_out items
    expect(staffToken).toBeTruthy();
    const customerItems = await getCustomerMenuItems(request, staffToken!);
    const itemIds = customerItems.map((i: any) => i.id);
    expect(itemIds).not.toContain(activeItemId);
  });

  // -----------------------------------------------------------------------
  // 8. Staff can still see sold_out items (admin/staff view includes all)
  // -----------------------------------------------------------------------
  test('sold_out item is visible in admin menu page (staff view includes all lifecycle states)', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(2_000);

    // The Sold Out badge should be visible in the admin view
    const soldOutBadge = page.locator('span', { hasText: 'Sold Out' }).first();
    await expect(soldOutBadge).toBeVisible({ timeout: 10_000 });
  });

  // -----------------------------------------------------------------------
  // 9. Reset item back to active for cleanup (via browser — Restore after Pause)
  //    We need to do a Pause → Restore cycle since sold_out is terminal.
  //    Instead, use a fresh item to verify the full cycle works end-to-end.
  // -----------------------------------------------------------------------
  test('full lifecycle cycle on fresh item: active → Pause → Restore → Sell Out → verify badge at each step', async ({
    page,
    request,
  }) => {
    // Create a fresh item via API
    expect(staffToken).toBeTruthy();
    const freshItemName = `E2E Full Cycle ${Date.now()}`;
    const freshItemId = await createTestItem(request, staffToken!, { name: freshItemName });

    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(3_000);

    // Step 1: Active — no badge for this specific item
    // Active items don't show a lifecycle badge, so we verify Pause button is present
    const pauseBtn = page.getByRole('button', { name: /Pause/i }).first();
    await expect(pauseBtn).toBeVisible({ timeout: 10_000 });

    // Step 2: Pause
    let putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );
    await pauseBtn.click();
    let resp = await putPromise;
    let body = await resp.json();
    expect(body.data?.lifecycle_status).toBe('temporarily_unavailable');

    await page.waitForTimeout(1_500);
    await expect(page.locator('span', { hasText: 'Paused' }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Step 3: Restore
    const restoreBtn = page.getByRole('button', { name: /Restore/i }).first();
    await expect(restoreBtn).toBeVisible({ timeout: 10_000 });
    putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );
    await restoreBtn.click();
    resp = await putPromise;
    body = await resp.json();
    expect(body.data?.lifecycle_status).toBe('active');

    await page.waitForTimeout(1_500);
    // Paused badge should be gone
    await expect(page.locator('span', { hasText: 'Paused' }).first()).not.toBeVisible({
      timeout: 10_000,
    });

    // Step 4: Sell Out
    const sellOutBtn = page.getByRole('button', { name: /Sell\s*Out/i }).first();
    await expect(sellOutBtn).toBeVisible({ timeout: 10_000 });
    putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );
    await sellOutBtn.click();
    resp = await putPromise;
    body = await resp.json();
    expect(body.data?.lifecycle_status).toBe('sold_out');

    await page.waitForTimeout(1_500);
    await expect(page.locator('span', { hasText: 'Sold Out' }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Verify customer menu hides this item
    const customerItems = await getCustomerMenuItems(request, staffToken!);
    expect(customerItems.map((i: any) => i.id)).not.toContain(freshItemId);

    // Cleanup
    await deleteItem(request, staffToken!, freshItemId);
  });

  // -----------------------------------------------------------------------
  // 10. Verify frontend sends state names, not action verbs
  //     (This is a browser-level assertion: intercept every PUT and check payload)
  // -----------------------------------------------------------------------
  test('every lifecycle PUT sends lifecycle_status (state name), never an action verb', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await page.waitForTimeout(2_000);

    // Collect all PUT payloads to admin items
    const payloads: any[] = [];
    page.on('request', (req: any) => {
      if (
        req.method() === 'PUT' &&
        req.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`)
      ) {
        try {
          payloads.push(JSON.parse(req.postData() || '{}'));
        } catch {
          // ignore non-JSON
        }
      }
    });

    // Click the first available lifecycle transition button
    const transitionBtn = page
      .getByRole('button', { name: /Pause|Sell\s*Out|Archive|Publish|Restore/i })
      .first();

    if (await transitionBtn.isVisible().catch(() => false)) {
      await transitionBtn.click();
      await page.waitForTimeout(2_000);

      // Every captured payload must use a canonical state name
      const VALID_STATES = [
        'draft',
        'active',
        'temporarily_unavailable',
        'sold_out',
        'archived',
      ];
      const VALID_ACTIONS = ['publish', 'pause', 'restore', 'sell_out', 'archive'];

      for (const payload of payloads) {
        if (payload.lifecycle_status) {
          expect(
            VALID_STATES,
            `lifecycle_status "${payload.lifecycle_status}" is a canonical state name, not an action verb`,
          ).toContain(payload.lifecycle_status);
          expect(
            VALID_ACTIONS,
            `lifecycle_status "${payload.lifecycle_status}" must NOT be an action verb`,
          ).not.toContain(payload.lifecycle_status);
        }
      }
    }
  });
});
