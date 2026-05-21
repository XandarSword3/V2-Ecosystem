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

test.describe('Admin Gift Card Management [ADM-GFT-001 → 005]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-GFT-001: View all gift cards table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/giftcards`);
    await expect(page.getByRole('heading', { name: /gift.card/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-GFT-002: Create gift card form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/giftcards`);
    const addBtn = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input[name="amount"], input[name="value"], [role="dialog"] input, form input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-GFT-003: Manage templates', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/giftcards`);
    await expect(page.locator('text=/template|design/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-GFT-005: View stats', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/giftcards`);
    await expect(page.locator('text=/total|active|redeemed|balance|value/i').first()).toBeVisible({ timeout: 15000 });
  });
});
