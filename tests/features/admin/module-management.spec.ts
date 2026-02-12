import { test, expect, Page } from '@playwright/test';

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

test.describe('Admin Module Management [ADM-MOD-001 → 010]', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-MOD-001: View all modules table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    await expect(page.getByRole('heading', { name: /module/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-MOD-003: Create module form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    const addBtn = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    await expect(page.locator('input[name="name"], input[name="title"], [role="dialog"] input, form input').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-MOD-005: Toggle module active/inactive', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
    const toggle = page.locator('button[role="switch"], input[type="checkbox"], button:has-text("Deactivate"), button:has-text("Activate")').first();
    await expect(toggle).toBeVisible({ timeout: 10000 });
  });

  test('ADM-MOD-007: Module builder loads with canvas', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
    const builderLink = page.locator('a[href*="builder"], button:has-text("build"), button:has-text("edit")').first();
    await expect(builderLink).toBeVisible({ timeout: 10000 });
    await builderLink.click();
    await expect(page.locator('[data-testid*="canvas"], .builder-canvas, [class*="canvas"], [role="main"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('ADM-MOD-009: Builder toolbar has component blocks', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/modules`);
    const builderLink = page.locator('a[href*="builder"], button:has-text("build"), button:has-text("edit")').first();
    await expect(builderLink).toBeVisible({ timeout: 15000 });
    await builderLink.click();
    await expect(page.locator('text=/component|block|widget|element|heading|text|image/i').first()).toBeVisible({ timeout: 15000 });
  });
});
