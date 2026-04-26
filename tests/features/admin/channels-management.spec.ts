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

test.describe('Admin Channels Management [ADM-CHN-001 → 006]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-CHN-001: View channel connections', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/channels`);
    await expect(page.getByRole('heading', { name: /channel/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid, [role="list"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-CHN-003: Create connection form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/channels`);
    const addBtn = page.getByRole('button', { name: /add|create|connect|new/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input, select, [role="dialog"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-CHN-005: Sync actions visible', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/channels`);
    await expect(page.locator('table, .grid').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("sync"), button:has-text("refresh"), text=/sync|synchroniz/i').first()).toBeVisible({ timeout: 10000 });
  });
});
