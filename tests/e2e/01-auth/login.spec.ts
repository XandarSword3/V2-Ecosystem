/**
 * e2e/specs/01-auth/login.spec.ts
 *
 * Layer 1 — Auth: login flows.
 *
 * What this proves:
 *   - The login page renders with the correct form fields
 *   - Valid credentials authenticate and redirect to /admin
 *   - Wrong password produces a visible error and stays on /login
 *   - The backend login endpoint returns a usable JWT (API-level check)
 *   - An authenticated session survives a page reload
 *
 * All browser tests run against testcorp.localhost:3000.
 * All Node.js API calls use localhost:3005 + x-tenant-slug header.
 */

import { test, expect, fetchTestAdminToken } from '../../fixtures/base';
import { loginAsAdmin } from '../../fixtures/auth.fixture';
import { TESTCORP_ADMIN } from '../../fixtures/test-credentials';

// ---------------------------------------------------------------------------
// 1. Login page structure
// ---------------------------------------------------------------------------

test.describe('Layer 1 — Auth: login page', () => {
  test('login page renders email and password fields', async ({ page }) => {
    await page.goto('http://testcorp.localhost:3000/login');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Successful login
// ---------------------------------------------------------------------------

test.describe('Layer 1 — Auth: successful login', () => {
  test('valid admin credentials redirect to /admin', async ({ page }) => {
    await loginAsAdmin(page, 'testcorp');

    // loginAsAdmin waits for /admin URL — if we reach here the redirect worked
    await expect(page).toHaveURL(/\/admin/);
  });

  test('authenticated session survives a page reload', async ({ page }) => {
    await loginAsAdmin(page, 'testcorp');
    await expect(page).toHaveURL(/\/admin/);

    // Reload and confirm we stay in the admin area, not bounced to /login
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin/);
  });
});

// ---------------------------------------------------------------------------
// 3. Failed login
// ---------------------------------------------------------------------------

test.describe('Layer 1 — Auth: failed login', () => {
  test('wrong password shows an error and stays on /login', async ({ page }) => {
    await page.goto('http://testcorp.localhost:3000/login');

    await page.fill('#email', TESTCORP_ADMIN.email);
    await page.fill('#password', 'WrongPassword!999');
    await page.click('button[type="submit"]');

    // Wait for loading to finish — button is disabled while isLoading=true
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 8_000 });

    // Must stay on /login
    await expect(page).toHaveURL(/\/login/);

    // Error must be visible somewhere on the page
    await expect(page.locator('.bg-red-50, [class*="bg-red"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('unknown email shows an error and stays on /login', async ({ page }) => {
    await page.goto('http://testcorp.localhost:3000/login');

    await page.fill('#email', 'doesnotexist@testcorp.v2platform.com');
    await page.fill('#password', 'SomePassword!1');
    await page.click('button[type="submit"]');

    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.bg-red-50, [class*="bg-red"]').first()).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. API-level token check
// ---------------------------------------------------------------------------

test.describe('Layer 1 — Auth: JWT token', () => {
  test('fetchTestAdminToken returns a usable JWT', async ({ request }) => {
    const token = await fetchTestAdminToken('testcorp');

    // Token must be a non-empty string
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    // Token must be accepted by the /me endpoint
    const res = await request.get('http://localhost:3005/api/v1/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-slug': 'testcorp',
      },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    // Auth /me returns user under body.data or directly on body
    const email = body.data?.email ?? body.email;
    expect(email).toBe(TESTCORP_ADMIN.email);
  });

  test('request with no token is rejected by protected endpoints', async ({ request }) => {
    const res = await request.get('http://localhost:3005/api/v1/auth/me', {
      headers: { 'x-tenant-slug': 'testcorp' },
    });

    expect(res.status()).toBe(401);
  });
});
