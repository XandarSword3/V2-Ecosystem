import { test, expect, Page } from '../../fixtures/auth.fixture';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3005/api';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@v2ecosystem.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function loginAsAdmin(page: Page) {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 30000 });
}

test.describe('Admin Housekeeping [ADM-HSK-001 → 006]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-HSK-001: View tasks table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/housekeeping`);
    await expect(page.getByRole('heading', { name: /housekeeping|task/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-HSK-002: Create task form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/housekeeping`);
    const addBtn = page.getByRole('button', { name: /add.*task|new.*task|create/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input[name="title"], input[name="name"], [role="dialog"] input, form input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-HSK-003: Assign task', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/housekeeping`);
    await expect(page.locator('table, .grid').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/assign|staff|assignee/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-HSK-004: Manage schedules', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/housekeeping`);
    await expect(page.locator('text=/schedule|recurring|frequency/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-HSK-006: View stats', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/housekeeping`);
    await expect(page.locator('text=/total|pending|completed|in.progress/i').first()).toBeVisible({ timeout: 15000 });
  });
});
