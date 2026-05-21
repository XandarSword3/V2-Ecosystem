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

test.describe('Admin Loyalty Management [ADM-LOY-001 → 005]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-LOY-001: View loyalty accounts table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/loyalty`);
    await expect(page.getByRole('heading', { name: /loyalty/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-LOY-002: View stats', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/loyalty`);
    await expect(page.locator('text=/total|active|points|member/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-LOY-003: Update settings form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/loyalty`);
    const settingsBtn = page.getByRole('button', { name: /setting|config|edit/i }).first();
    await expect(settingsBtn).toBeVisible({ timeout: 15000 });
    await settingsBtn.click();
    await expect(page.locator('input, select, [role="dialog"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-LOY-005: Manage tiers', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/loyalty`);
    await expect(page.locator('text=/tier|bronze|silver|gold|platinum|level/i').first()).toBeVisible({ timeout: 15000 });
  });
});
