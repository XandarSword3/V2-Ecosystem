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

test.describe('Admin Reports & Analytics [ADM-RPT-001 → 008]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-RPT-001: Reports overview page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reports`);
    await expect(page.getByRole('heading', { name: /report/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/revenue|booking|occupancy|sales/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-RPT-003: Analytics dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reports/analytics`);
    await expect(page.getByRole('heading', { name: /analytics|dashboard/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('canvas, svg, [class*="chart"], [data-testid*="chart"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-RPT-005: Export report buttons', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reports`);
    await expect(page.locator('button:has-text("export"), button:has-text("download"), button:has-text("CSV"), button:has-text("PDF"), text=/export|download/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-RPT-006: Scheduled reports page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reports/scheduled`);
    await expect(page.getByRole('heading', { name: /scheduled|automat/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-RPT-008: Preview report action', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/reports`);
    await expect(page.locator('button:has-text("preview"), button:has-text("view"), a:has-text("view")').first()).toBeVisible({ timeout: 15000 });
  });
});
