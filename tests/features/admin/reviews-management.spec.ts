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

test.describe('Admin Reviews Management [ADM-REV-001 → 004]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-REV-001: View all reviews table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reviews`);
    await expect(page.getByRole('heading', { name: /review/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-REV-002: Approve/reject actions visible', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reviews`);
    await expect(page.locator('table, .grid').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("approve"), button:has-text("reject"), text=/approve|reject/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-REV-004: Delete review action', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reviews`);
    await expect(page.locator('table, .grid').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("delete"), button[aria-label*="delete" i], [data-testid*="delete"]').first()).toBeVisible({ timeout: 10000 });
  });
});
