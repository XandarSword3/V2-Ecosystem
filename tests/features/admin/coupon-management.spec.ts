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

test.describe('Admin Coupon Management [ADM-CPN-001 → 006]', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-CPN-001: View all coupons table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/coupons`);
    await expect(page.getByRole('heading', { name: /coupon/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-CPN-002: Create coupon form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/coupons`);
    const addBtn = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input[name="code"], input[name="name"], [role="dialog"] input, form input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-CPN-004: Generate code', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/coupons`);
    const addBtn = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('text=/generate|random|auto/i, button:has-text("generate")').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-CPN-006: View stats', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/coupons`);
    await expect(page.locator('text=/total|active|used|expired|redemption/i').first()).toBeVisible({ timeout: 15000 });
  });
});
