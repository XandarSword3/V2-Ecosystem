import { test, expect, Page } from '../../fixtures/auth.fixture';

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

test.describe('Admin Restaurant Management [ADM-REST-001 → 016]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-REST-001: View menu categories', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/restaurant/menu`);
    await expect(page.getByRole('heading', { name: /menu|categor/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/categor/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-REST-003: Create/edit category form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/restaurant/menu`);
    const addBtn = page.getByRole('button', { name: /add.*categor|new.*categor|create/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input[name="name"], input[placeholder*="name" i], [role="dialog"] input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-REST-005: View menu items', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/restaurant/menu`);
    await expect(page.locator('table, .grid, [data-testid*="menu"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/item|dish|product/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-REST-007: Create/edit menu item form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/restaurant/menu`);
    const addBtn = page.getByRole('button', { name: /add.*item|new.*item|create.*item/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input[name="name"], input[name="price"], [role="dialog"] input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-REST-009: Toggle item availability', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/restaurant/menu`);
    await expect(page.locator('table, .grid').first()).toBeVisible({ timeout: 15000 });
    const toggle = page.locator('button[role="switch"], input[type="checkbox"], [data-testid*="toggle"]').first();
    await expect(toggle).toBeVisible({ timeout: 10000 });
  });

  test('ADM-REST-011: Manage modifier groups', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/restaurant/menu`);
    await expect(page.locator('text=/modifier|addon|extra|variation/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-REST-014: View module orders', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/orders`);
    await expect(page.getByRole('heading', { name: /order/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });
});
