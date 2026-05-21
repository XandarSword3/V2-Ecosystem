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

test.describe('Admin Notifications Management [ADM-NOTIF-001 → 004]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-NOTIF-001: View notifications', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/notifications`);
    await expect(page.getByRole('heading', { name: /notification/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, .grid, [role="list"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-NOTIF-002: Broadcast notification form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/notifications`);
    const broadcastBtn = page.getByRole('button', { name: /broadcast|send|new|create/i }).first();
    await expect(broadcastBtn).toBeVisible({ timeout: 15000 });
    await broadcastBtn.click();
    await expect(page.locator('input[name="title"], input[name="subject"], textarea, [role="dialog"] input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-NOTIF-003: Manage templates', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/notifications`);
    await expect(page.locator('text=/template/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-NOTIF-004: Send from template', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/notifications`);
    await expect(page.locator('text=/template/i').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("send"), button:has-text("use"), a:has-text("send")').first()).toBeVisible({ timeout: 10000 });
  });
});
