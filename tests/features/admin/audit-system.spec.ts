import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005/api';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function loginAsAdmin(page: Page) {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 30000 });
}

test.describe('Admin Audit System [ADM-AUD-001 → 003]', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-AUD-001: View audit logs table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/audit`);
    await expect(page.getByRole('heading', { name: /audit/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-AUD-002: Filter by resource/date', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/audit`);
    await expect(page.locator('table, .grid').first()).toBeVisible({ timeout: 15000 });
    const filter = page.locator('select, input[type="date"], input[placeholder*="filter" i], input[placeholder*="search" i], button:has-text("filter")').first();
    await expect(filter).toBeVisible({ timeout: 10000 });
  });

  test('ADM-AUD-003: Properties page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/properties`);
    await expect(page.getByRole('heading', { name: /propert/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, .grid, form, input').first()).toBeVisible({ timeout: 10000 });
  });
});
