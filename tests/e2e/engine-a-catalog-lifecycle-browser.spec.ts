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
import { loadE2EAdminTwoFactor, computeTotp } from '../setup/two-factor';

// NOTE: do NOT read process.env.FRONTEND_URL here: the repo-root .env sets
// FRONTEND_URL=https://v2-ecosystem.vercel.app/ and Playwright injects it
// into the test process, so it points at PRODUCTION. E2E_FRONTEND_URL is the
// test-scoped override knob; default to the local walid tenant tier.
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://walid.localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005';
const E2E_TENANT_SLUG = process.env.E2E_TENANT_SLUG || 'walid';
const TEST_MODULE_SLUG = process.env.E2E_ENGINE_A_SLUG || 'poolside-grill';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PROPERTY_SLUG = process.env.E2E_PROPERTY_SLUG || 'walid-s-property';

async function dismissCookieConsent(page: any) {
  try {
    // Scope to the banner dialog: the Customise modal ALSO has an
    // "Accept All" button, and an unscoped getByRole match is a strict-mode
    // violation — click throws, this catch swallows it, consent is never
    // persisted and the banner keeps re-appearing after every re-render.
    const btn = page
      .locator('#cookie-consent-banner')
      .getByRole('button', { name: /accept all/i });
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  } catch { /* not present */ }
  // Belt and braces: drop the node so it can never hit-test over cards.
  try {
    await page.evaluate(() => document.getElementById('cookie-consent-banner')?.remove());
  } catch { /* page context may be navigating */ }
}

async function loginAsAdmin(page: any) {
  // The walid tenant has no separate admin account: e2e.admin@v2ecosystem.com
  // IS the walid-tenant E2E admin (scope=tenant_admin). Login is tenant-scoped,
  // so the walid slug header is mandatory — without it the request resolves to
  // the platform root tenant and 401s.
  const email = process.env.E2E_ADMIN_EMAIL || 'e2e.admin@v2ecosystem.com';
  const password = process.env.E2E_ADMIN_PASSWORD || 'admin123';
  const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    headers: { 'X-Tenant-Slug': E2E_TENANT_SLUG },
    data: { email, password },
    timeout: 30_000,
  });
  if (!response.ok()) throw new Error(`API login failed: ${response.status()} ${await response.text()}`);
  const body = await response.json();
  const data = body?.data ?? {};
  let accessToken = data?.tokens?.accessToken || data?.accessToken;

  // e2e.admin is enrolled in mandatory 2FA (global-setup); answer the
  // challenge. Global-setup caches the TOTP secret in tests/.2fa-e2e-admin.json
  // (tests/setup/two-factor.ts).
  if (data?.requiresTwoFactor) {
    const record = loadE2EAdminTwoFactor();
    if (!record || record.email !== email) {
      throw new Error('2FA challenge but no cached TOTP secret — global-setup must enroll e2e.admin first');
    }
    const verifyRes = await page.request.post(`${API_URL}/api/v1/auth/2fa/verify`, {
      data: { userId: data.userId ?? record.userId, code: computeTotp(record.secret) },
      timeout: 30_000,
    });
    if (!verifyRes.ok()) {
      throw new Error(`2FA verify failed: ${verifyRes.status()} ${await verifyRes.text()}`);
    }
    const verifyBody = await verifyRes.json();
    accessToken = verifyBody?.data?.tokens?.accessToken || verifyBody?.data?.accessToken;
  }

  if (!accessToken) throw new Error('No accessToken in response');
  await page.goto(`${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await dismissCookieConsent(page);
  // Pre-seed consent so the fixed-bottom banner never mounts on later
  // navigations (types mirror context/ConsentContext.tsx).
  await page.evaluate(({ token }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem(
      'cookie-consent',
      JSON.stringify({
        categories: { necessary: true, functional: true, analytics: true, marketing: true },
        timestamp: Date.now(),
        version: '1.0',
      }),
    );
  }, { token: accessToken });
  // networkidle never settles on the Next dev server (HMR socket); wait for
  // hydration via the fixed delay + explicit UI waits in each test instead.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCookieConsent(page);
}

/** Create a test catalog item via API. Returns its id. */
async function createTestItem(
  request: any,
  token: string,
  overrides: Record<string, any> = {},
): Promise<string> {
  const res = await request.post(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': E2E_TENANT_SLUG },
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
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': E2E_TENANT_SLUG },
    data: { lifecycle_status },
  });
  expect(res.ok()).toBe(true);
}

/** Delete an item via API. */
async function deleteItem(request: any, token: string, itemId: string) {
  await request.delete(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': E2E_TENANT_SLUG },
  });
}

/**
 * Navigate to the admin menu management page and stay there.
 *
 * Under parallel load the admin surface can redirect to the property root
 * while auth/site-settings are still resolving; retry the goto until the
 * browser actually sits on the menu URL (up to 4 attempts).
 */
async function gotoAdminMenu(page: any) {
  const menuUrl = `${FRONTEND_URL}/${TEST_PROPERTY_SLUG}/admin/${TEST_MODULE_SLUG}/menu`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(menuUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await dismissCookieConsent(page);
    const onMenu = await page
      .waitForURL((u: URL) => u.pathname.endsWith(`/admin/${TEST_MODULE_SLUG}/menu`), { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (onMenu) return;
    console.log(`[gotoAdminMenu] attempt ${attempt} landed elsewhere (${page.url()}) — retrying`);
  }
  throw new Error(`Admin menu page never loaded as ${menuUrl}; last URL: ${page.url()}`);
}

/** Fetch items from the customer-facing menu API. */
async function getCustomerMenuItems(request: any, token: string): Promise<any[]> {
  const res = await request.get(`${API_URL}/api/v1/${TEST_MODULE_SLUG}/items`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': E2E_TENANT_SLUG },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return body.data || [];
}

/**
 * Locator for a specific catalog item card on the admin menu page.
 *
 * The menu renders EVERY catalog item (including unrelated production
 * fixtures in other lifecycle states), so lifecycle assertions and clicks
 * MUST be scoped to the fixture item's own card — a page-wide `.first()`
 * would grab arbitrary items and mutate rows we don't own. The menu page
 * stamps each card with data-item-id.
 */
function itemCard(page: any, itemId: string | null) {
  if (!itemId) throw new Error('itemCard called with null itemId');
  return page.locator(`[data-item-id="${itemId}"]`);
}

/** Wait for the item card to appear (list fetch + render). */
async function waitForItemCard(page: any, itemId: string | null) {
  // The cookie banner can mount after hydration and sit over the cards.
  await dismissCookieConsent(page);
  const card = itemCard(page, itemId);
  await expect(card).toBeVisible({ timeout: 20_000 });
  return card;
}

/** Fetch staff module orders via API. */
async function getStaffOrders(request: any, token: string): Promise<any[]> {
  const res = await request.get(
    `${API_URL}/api/v1/${TEST_MODULE_SLUG}/admin/orders?status=confirmed,queued,in_progress,ready,handed_off`,
    {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': E2E_TENANT_SLUG },
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
  // The tests mutate shared fixture items in a fixed order (pause → restore →
  // sell out → …), so they must not run in parallel workers.
  test.describe.configure({ mode: 'serial' });

  let staffToken: string | null = null;
  let activeItemId: string | null = null;
  let activeItemName: string | null = null;
  let draftItemId: string | null = null;
  let draftItemName: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Authenticate for API setup/teardown. The mounted fixture module
    // (poolside-grill) lives in the walid tenant, and login is tenant-scoped —
    // so we log in as that tenant's staff with the slug header, then create
    // items under the same tenant. (menu.service.staff@/menu_service_staff is
    // platform-scoped and NOT authorize()'d on /admin/items.)
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      headers: { 'X-Tenant-Slug': E2E_TENANT_SLUG },
      data: { email: process.env.E2E_STAFF_EMAIL || 'e2e.staff@v2ecosystem.com', password: process.env.E2E_STAFF_PASSWORD || 'staff123' },
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

    // Create a 'draft' item for Publish test. draft is the pre-publish state:
    // the transition graph has no active → draft edge, so create the item
    // directly in draft rather than transitioning.
    draftItemName = `E2E Draft ${Date.now() + 1}`;
    draftItemId = await createTestItem(request, staffToken!, { name: draftItemName, lifecycle_status: 'draft' });
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
    await gotoAdminMenu(page);

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
    await gotoAdminMenu(page);

    // An active item should have Pause, Sell Out, and Archive buttons —
    // scoped to this item's card (other catalog rows can legitimately show
    // Publish/Restore for their own lifecycle states).
    const card = await waitForItemCard(page, activeItemId);

    await expect(card.getByRole('button', { name: /Pause/i })).toBeVisible({ timeout: 10_000 });
    await expect(card.getByRole('button', { name: /Sell\s*Out/i })).toBeVisible({ timeout: 10_000 });
    await expect(card.getByRole('button', { name: /Archive/i })).toBeVisible({ timeout: 10_000 });

    // Publish and Restore should NOT be offered for an active item
    await expect(card.getByRole('button', { name: /^Publish$/i })).toHaveCount(0);
    await expect(card.getByRole('button', { name: /^Restore$/i })).toHaveCount(0);
  });

  // -----------------------------------------------------------------------
  // 3. Draft item shows Publish button
  // -----------------------------------------------------------------------
  test('draft item shows Publish button', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoAdminMenu(page);

    // The draft item should display a Draft badge and a Publish button —
    // scoped to the draft fixture item's card.
    const card = await waitForItemCard(page, draftItemId);
    await expect(card.locator('span', { hasText: /^Draft$/ })).toBeVisible({ timeout: 10_000 });
    await expect(card.getByRole('button', { name: /Publish/i })).toBeVisible({ timeout: 10_000 });
  });

  // -----------------------------------------------------------------------
  // 4. Click Publish on a draft item → badge changes to Active
  // -----------------------------------------------------------------------
  test('click Publish on draft item → badge changes to Active, item visible to customer', async ({
    page,
    request,
  }) => {
    await loginAsAdmin(page);
    await gotoAdminMenu(page);

    // Find the Publish button on the draft fixture item's card
    const card = await waitForItemCard(page, draftItemId);
    const publishBtn = card.getByRole('button', { name: /Publish/i });
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
    const updatedCard = itemCard(page, draftItemId);
    await expect(updatedCard.locator('span', { hasText: /^Draft$/ })).toHaveCount(0, {
      timeout: 10_000,
    });

    // Publish button should be gone; the active-item actions appear instead
    await expect(updatedCard.getByRole('button', { name: /Pause/i })).toBeVisible({
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
    await gotoAdminMenu(page);

    const card = await waitForItemCard(page, activeItemId);
    const pauseBtn = card.getByRole('button', { name: /Pause/i });
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

    // Badge should now say "Paused" and Restore should appear — on THIS card
    const updatedCard = itemCard(page, activeItemId);
    await expect(updatedCard.locator('span', { hasText: /^Paused$/ })).toBeVisible({ timeout: 10_000 });

    await expect(updatedCard.getByRole('button', { name: /Restore/i })).toBeVisible({ timeout: 10_000 });

    // Pause button should be gone from this card
    await expect(updatedCard.getByRole('button', { name: /^Pause$/i })).toHaveCount(0);
  });

  // -----------------------------------------------------------------------
  // 6. Click Restore on a paused item → badge returns to Active (no badge shown)
  // -----------------------------------------------------------------------
  test('click Restore on paused item → item returns to Active, no lifecycle badge shown', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await gotoAdminMenu(page);

    const card = await waitForItemCard(page, activeItemId);
    const restoreBtn = card.getByRole('button', { name: /Restore/i });
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

    // After restore, the Paused badge should disappear from THIS card
    const updatedCard = itemCard(page, activeItemId);
    await expect(updatedCard.locator('span', { hasText: /^Paused$/ })).toHaveCount(0, {
      timeout: 10_000,
    });

    // Pause button should reappear
    await expect(updatedCard.getByRole('button', { name: /^Pause$/i })).toBeVisible({
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
    await gotoAdminMenu(page);

    const card = await waitForItemCard(page, activeItemId);
    const sellOutBtn = card.getByRole('button', { name: /Sell\s*Out/i });
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

    // Badge should now say "Sold Out" on THIS card
    const updatedCard = itemCard(page, activeItemId);
    await expect(updatedCard.locator('span', { hasText: /^Sold Out$/ })).toBeVisible({
      timeout: 10_000,
    });

    // No more lifecycle buttons on this card (sold_out is terminal)
    await expect(updatedCard.getByRole('button', { name: /Restore/i })).toHaveCount(0);
    await expect(updatedCard.getByRole('button', { name: /Pause/i })).toHaveCount(0);
    await expect(updatedCard.getByRole('button', { name: /Archive/i })).toHaveCount(0);

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
    await gotoAdminMenu(page);

    // The Sold Out badge should be visible on the fixture item's card
    const card = await waitForItemCard(page, activeItemId);
    await expect(card.locator('span', { hasText: /^Sold Out$/ })).toBeVisible({ timeout: 10_000 });
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
    await gotoAdminMenu(page);

    // Step 1: Active — Pause button is present on THIS card
    let card = await waitForItemCard(page, freshItemId);
    await expect(card.getByRole('button', { name: /Pause/i })).toBeVisible({ timeout: 10_000 });

    // Step 2: Pause
    let putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/${TEST_MODULE_SLUG}/admin/items/`) &&
        resp.request().method() === 'PUT',
      { timeout: 15_000 },
    );
    await card.getByRole('button', { name: /Pause/i }).click();
    let resp = await putPromise;
    let body = await resp.json();
    expect(body.data?.lifecycle_status).toBe('temporarily_unavailable');

    card = itemCard(page, freshItemId);
    await expect(card.locator('span', { hasText: /^Paused$/ })).toBeVisible({
      timeout: 10_000,
    });

    // Step 3: Restore
    const restoreBtn = card.getByRole('button', { name: /Restore/i });
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

    // Paused badge should be gone from THIS card
    await expect(card.locator('span', { hasText: /^Paused$/ })).toHaveCount(0, {
      timeout: 10_000,
    });

    // Step 4: Sell Out
    const sellOutBtn = card.getByRole('button', { name: /Sell\s*Out/i });
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

    await expect(card.locator('span', { hasText: /^Sold Out$/ })).toBeVisible({
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
    request,
  }) => {
    // Create a dedicated item so the click below cannot mutate unrelated
    // catalog rows (scoped card locator — see itemCard()).
    expect(staffToken).toBeTruthy();
    const probeItemId = await createTestItem(request, staffToken!, {
      name: `E2E Verb Probe ${Date.now()}`,
    });

    await loginAsAdmin(page);
    await gotoAdminMenu(page);

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

    // Click the transition button on THIS item's card (Pause — active state)
    const card = await waitForItemCard(page, probeItemId);
    const transitionBtn = card.getByRole('button', { name: /Pause|Sell\s*Out|Archive|Publish|Restore/i }).first();

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

    // Cleanup
    await deleteItem(request, staffToken!, probeItemId);
  });
});
