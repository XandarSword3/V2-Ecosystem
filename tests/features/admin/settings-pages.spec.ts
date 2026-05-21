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

test.describe('Admin Settings Pages [ADM-SET-001 → 012]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-SET-001: General settings form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings`);
    await expect(page.getByRole('heading', { name: /setting/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input, select, textarea').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /save|update/i }).first()).toBeVisible();
  });

  test('ADM-SET-002: Appearance page with theme/colors', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/appearance`);
    await expect(page.getByRole('heading', { name: /appearance|theme/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/color|theme|logo|brand/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-SET-004: Navbar configuration', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/navbar`);
    await expect(page.getByRole('heading', { name: /nav/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input, select, [draggable]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-SET-005: Homepage configuration', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/homepage`);
    await expect(page.getByRole('heading', { name: /home/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input, select, textarea, [draggable]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-SET-006: Footer configuration', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/footer`);
    await expect(page.getByRole('heading', { name: /footer/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input, textarea').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-SET-008: Translation management', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/translations`);
    await expect(page.getByRole('heading', { name: /translat|language|i18n/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, .grid, input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-SET-010: Payment settings (Stripe keys)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/payments`);
    await expect(page.getByRole('heading', { name: /payment|stripe/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[name*="key" i], input[name*="stripe" i], input[type="password"], input[placeholder*="key" i]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-SET-012: Backup management', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/settings/backups`);
    await expect(page.getByRole('heading', { name: /backup/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /create|backup|download/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
