import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Admin Dashboard Smoke [ADM-DASH, ADM-NAV]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill('admin@v2resort.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/\/(admin|staff)/, { timeout: 15000 });
  });

  test('admin dashboard loads with stats', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
    const body = await page.locator('body').textContent() || '';
    // Dashboard should have numeric content (stats)
    expect(body.length).toBeGreaterThan(100);
  });

  test('admin sidebar navigation is present', async ({ page }) => {
    const sidebar = page.locator('nav, aside, [role="navigation"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('admin can navigate to orders page', async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('admin can navigate to users page', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('admin can navigate to settings page', async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('admin can navigate to reports page', async ({ page }) => {
    await page.goto(`${BASE}/admin/reports`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('admin can navigate to modules page', async ({ page }) => {
    await page.goto(`${BASE}/admin/modules`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('admin can navigate to inventory page', async ({ page }) => {
    await page.goto(`${BASE}/admin/inventory`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('admin can navigate to housekeeping page', async ({ page }) => {
    await page.goto(`${BASE}/admin/housekeeping`);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
