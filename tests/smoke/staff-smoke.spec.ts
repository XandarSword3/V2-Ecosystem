import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Staff Dashboard Smoke [STF-DASH, STF-NAV]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    // Staff user may not exist; use admin (super_admin can access staff pages)
    await page.getByLabel(/email/i).fill('admin@v2resort.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/\/(admin|staff)/, { timeout: 15000 });
  });

  test('staff dashboard loads with content', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('staff can navigate to restaurant kitchen', async ({ page }) => {
    await page.goto(`${BASE}/staff/restaurant`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('staff can navigate to chalets', async ({ page }) => {
    await page.goto(`${BASE}/staff/chalets`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('staff can navigate to pool', async ({ page }) => {
    await page.goto(`${BASE}/staff/pool`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('staff can navigate to snack bar', async ({ page }) => {
    await page.goto(`${BASE}/staff/snack`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('staff can navigate to bookings', async ({ page }) => {
    await page.goto(`${BASE}/staff/bookings`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('staff can navigate to customers', async ({ page }) => {
    await page.goto(`${BASE}/staff/customers`);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('staff can navigate to scanner', async ({ page }) => {
    await page.goto(`${BASE}/staff/scanner`);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
