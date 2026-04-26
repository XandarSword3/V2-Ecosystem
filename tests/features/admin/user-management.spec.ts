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

test.describe('Admin User Management [ADM-USR-001 → 011]', () => {
test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ADM-USR-001: View all users table', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users`);
    await expect(page.getByRole('heading', { name: /users/i }).first()).toBeVisible({ timeout: 15000 });
    const table = page.locator('table, [role="table"], [data-testid*="user"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('ADM-USR-003: View customers tab/page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users/customers`);
    await expect(page.getByRole('heading', { name: /customer/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-USR-004: View staff tab/page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users/staff`);
    await expect(page.getByRole('heading', { name: /staff/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table, [role="table"], .grid').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-USR-005: Create user form loads', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users/create`);
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[name="name"], input[name="firstName"], input[placeholder*="name" i]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create|save|submit/i }).first()).toBeVisible();
  });

  test('ADM-USR-007: User detail page loads', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users`);
    await expect(page.locator('table, [role="table"]').first()).toBeVisible({ timeout: 15000 });
    const firstRow = page.locator('table tbody tr, [role="row"]').first();
    const link = firstRow.locator('a, button').first();
    await link.click();
    await expect(page.locator('text=/email|role|profile|details/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-USR-008: Roles management page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users/roles`);
    await expect(page.getByRole('heading', { name: /role/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/admin|staff|customer|manager/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('ADM-USR-009: Search users functionality', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/admin/users`);
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr, [role="row"]').first()).toBeVisible({ timeout: 10000 });
  });
});
