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

test.describe('Admin Inventory Management [ADM-INV-001 → 011]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-INV-001: View inventory items table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/inventory`);
    await expect(page.getByRole('heading', { name: /inventory/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-INV-003: Create inventory item form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/inventory`);
    const addBtn = page.getByRole('button', { name: /add.*item|new.*item|create/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input[name="name"], [role="dialog"] input, form input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-INV-005: Manage categories', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/inventory`);
    await expect(page.locator('text=/categor/i').first()).toBeVisible({ timeout: 15000 });
    const catBtn = page.getByRole('button', { name: /categor/i }).first();
    await expect(catBtn).toBeVisible({ timeout: 10000 });
  });

  test('ADM-INV-007: Record transaction form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/inventory`);
    const txnBtn = page.getByRole('button', { name: /transaction|record|stock/i }).first();
    await expect(txnBtn).toBeVisible({ timeout: 15000 });
    await txnBtn.click();
    await expect(page.locator('select, input[name="quantity"], [role="dialog"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-INV-009: View alerts', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/inventory`);
    await expect(page.locator('text=/alert|low.stock|warning/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-INV-011: Inventory stats display', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/inventory`);
    await expect(page.locator('text=/total.*item|stock.*value|categor/i').first()).toBeVisible({ timeout: 15000 });
  });
});
